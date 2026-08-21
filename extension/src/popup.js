const DEFAULT_OPTIONS = {
  enabled: true,
  scopePolicy: "strict",
  similarityThreshold: 10,
  contractAddress: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  rpcUrl: "http://127.0.0.1:8545",
  indexerUrl: "http://127.0.0.1:8787"
};

function getStorage(keys) {
  return new Promise((resolve) => {
    chrome.storage.sync.get(keys, (result) => resolve(result));
  });
}

function setStorage(values) {
  return new Promise((resolve) => {
    chrome.storage.sync.set(values, resolve);
  });
}

function sendMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(response);
    });
  });
}

async function withActiveTab(fn) {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tabs.length || !tabs[0].id) throw new Error("활성 탭을 찾을 수 없습니다.");
  return fn(tabs[0].id);
}

function setStatus(text, isError = false) {
  const statusNode = document.getElementById("statusText");
  statusNode.textContent = text;
  statusNode.style.color = isError ? "#b91c1c" : "#334155";
}

async function init() {
  const saved = await getStorage(DEFAULT_OPTIONS);
  const options = { ...DEFAULT_OPTIONS, ...saved };
  document.getElementById("enabled").checked = Boolean(options.enabled);
  document.getElementById("scopePolicy").value =
    options.scopePolicy === "neutral" ? "neutral" : "strict";
  document.getElementById("similarityThreshold").value = Number(options.similarityThreshold ?? 10);
  document.getElementById("contractAddress").value = options.contractAddress;
  document.getElementById("rpcUrl").value = options.rpcUrl;
  document.getElementById("indexerUrl").value = options.indexerUrl ?? "";
}

async function saveOptions() {
  const enabled = document.getElementById("enabled").checked;
  const scopePolicy = document.getElementById("scopePolicy").value;
  const similarityThreshold = Number(document.getElementById("similarityThreshold").value);
  const contractAddress = document.getElementById("contractAddress").value.trim();
  const rpcUrl = document.getElementById("rpcUrl").value.trim();
  const indexerUrl = document.getElementById("indexerUrl").value.trim();

  if (!contractAddress.startsWith("0x") || contractAddress.length !== 42) {
    setStatus("컨트랙트 주소 형식이 올바르지 않습니다.", true);
    return;
  }
  if (!/^https?:\/\//i.test(rpcUrl)) {
    setStatus("RPC URL은 http:// 또는 https:// 로 시작해야 합니다.", true);
    return;
  }
  if (indexerUrl && !/^https?:\/\//i.test(indexerUrl)) {
    setStatus("인덱서 URL은 http:// 또는 https:// 로 시작해야 합니다.", true);
    return;
  }
  if (scopePolicy !== "strict" && scopePolicy !== "neutral") {
    setStatus("스코프 불일치 표시 설정이 올바르지 않습니다.", true);
    return;
  }
  if (!Number.isFinite(similarityThreshold) || similarityThreshold < 0 || similarityThreshold > 64) {
    setStatus("유사도 임계값은 0~64 사이 정수여야 합니다.", true);
    return;
  }

  await setStorage({
    enabled,
    scopePolicy,
    similarityThreshold: Math.trunc(similarityThreshold),
    contractAddress,
    rpcUrl,
    indexerUrl
  });
  const response = await sendMessage({ action: "optionsUpdated" });
  if (!response?.ok) {
    throw new Error(response?.error || "열린 탭에 설정 반영에 실패했습니다.");
  }
  setStatus("저장되었습니다.");
}

async function rescanTab() {
  await withActiveTab(async (tabId) => {
    await chrome.tabs.sendMessage(tabId, { action: "blockshieldRescan" });
  });
  setStatus("현재 페이지 검사를 요청했습니다.");
}

async function resetExtensionStorage() {
  const confirmed = window.confirm(
    "확장 설정과 유사도 캐시를 기본값으로 초기화할까요?"
  );
  if (!confirmed) return;

  const response = await sendMessage({ action: "resetExtensionStorage" });
  if (!response?.ok) {
    throw new Error(response?.error || "확장 초기화에 실패했습니다.");
  }
  await init();
  setStatus("확장 설정/캐시를 초기화했습니다.");
}

document.getElementById("saveBtn").addEventListener("click", async () => {
  try {
    await saveOptions();
  } catch (error) {
    setStatus(error.message || "설정 저장에 실패했습니다.", true);
  }
});

document.getElementById("rescanBtn").addEventListener("click", async () => {
  try {
    await rescanTab();
  } catch (error) {
    setStatus(error.message || "페이지 검사 요청에 실패했습니다.", true);
  }
});

document.getElementById("resetBtn").addEventListener("click", async () => {
  try {
    await resetExtensionStorage();
  } catch (error) {
    setStatus(error.message || "초기화 요청에 실패했습니다.", true);
  }
});

init().catch((error) => setStatus(error.message || "초기화에 실패했습니다.", true));
