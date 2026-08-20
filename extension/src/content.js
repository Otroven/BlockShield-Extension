const BADGE_ATTR = "data-blockshield-badge";
const SCANNED_ATTR = "data-blockshield-scanned";
const TOOLTIP_ID = "blockshield-tooltip";
const SCAN_OVERLAY_ID = "blockshield-scan-overlay";
const SCAN_STYLE_ID = "blockshield-scan-style";

const BADGE_STYLE_BY_STATUS = {
  checking: { bg: "#1d4ed8", fg: "#ffffff", text: "BlockShield | 검증 중" },
  original: { bg: "#15803d", fg: "#ffffff", text: "BlockShield | 원본 확인" },
  suspicious: { bg: "#b91c1c", fg: "#ffffff", text: "BlockShield | 도용 의심" },
  unregistered: { bg: "#475569", fg: "#ffffff", text: "BlockShield | 미등록" },
  error: { bg: "#c2410c", fg: "#ffffff", text: "BlockShield | 검증 실패" },
  skipped: { bg: "#334155", fg: "#ffffff", text: "BlockShield | 건너뜀" },
};

let extensionEnabled = true;

chrome.runtime.onMessage.addListener((message) => {
  if (message?.action === "blockshieldRescan") {
    runManualPageScan();
    return;
  }
  if (message?.action === "blockshieldOptionsChanged") {
    extensionEnabled = Boolean(message.enabled);
    if (!extensionEnabled) {
      clearAllBadges();
    }
  }
});

bootstrap();

function bootstrap() {
  chrome.storage.sync.get({ enabled: true }, (result) => {
    extensionEnabled = Boolean(result.enabled);
    if (!extensionEnabled) {
      clearAllBadges();
    }
  });
}

function scanImages({ reset }) {
  if (!extensionEnabled) {
    if (reset) clearAllBadges();
    return;
  }

  const images = Array.from(document.querySelectorAll("img"));
  const tasks = [];
  for (const img of images) {
    if (reset) {
      img.removeAttribute(SCANNED_ATTR);
      removeBadge(img);
    }
    if (img.hasAttribute(SCANNED_ATTR)) continue;
    img.setAttribute(SCANNED_ATTR, "1");
    const task = verifyImage(img).catch((error) => {
      upsertBadge(img, "error", error.message || "Verification failed.");
    });
    tasks.push(task);
  }
  return Promise.allSettled(tasks).then(() => tasks.length);
}

async function verifyImage(img) {
  if (!extensionEnabled) {
    removeBadge(img);
    return;
  }

  await waitForImageReady(img);

  const src = img.currentSrc || img.src || "";
  if (!src) {
    upsertBadge(img, "skipped", "이미지 소스(URL)가 비어 있습니다.");
    return;
  }
  if (img.naturalWidth < 32 || img.naturalHeight < 32) {
    upsertBadge(
      img,
      "skipped",
      "이미지 크기가 너무 작아 신뢰 가능한 지문 계산이 어렵습니다. (최소 32x32)",
    );
    return;
  }

  upsertBadge(img, "checking", "");
  let pHashBytes32 = "";
  try {
    pHashBytes32 = await computePerceptualHashBytes32WithPhashJs(img, src);
  } catch (error) {
    upsertBadge(img, "error", error?.message || "pHash 검증에 실패했습니다.");
    return;
  }

  const response = await sendMessage({
    action: "verifyImagePayload",
    imageUrl: src,
    pHashBytes32,
    pageUrl: window.location.href,
  });

  if (!response?.ok) {
    throw new Error(response?.error || "Verification request failed.");
  }

  const result = response.result;
  if (result.status === "disabled") {
    removeBadge(img);
    return;
  }

  if (result.status === "original") {
    upsertBadge(
      img,
      "original",
      `이 글의 저자가 이미지의 원작자가 맞습니다.\n\n원작자(주소) : ${result.creator || "-"}\n`,
    );
    return;
  }

  if (result.status === "suspicious") {
    upsertBadge(
      img,
      "suspicious",
      `이 글의 저자는 이미지의 원작자가 아닌 것으로 보입니다.\n\n원작자(주소) : ${result.creator || "-"}\n`,
    );
    return;
  }

  if (result.status === "unregistered") {
    upsertBadge(
      img,
      "unregistered",
      `온체인에 등록된 원본 정보를 찾지 못했습니다.\n\n원작자(주소) : 확인 불가\n`,
    );
    return;
  }

  upsertBadge(img, "skipped", formatSkippedReason(result.reason));
}

