const PHASH_SCRIPT_URL = "https://cdn.jsdelivr.net/npm/phash-js/dist/phash.js";

let scriptPromise = null;

function ensurePhashLibrary() {
  if (window.pHash?.hash) return Promise.resolve(window.pHash);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = PHASH_SCRIPT_URL;
    script.async = true;
    script.onload = () => {
      if (!window.pHash?.hash) {
        reject(new Error("pHash library loaded but API is unavailable."));
        return;
      }
      resolve(window.pHash);
    };
    script.onerror = () => reject(new Error("Failed to load pHash library."));
    document.head.appendChild(script);
  });

  return scriptPromise;
}

function binaryToBytes32(binary) {
  let hex = "";
  for (let i = 0; i < binary.length; i += 4) {
    const nibble = binary.slice(i, i + 4);
    hex += parseInt(nibble, 2).toString(16);
  }
  return `0x${hex.padStart(64, "0")}`;
}

export async function computePerceptualHashFromFile(file) {
  const phash = await ensurePhashLibrary();
  const hash = await phash.hash(file);
  const binary =
    typeof hash?.toBinary === "function" ? hash.toBinary() : typeof hash?.value === "string" ? hash.value : "";

  if (!binary || !/^[01]+$/.test(binary)) {
    throw new Error("Failed to compute binary pHash.");
  }

  return {
    binary,
    bytes32: binaryToBytes32(binary),
  };
}
