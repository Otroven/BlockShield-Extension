const DEFAULT_OPTIONS = {
  enabled: true,
  scopePolicy: "strict",
  similarityThreshold: 16,
  contractAddress: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  rpcUrl: "http://127.0.0.1:8545",
  indexerUrl: "http://127.0.0.1:8787"
};

const SELECTORS = {
  getContent: "0x5cc15001",
  isScopeWhitelisted: "0x4f649fd1"
};

const ERROR_SELECTORS = {
  contentNotExists: "0xc52993ed"
};
const SIMILARITY_INDEX_KEY = "similarityIndex";
const MAX_INDEX_SIZE = 2000;

chrome.runtime.onInstalled.addListener(async () => {
  const saved = await storageGet(DEFAULT_OPTIONS);
  const options = { ...DEFAULT_OPTIONS, ...saved };
  await storageSet(options);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message?.action) return false;

  if (message.action === "optionsUpdated") {
    broadcastOptionsChanged()
      .then(() => sendResponse({ ok: true }))
      .catch((error) =>
        sendResponse({ ok: false, error: error?.message || "설정 전파에 실패했습니다." })
      );
    return true;
  }

  if (message.action === "verifyImagePayload") {
    verifyImagePayload(message)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) =>
        sendResponse({ ok: false, error: error?.message || "검증에 실패했습니다." })
      );
    return true;
  }

  if (message.action === "resetExtensionStorage") {
    resetExtensionStorage()
      .then(() => sendResponse({ ok: true }))
      .catch((error) =>
        sendResponse({ ok: false, error: error?.message || "확장 초기화에 실패했습니다." })
      );
    return true;
  }

  return false;
});

async function broadcastOptionsChanged() {
  const options = { ...DEFAULT_OPTIONS, ...(await storageGet(DEFAULT_OPTIONS)) };
  const tabs = await chrome.tabs.query({});
  const tasks = tabs
    .filter((tab) => typeof tab.id === "number")
    .map((tab) =>
      chrome.tabs.sendMessage(tab.id, {
        action: "blockshieldOptionsChanged",
        enabled: Boolean(options.enabled)
      }).catch(() => undefined)
    );
  await Promise.all(tasks);
}

async function broadcastResetState(enabled) {
  const tabs = await chrome.tabs.query({});
  const tasks = tabs
    .filter((tab) => typeof tab.id === "number")
    .map((tab) =>
      chrome.tabs
        .sendMessage(tab.id, {
          action: "blockshieldResetState",
          enabled: Boolean(enabled)
        })
        .catch(() => undefined)
    );
  await Promise.all(tasks);
}

async function resetExtensionStorage() {
  await storageSet({ ...DEFAULT_OPTIONS });
  await storageLocalRemove([SIMILARITY_INDEX_KEY]);
  await broadcastOptionsChanged();
  await broadcastResetState(DEFAULT_OPTIONS.enabled);
}

async function verifyImagePayload({ fingerprints, pageUrl }) {
  const options = { ...DEFAULT_OPTIONS, ...(await storageGet(DEFAULT_OPTIONS)) };
  if (!options.enabled) return { status: "disabled" };

  const normalizedFingerprints = normalizeFingerprints(fingerprints);
  if (!normalizedFingerprints.length) {
    return { status: "skipped", reason: "hash-unavailable" };
  }
  const pageScope = buildScopeFromPageUrl(pageUrl, true);
  const hostScope = buildScopeFromPageUrl(pageUrl, false);

  const exact = await findExactMatch(options, normalizedFingerprints, pageScope, hostScope);
  if (exact) {
    return exact;
  }

  const fromIndexer = await findNearestSimilarByIndexer(
    normalizedFingerprints,
    options.similarityThreshold,
    options.indexerUrl
  );
  const nearest = fromIndexer || (await findNearestSimilar(normalizedFingerprints, options.similarityThreshold));
  if (nearest) {
    return {
      status: "similar_suspect",
      pHash: normalizedFingerprints[0],
      creator: nearest.creator,
      similarTo: nearest.pHash,
      distance: nearest.distance
    };
  }

  return { status: "unregistered", pHash: normalizedFingerprints[0] };
}