function upsertBadge(img, status, detailText) {
  const style = BADGE_STYLE_BY_STATUS[status] || BADGE_STYLE_BY_STATUS.error;
  const parent = ensurePositionedParent(img);
  let badge = parent.querySelector(`[${BADGE_ATTR}="1"]`);
  if (!badge) {
    badge = document.createElement("div");
    badge.setAttribute(BADGE_ATTR, "1");
    badge.style.position = "absolute";
    badge.style.left = "8px";
    badge.style.top = "8px";
    badge.style.zIndex = "2147483646";
    badge.style.padding = "6px 10px";
    badge.style.borderRadius = "999px";
    badge.style.font = "600 11px/1.2 Inter, Arial, sans-serif";
    badge.style.letterSpacing = "0.2px";
    badge.style.border = "1px solid rgba(255,255,255,0.25)";
    badge.style.boxShadow = "0 8px 20px rgba(0,0,0,0.25)";
    badge.style.backdropFilter = "blur(4px)";
    badge.style.pointerEvents = "auto";
    badge.style.cursor = "help";
    badge.style.userSelect = "none";
    attachTooltipHandlers(badge);
    parent.appendChild(badge);
  }
  badge.textContent = style.text;
  badge.dataset.tooltip = detailText || style.text;
  badge.style.background = style.bg;
  badge.style.color = style.fg;
}

function removeBadge(img) {
  const parent = img.parentElement;
  if (!parent) return;
  const badge = parent.querySelector(`[${BADGE_ATTR}="1"]`);
  if (badge) badge.remove();
}

function clearAllBadges() {
  hideTooltip();
  const badges = Array.from(document.querySelectorAll(`[${BADGE_ATTR}="1"]`));
  for (const badge of badges) {
    badge.remove();
  }

  const images = Array.from(document.querySelectorAll("img"));
  for (const img of images) {
    img.removeAttribute(SCANNED_ATTR);
  }
}

function attachTooltipHandlers(badge) {
  if (badge.dataset.tooltipBound === "1") return;
  badge.dataset.tooltipBound = "1";
  badge.addEventListener("mouseenter", (event) => {
    showTooltip(event.currentTarget.dataset.tooltip || "", event);
  });
  badge.addEventListener("mousemove", (event) => {
    moveTooltip(event);
  });
  badge.addEventListener("mouseleave", () => {
    hideTooltip();
  });
}

function getTooltipNode() {
  let node = document.getElementById(TOOLTIP_ID);
  if (node) return node;
  node = document.createElement("div");
  node.id = TOOLTIP_ID;
  node.style.position = "fixed";
  node.style.maxWidth = "300px";
  node.style.padding = "10px 12px";
  node.style.borderRadius = "10px";
  node.style.background = "rgba(15, 23, 42, 0.96)";
  node.style.color = "#ffffff";
  node.style.font = "500 12px/1.45 Inter, Arial, sans-serif";
  node.style.whiteSpace = "pre-line";
  node.style.boxShadow = "0 10px 30px rgba(0, 0, 0, 0.35)";
  node.style.zIndex = "2147483647";
  node.style.pointerEvents = "none";
  node.style.opacity = "0";
  node.style.transition = "opacity 120ms ease";
  document.body.appendChild(node);
  return node;
}

function showTooltip(text, mouseEvent) {
  if (!text) return;
  const node = getTooltipNode();
  node.textContent = text;
  moveTooltip(mouseEvent);
  node.style.opacity = "1";
}

function moveTooltip(mouseEvent) {
  const node = getTooltipNode();
  const margin = 12;
  const x = Math.min(
    mouseEvent.clientX + 14,
    window.innerWidth - node.offsetWidth - margin,
  );
  const y = Math.min(
    mouseEvent.clientY + 14,
    window.innerHeight - node.offsetHeight - margin,
  );
  node.style.left = `${Math.max(margin, x)}px`;
  node.style.top = `${Math.max(margin, y)}px`;
}

function hideTooltip() {
  const node = document.getElementById(TOOLTIP_ID);
  if (!node) return;
  node.style.opacity = "0";
}

function waitForImageReady(img) {
  if (img.complete && img.naturalWidth > 0 && img.naturalHeight > 0) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      img.removeEventListener("load", done);
      img.removeEventListener("error", done);
      resolve();
    };
    img.addEventListener("load", done, { once: true });
    img.addEventListener("error", done, { once: true });
    setTimeout(done, 1200);
  });
}

function formatSkippedReason(reason) {
  if (reason === "hash-unavailable") {
    return "이 이미지 소스에서 지문(pHash)을 생성할 수 없습니다.";
  }
  return reason || "검증을 건너뛰었습니다.";
}

async function runManualPageScan() {
  if (!extensionEnabled) {
    clearAllBadges();
    return;
  }

  const finishOverlay = showScanOverlay();
  try {
    const processedCount = await scanImages({ reset: true });
    finishOverlay(true, processedCount);
  } catch {
    finishOverlay(false, 0);
  }
}

