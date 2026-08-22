const PHASH_SCRIPT_URL = "/phash.js";

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
        reject(new Error("pHash 라이브러리를 불러왔지만 API를 사용할 수 없습니다."));
        return;
      }
      resolve(window.pHash);
    };
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error("pHash 라이브러리를 불러오지 못했습니다."));
    };
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
    throw new Error("이미지 pHash를 계산하지 못했습니다.");
  }

  return {
    binary,
    bytes32: binaryToBytes32(binary),
  };
}