function normalizeFingerprints(fingerprints) {
  if (!Array.isArray(fingerprints)) return [];
  const seen = new Set();
  const normalized = [];
  for (const hash of fingerprints) {
    if (typeof hash !== "string") continue;
    const lower = hash.toLowerCase();
    if (!/^0x[0-9a-f]{64}$/.test(lower)) continue;
    if (seen.has(lower)) continue;
    seen.add(lower);
    normalized.push(lower);
  }
  return normalized;
}

async function findExactMatch(options, fingerprints, pageScope, hostScope) {
  let scopeMismatch = null;
  for (const pHash of fingerprints) {
    const content = await readContent(options, pHash);
    if (!content.exists) continue;

    await upsertSimilarityIndexEntry(pHash, content.creator);

    const allowedPage = await isScopeAllowed(options, pHash, pageScope);
    const allowedHost = pageScope === hostScope ? allowedPage : await isScopeAllowed(options, pHash, hostScope);
    if (allowedPage || allowedHost) {
      return {
        status: "original",
        pHash,
        creator: content.creator,
        createdAt: content.createdAt,
        matchedScope: allowedPage ? pageScope : hostScope
      };
    }

    if (!scopeMismatch) {
      scopeMismatch = {
        pHash,
        creator: content.creator,
        createdAt: content.createdAt
      };
    }
  }

  if (!scopeMismatch) return null;
  return {
    status: options.scopePolicy === "neutral" ? "scope_mismatch" : "suspicious",
    ...scopeMismatch
  };
}

async function findNearestSimilar(fingerprints, thresholdInput) {
  const index = await getSimilarityIndex();
  if (!index.length) return null;

  const threshold = clampThreshold(thresholdInput);
  let best = null;
  for (const fp of fingerprints) {
    for (const entry of index) {
      const distance = hammingDistance(fp, entry.pHash);
      if (distance > threshold) continue;
      if (!best || distance < best.distance) {
        best = {
          pHash: entry.pHash,
          creator: entry.creator,
          distance
        };
      }
    }
  }
  return best;
}

async function findNearestSimilarByIndexer(fingerprints, thresholdInput, indexerUrl) {
  const endpoint = normalizeIndexerUrl(indexerUrl);
  if (!endpoint) return null;

  try {
    const threshold = clampThreshold(thresholdInput);
    const res = await fetch(`${endpoint}/match`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fingerprints, threshold })
    });
    if (!res.ok) return null;
    const payload = await res.json();
    if (!payload?.ok || !payload.match) return null;
    const match = payload.match;
    if (typeof match.indexedFingerprint !== "string") return null;
    if (typeof match.creator !== "string") return null;
    if (!Number.isFinite(Number(match.distance))) return null;
    return {
      pHash: match.indexedFingerprint.toLowerCase(),
      creator: match.creator.toLowerCase(),
      distance: Math.trunc(Number(match.distance))
    };
  } catch {
    return null;
  }
}

