const DEFAULT_OPTIONS = {
  enabled: true,
  contractAddress: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  rpcUrl: "http://127.0.0.1:8545"
};

const SELECTORS = {
  getContent: "0x5cc15001",
  isScopeWhitelisted: "0x4f649fd1"
};

const ERROR_SELECTORS = {
  contentNotExists: "0xc52993ed"
};

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

async function verifyImagePayload({ imageUrl, pHashBytes32, pageUrl }) {
  const options = { ...DEFAULT_OPTIONS, ...(await storageGet(DEFAULT_OPTIONS)) };
  if (!options.enabled) return { status: "disabled" };

  const pHash = pHashBytes32;
  if (!pHash) {
    return { status: "skipped", reason: "hash-unavailable" };
  }
  const pageScope = buildScopeFromPageUrl(pageUrl, true);
  const hostScope = buildScopeFromPageUrl(pageUrl, false);

  const content = await readContent(options, pHash);
  if (!content.exists) {
    return { status: "unregistered", pHash };
  }

  const allowedPage = await isScopeAllowed(options, pHash, pageScope);
  const allowedHost = pageScope === hostScope ? allowedPage : await isScopeAllowed(options, pHash, hostScope);

  return {
    status: allowedPage || allowedHost ? "original" : "suspicious",
    pHash,
    creator: content.creator,
    createdAt: content.createdAt,
    matchedScope: allowedPage ? pageScope : allowedHost ? hostScope : ""
  };
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

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
