import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { ethers } from "ethers";

const RPC_URL = process.env.RPC_URL ?? "http://127.0.0.1:8545";
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS ?? "";
const PORT = Number(process.env.PORT ?? 8787);
const SYNC_INTERVAL_MS = Number(process.env.SYNC_INTERVAL_MS ?? 15000);
const BLOCK_CHUNK_SIZE = Number(process.env.BLOCK_CHUNK_SIZE ?? 2000);

const DATA_DIR = resolve(process.cwd(), "data");
const DB_PATH = resolve(DATA_DIR, "index.json");

const ABI = [
  "event ContentRegistered(bytes32 indexed pHash, address indexed creator, uint256 registeredAt)",
  "event FingerprintLinked(bytes32 indexed contentId, bytes32 indexed fingerprint)",
  "function getContent(bytes32 pHash) view returns (tuple(bytes32 pHash, address creator, uint64 createdAt, bool exists, string[] whitelistScope))"
];

const iface = new ethers.Interface(ABI);

function isHexBytes32(value) {
  return typeof value === "string" && /^0x[0-9a-fA-F]{64}$/.test(value);
}

function toLowerHex(value) {
  return value.toLowerCase();
}

function hammingDistanceBytes32(a, b) {
  const aa = BigInt(a);
  const bb = BigInt(b);
  let x = aa ^ bb;
  let count = 0;
  while (x > 0n) {
    x &= x - 1n;
    count += 1;
  }
  return count;
}

async function ensureDb() {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true });
  }
  if (!existsSync(DB_PATH)) {
    const seed = {
      chainId: null,
      contractAddress: null,
      lastSyncedBlock: 0,
      contents: {},
      fingerprints: {}
    };
    await writeFile(DB_PATH, `${JSON.stringify(seed, null, 2)}\n`, "utf8");
  }
}

async function readDb() {
  await ensureDb();
  const raw = await readFile(DB_PATH, "utf8");
  return JSON.parse(raw);
}

async function writeDb(db) {
  await writeFile(DB_PATH, `${JSON.stringify(db, null, 2)}\n`, "utf8");
}

async function safeGetContent(contract, contentId) {
  try {
    const record = await contract.getContent(contentId);
    if (!record?.exists) {
      return null;
    }
    return {
      contentId: toLowerHex(contentId),
      creator: String(record.creator).toLowerCase(),
      createdAt: Number(record.createdAt)
    };
  } catch {
    return null;
  }
}

async function syncOnce(provider, contractAddress) {
  if (!ethers.isAddress(contractAddress)) {
    throw new Error("Invalid CONTRACT_ADDRESS. Expected 20-byte 0x-prefixed address.");
  }

  const contract = new ethers.Contract(contractAddress, ABI, provider);
  const network = await provider.getNetwork();
  const latestBlock = await provider.getBlockNumber();
  const db = await readDb();

  const chainId = Number(network.chainId);
  if (db.chainId !== null && db.chainId !== chainId) {
    db.lastSyncedBlock = 0;
    db.contents = {};
    db.fingerprints = {};
  }
  const normalizedAddress = contractAddress.toLowerCase();
  if (db.contractAddress && db.contractAddress !== normalizedAddress) {
    db.lastSyncedBlock = 0;
    db.contents = {};
    db.fingerprints = {};
  }
  if (Number(db.lastSyncedBlock || 0) > latestBlock) {
    db.lastSyncedBlock = 0;
    db.contents = {};
    db.fingerprints = {};
  }
  db.chainId = chainId;
  db.contractAddress = normalizedAddress;

  let fromBlock =
    db.lastSyncedBlock === 0 && Object.keys(db.fingerprints).length === 0
      ? 0
      : Number(db.lastSyncedBlock || 0) + 1;
  if (fromBlock < 0) fromBlock = 0;
  if (fromBlock > latestBlock) {
    await writeDb(db);
    return { fromBlock, toBlock: latestBlock, applied: 0 };
  }

  let applied = 0;
  for (let start = fromBlock; start <= latestBlock; start += BLOCK_CHUNK_SIZE) {
    const end = Math.min(start + BLOCK_CHUNK_SIZE - 1, latestBlock);
    const logs = await provider.getLogs({
      address: contractAddress,
      fromBlock: start,
      toBlock: end
    });

    for (const log of logs) {
      let parsed;
      try {
        parsed = iface.parseLog(log);
      } catch {
        continue;
      }
      if (!parsed) {
        continue;
      }

      if (parsed.name === "ContentRegistered") {
        const contentId = toLowerHex(parsed.args.pHash);
        const creator = String(parsed.args.creator).toLowerCase();
        const createdAt = Number(parsed.args.registeredAt);

        db.contents[contentId] = { contentId, creator, createdAt };
        db.fingerprints[contentId] = contentId;
        applied += 1;
        continue;
      }

      if (parsed.name === "FingerprintLinked") {
        const contentId = toLowerHex(parsed.args.contentId);
        const fingerprint = toLowerHex(parsed.args.fingerprint);

        db.fingerprints[fingerprint] = contentId;

        if (!db.contents[contentId]) {
          const fetched = await safeGetContent(contract, contentId);
          if (fetched) {
            db.contents[contentId] = fetched;
          }
        }
        applied += 1;
      }
    }
  }

  db.lastSyncedBlock = latestBlock;
  await writeDb(db);
  return { fromBlock, toBlock: latestBlock, applied };
}