function normalizeIndexerUrl(url) {
  if (typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (!/^https?:\/\//i.test(trimmed)) return null;
  try {
    const parsed = new URL(trimmed);
    parsed.pathname = parsed.pathname.replace(/\/+$/, "");
    parsed.hash = "";
    parsed.search = "";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function clampThreshold(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 16;
  if (num < 0) return 0;
  if (num > 64) return 64;
  return Math.trunc(num);
}

function hammingDistance(a, b) {
  let xor = BigInt(a) ^ BigInt(b);
  let count = 0;
  while (xor > 0n) {
    xor &= xor - 1n;
    count++;
  }
  return count;
}

async function getSimilarityIndex() {
  const data = await storageLocalGet({ [SIMILARITY_INDEX_KEY]: [] });
  const raw = data[SIMILARITY_INDEX_KEY];
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (item) =>
      item &&
      typeof item.pHash === "string" &&
      /^0x[0-9a-f]{64}$/.test(item.pHash) &&
      typeof item.creator === "string"
  );
}

async function upsertSimilarityIndexEntry(pHash, creator) {
  const index = await getSimilarityIndex();
  const now = Date.now();
  const normalizedCreator = (creator || "").toLowerCase();
  const idx = index.findIndex((item) => item.pHash === pHash);
  if (idx >= 0) {
    index[idx] = { ...index[idx], creator: normalizedCreator, updatedAt: now };
  } else {
    index.unshift({ pHash, creator: normalizedCreator, updatedAt: now });
  }
  if (index.length > MAX_INDEX_SIZE) {
    index.length = MAX_INDEX_SIZE;
  }
  await storageLocalSet({ [SIMILARITY_INDEX_KEY]: index });
}

function buildScopeFromPageUrl(pageUrl, includePath) {
  const parsed = new URL(pageUrl);
  const host = parsed.hostname.toLowerCase();
  if (!includePath) return host;
  let pathname = (parsed.pathname || "").toLowerCase();
  while (pathname.length > 1 && pathname.endsWith("/")) pathname = pathname.slice(0, -1);
  if (pathname === "/") pathname = "";
  return `${host}${pathname}`;
}

async function readContent(options, pHash) {
  const data = SELECTORS.getContent + encodeBytes32(pHash);
  const response = await ethCall(options.rpcUrl, options.contractAddress, data);

  if (response.error) {
    const revertData = (response.error.data || "").toLowerCase();
    if (revertData.startsWith(ERROR_SELECTORS.contentNotExists)) {
      return { exists: false };
    }
    throw new Error(response.error.message || "getContent 호출에 실패했습니다.");
  }

  const result = response.result || "0x";
  if (result.length < 2 + 64 * 4) {
    throw new Error("예상하지 못한 getContent 응답입니다.");
  }

  const creator = `0x${readWord(result, 0).slice(24)}`;
  const createdAt = Number(BigInt(`0x${readWord(result, 2)}`));
  const isActive = BigInt(`0x${readWord(result, 3)}`) === 1n;
  return { exists: creator !== ZERO_ADDRESS, creator, createdAt, isActive };
}

async function isScopeAllowed(options, pHash, scope) {
  const encodedScopeArg = encodeStringArg(scope);
  const data = SELECTORS.isScopeWhitelisted + encodeBytes32(pHash) + encodedScopeArg;
  const response = await ethCall(options.rpcUrl, options.contractAddress, data);
  if (response.error) return false;
  const word = readWord(response.result || "0x", 0);
  return BigInt(`0x${word}`) === 1n;
}

async function ethCall(rpcUrl, to, data) {
  const body = {
    jsonrpc: "2.0",
    id: Date.now(),
    method: "eth_call",
    params: [{ to, data }, "latest"]
  };
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    throw new Error(`RPC 요청에 실패했습니다. (HTTP ${res.status})`);
  }
  return res.json();
}

function encodeBytes32(value) {
  if (typeof value !== "string" || !value.startsWith("0x")) {
    throw new Error("bytes32 값은 0x로 시작하는 hex 형식이어야 합니다.");
  }
  const hex = value.slice(2).toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(hex)) {
    throw new Error("유효하지 않은 bytes32 값입니다.");
  }
  return hex;
}

function encodeStringArg(value) {
  const bytes = new TextEncoder().encode(value);
  const headOffset = pad32("40");
  const len = pad32(bytes.length.toString(16));
  const dataHex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  const paddedData = dataHex.padEnd(Math.ceil(dataHex.length / 64) * 64, "0");
  return headOffset + len + paddedData;
}

function pad32(hexWithoutPrefix) {
  return hexWithoutPrefix.padStart(64, "0");
}

function readWord(hexData, index) {
  const clean = hexData.startsWith("0x") ? hexData.slice(2) : hexData;
  const start = index * 64;
  const end = start + 64;
  if (clean.length < end) return "".padStart(64, "0");
  return clean.slice(start, end);
}

function storageGet(keys) {
  return new Promise((resolve) => {
    chrome.storage.sync.get(keys, (result) => resolve(result));
  });
}

function storageSet(values) {
  return new Promise((resolve) => {
    chrome.storage.sync.set(values, resolve);
  });
}

function storageLocalGet(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, (result) => resolve(result));
  });
}

function storageLocalSet(values) {
  return new Promise((resolve) => {
    chrome.storage.local.set(values, resolve);
  });
}

function storageLocalRemove(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.remove(keys, resolve);
  });
}

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
