const POSTS_KEY = "blockshield:react-posts:v2";
const WEB3_KEY = "blockshield:web3-settings:v2";

export function readPosts() {
  const raw = localStorage.getItem(POSTS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writePosts(posts) {
  localStorage.setItem(POSTS_KEY, JSON.stringify(posts));
}

export function readWeb3Settings() {
  const raw = localStorage.getItem(WEB3_KEY);
  if (!raw) return { contractAddress: "", chainId: "" };
  try {
    const parsed = JSON.parse(raw);
    return {
      contractAddress: parsed.contractAddress || "",
      chainId: parsed.chainId || "",
    };
  } catch {
    return { contractAddress: "", chainId: "" };
  }
}

export function writeWeb3Settings(next) {
  localStorage.setItem(WEB3_KEY, JSON.stringify(next));
}