function ensureScanStyle() {
  if (document.getElementById(SCAN_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = SCAN_STYLE_ID;
  style.textContent = `
    #${SCAN_OVERLAY_ID} {
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 2147483645;
      background: linear-gradient(to bottom, rgba(29, 78, 216, 0.06), rgba(29, 78, 216, 0.01));
      overflow: hidden;
    }
    #${SCAN_OVERLAY_ID} .scan-line {
      position: absolute;
      left: 0;
      right: 0;
      height: 4px;
      background: linear-gradient(90deg, rgba(29, 78, 216, 0.1), rgba(37, 99, 235, 0.85), rgba(29, 78, 216, 0.1));
      box-shadow: 0 0 18px rgba(37, 99, 235, 0.8);
      animation: blockshield-scan-sweep 1400ms ease-in-out infinite;
    }
    #${SCAN_OVERLAY_ID} .scan-label {
      position: absolute;
      right: 16px;
      top: 16px;
      background: rgba(15, 23, 42, 0.9);
      color: #fff;
      border: 1px solid rgba(148, 163, 184, 0.4);
      border-radius: 10px;
      padding: 8px 10px;
      font: 600 12px/1.2 Inter, Arial, sans-serif;
      letter-spacing: 0.2px;
    }
    @keyframes blockshield-scan-sweep {
      0% { transform: translateY(-20px); opacity: 0.1; }
      50% { opacity: 1; }
      100% { transform: translateY(calc(100vh + 20px)); opacity: 0.1; }
    }
  `;
  document.documentElement.appendChild(style);
}

function showScanOverlay() {
  ensureScanStyle();

  let overlay = document.getElementById(SCAN_OVERLAY_ID);
  if (overlay) overlay.remove();

  overlay = document.createElement("div");
  overlay.id = SCAN_OVERLAY_ID;

  const line = document.createElement("div");
  line.className = "scan-line";
  overlay.appendChild(line);

  const label = document.createElement("div");
  label.className = "scan-label";
  label.textContent = "페이지 검사 중...";
  overlay.appendChild(label);

  document.body.appendChild(overlay);

  return (ok, processedCount) => {
    label.textContent = ok
      ? `페이지 검사 완료 (${processedCount}개 이미지)`
      : "페이지 검사 중 오류가 발생했습니다.";
    setTimeout(() => {
      overlay.remove();
    }, 900);
  };
}

async function computePerceptualHashBytes32WithPhashJs(img, src) {
  const phash = await ensurePhashLibrary();
  const fileLike = await buildFileLikeForPhash(img, src);
  const hash = await phash.hash(fileLike);
  const binary =
    typeof hash?.toBinary === "function"
      ? hash.toBinary()
      : typeof hash?.value === "string"
        ? hash.value
        : "";

  if (!binary || !/^[01]+$/.test(binary)) {
    throw new Error("이 이미지 소스에서 pHash를 계산할 수 없습니다.");
  }

  return binaryToBytes32(binary);
}

async function ensurePhashLibrary() {
  if (window.pHash?.hash) return window.pHash;
  throw new Error(
    "phash-js를 사용할 수 없습니다. 확장을 다시 로드한 뒤 탭을 새로고침하세요.",
  );
}

async function buildFileLikeForPhash(img, src) {
  const directBlob = await fetchBlobFromSource(src);
  if (directBlob) return blobToFileLike(directBlob, src);

  const canvasBlob = await imageElementToBlob(img);
  if (canvasBlob) return blobToFileLike(canvasBlob, src);

  throw new Error(
    "브라우저 보안 정책으로 인해 이미지 소스에 접근할 수 없습니다.",
  );
}

async function fetchBlobFromSource(src) {
  try {
    const response = await fetch(src);
    if (!response.ok) return null;
    return await response.blob();
  } catch {
    return null;
  }
}

async function imageElementToBlob(img) {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || img.width || 8;
    canvas.height = img.naturalHeight || img.height || 8;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    return await new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/png");
    });
  } catch {
    return null;
  }
}

function blobToFileLike(blob, src) {
  const ext =
    guessExtensionFromBlob(blob) || guessExtensionFromSrc(src) || "png";
  const mime = blob.type || `image/${ext}`;
  return new File([blob], `blockshield-image.${ext}`, { type: mime });
}

function guessExtensionFromBlob(blob) {
  const type = blob?.type || "";
  if (type.includes("png")) return "png";
  if (type.includes("jpeg") || type.includes("jpg")) return "jpg";
  if (type.includes("webp")) return "webp";
  if (type.includes("gif")) return "gif";
  return "";
}

function guessExtensionFromSrc(src) {
  const match = /\.([a-zA-Z0-9]+)(?:[?#]|$)/.exec(src || "");
  if (!match) return "";
  return match[1].toLowerCase();
}

function binaryToBytes32(binary) {
  let hex = "";
  for (let i = 0; i < binary.length; i += 4) {
    const nibble = binary.slice(i, i + 4);
    hex += Number.parseInt(nibble, 2).toString(16);
  }
  return `0x${hex.padStart(64, "0")}`;
}

function ensurePositionedParent(img) {
  const parent = img.parentElement;
  if (!parent) return img;
  const computed = window.getComputedStyle(parent);
  if (computed.position === "static") {
    parent.style.position = "relative";
  }
  return parent;
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

function shorten(address) {
  if (!address || address.length < 10) return address || "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