function json(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end(JSON.stringify(payload));
}

async function parseBody(req) {
  return new Promise((resolveBody, rejectBody) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 2_000_000) {
        rejectBody(new Error("Request body too large."));
      }
    });
    req.on("end", () => {
      if (!data) {
        resolveBody({});
        return;
      }
      try {
        resolveBody(JSON.parse(data));
      } catch {
        rejectBody(new Error("Invalid JSON body."));
      }
    });
    req.on("error", rejectBody);
  });
}

function sortCandidates(candidates) {
  return candidates.sort((a, b) => {
    if (a.distance !== b.distance) return a.distance - b.distance;
    if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt;
    return a.contentId.localeCompare(b.contentId);
  });
}

async function findNearestMatch(fingerprints, threshold, limit = 20) {
  const db = await readDb();
  const normalized = fingerprints
    .filter(isHexBytes32)
    .map(toLowerHex);

  if (!normalized.length) {
    return null;
  }

  const bestByContentId = new Map();
  const entries = Object.entries(db.fingerprints);
  for (const [indexedFp, contentId] of entries) {
    const content = db.contents[contentId];
    if (!content) {
      continue;
    }

    for (const fp of normalized) {
      const distance = hammingDistanceBytes32(fp, indexedFp);
      if (distance > threshold) {
        continue;
      }
      const current = bestByContentId.get(contentId);
      if (
        !current ||
        distance < current.distance ||
        (distance === current.distance && indexedFp < current.indexedFingerprint)
      ) {
        bestByContentId.set(contentId, {
          queryFingerprint: fp,
          indexedFingerprint: indexedFp,
          contentId,
          creator: content.creator,
          createdAt: content.createdAt,
          distance
        });
      }
    }
  }

  const candidates = sortCandidates([...bestByContentId.values()]);
  return {
    match: candidates[0] ?? null,
    matches: candidates.slice(0, Math.max(1, Math.min(100, Number(limit) || 20)))
  };
}

async function main() {
  if (!CONTRACT_ADDRESS) {
    throw new Error("CONTRACT_ADDRESS is required.");
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL);

  async function runSync() {
    try {
      const report = await syncOnce(provider, CONTRACT_ADDRESS);
      console.log(
        `[sync] blocks ${report.fromBlock}..${report.toBlock}, applied=${report.applied}`
      );
    } catch (error) {
      console.error("[sync] failed:", error.message);
    }
  }

  await runSync();
  setInterval(runSync, SYNC_INTERVAL_MS);

  const server = createServer(async (req, res) => {
    if (req.method === "OPTIONS") {
      json(res, 204, {});
      return;
    }

    if (req.url === "/health" && req.method === "GET") {
      const db = await readDb();
      json(res, 200, {
        ok: true,
        rpcUrl: RPC_URL,
        contractAddress: CONTRACT_ADDRESS,
        lastSyncedBlock: db.lastSyncedBlock,
        indexedFingerprintCount: Object.keys(db.fingerprints).length
      });
      return;
    }

    if (req.url === "/sync" && req.method === "POST") {
      try {
        const report = await syncOnce(provider, CONTRACT_ADDRESS);
        json(res, 200, { ok: true, report });
      } catch (error) {
        json(res, 500, { ok: false, message: error.message });
      }
      return;
    }

    if (req.url === "/match" && req.method === "POST") {
      try {
        const body = await parseBody(req);
        const fingerprints = Array.isArray(body.fingerprints) ? body.fingerprints : [];
        const threshold = Number.isFinite(Number(body.threshold))
          ? Math.max(0, Math.min(64, Number(body.threshold)))
          : 10;

        const limit = Number.isFinite(Number(body.limit))
          ? Math.max(1, Math.min(100, Number(body.limit)))
          : 20;
        const { match, matches } = await findNearestMatch(fingerprints, threshold, limit);
        json(res, 200, { ok: true, match, matches });
      } catch (error) {
        json(res, 400, { ok: false, message: error.message });
      }
      return;
    }

    json(res, 404, { ok: false, message: "Not found." });
  });

  server.listen(PORT, () => {
    console.log(`[api] listening on http://127.0.0.1:${PORT}`);
    console.log(`[api] rpc=${RPC_URL}`);
    console.log(`[api] contract=${CONTRACT_ADDRESS}`);
  });
}

main().catch((error) => {
  console.error("[fatal]", error.message);
  process.exit(1);
});
