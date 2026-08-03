import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@6.13.2/+esm";

const ABI = [
  "function nonces(address creator) view returns (uint256)",
  "function records(bytes32 pHash) view returns (address creator, bytes32 pHashOut, uint256 createdAt, bool isActive)",
  "function registerContent(bytes32 pHash,address creator,string[] allowedScopes,uint256 deadline,bytes signature) external",
  "function updateWhitelist(bytes32 pHash,string scope,bool allowed) external",
];

const CONTRACT_NAME = "OriginalContent";
const CONTRACT_VERSION = "1";

const ERROR_MESSAGES = {
  "0xa0248be7": "이미 온체인에 등록된 이미지입니다. (같은 pHash)",
  "0x63ca21fd": "서명 검증에 실패했습니다. 지갑/네트워크를 확인하세요.",
  "0x982e21b1": "서명 유효시간이 만료되었습니다. 다시 저장해 주세요.",
  "0x6add4913": "허용 URL 형식이 올바르지 않습니다.",
  "0xc4a7241e": "허용 URL이 비어 있습니다.",
  "0xad96a224": "등록되지 않은 콘텐츠입니다.",
  "0x91844ec3": "콘텐츠 작성자만 수정할 수 있습니다.",
  "0x7421d61a": "creator 주소가 올바르지 않습니다.",
  "0x3912b9b3": "pHash가 비어 있습니다.",
  "0xc52993ed": "콘텐츠를 찾을 수 없습니다.",
};

function humanizeContractError(error) {
  const raw = error?.shortMessage || error?.reason || error?.message || String(error || "");
  const data = error?.data || error?.info?.error?.data || error?.error?.data;
  const hex = typeof data === "string" ? data : data?.data;
  if (typeof hex === "string" && hex.startsWith("0x") && hex.length >= 10) {
    const selector = hex.slice(0, 10).toLowerCase();
    if (ERROR_MESSAGES[selector]) return ERROR_MESSAGES[selector];
  }

  const blob = `${raw} ${error?.info?.error?.message || ""} ${JSON.stringify(error?.info || {})}`;
  if (/already registered|ContentAlreadyRegistered|0xa0248be7/i.test(blob)) {
    return ERROR_MESSAGES["0xa0248be7"];
  }
  if (/invalid signature|InvalidSignature|0x63ca21fd/i.test(blob)) {
    return ERROR_MESSAGES["0x63ca21fd"];
  }
  if (/no data present|execution reverted/i.test(blob)) {
    return "온체인 등록이 거절되었습니다. 같은 이미지가 이미 등록됐거나, 계약/네트워크 설정을 확인하세요.";
  }
  if (/user rejected|ACTION_REJECTED|denied/i.test(blob)) {
    return "지갑에서 요청을 거절했습니다.";
  }
  if (/Wrong network/i.test(blob)) return raw;
  return raw.length > 180 ? `${raw.slice(0, 180)}…` : raw;
}

function validateHost(host, originalInput) {
  if (!host) throw new Error(`Invalid scope format: ${originalInput}`);
  if (!/^[a-z0-9.-]+$/.test(host)) throw new Error(`Invalid scope format: ${originalInput}`);
  if (host.startsWith(".") || host.endsWith(".")) throw new Error(`Invalid scope format: ${originalInput}`);
  if (host.endsWith("-")) throw new Error(`Invalid scope format: ${originalInput}`);
  const labels = host.split(".");
  for (const label of labels) {
    if (!label || label.startsWith("-") || label.endsWith("-") || label.length > 63) {
      throw new Error(`Invalid scope format: ${originalInput}`);
    }
  }
}

function validatePath(pathname, originalInput) {
  if (!pathname) return;
  if (!pathname.startsWith("/")) throw new Error(`Invalid scope format: ${originalInput}`);
  if (/\/\//.test(pathname)) throw new Error(`Invalid scope format: ${originalInput}`);
  if (!/^\/[a-z0-9._~/%-]*$/i.test(pathname)) throw new Error(`Invalid scope format: ${originalInput}`);
}

export function normalizeScope(input) {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Scope cannot be empty.");

  let parsed;
  try {
    const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    parsed = new URL(candidate);
  } catch {
    throw new Error(`Invalid scope format: ${input}`);
  }

  if (parsed.username || parsed.password || parsed.port || parsed.search || parsed.hash) {
    throw new Error(`Invalid scope format: ${input}`);
  }

  const host = parsed.host.toLowerCase();
  validateHost(host, input);

  let pathname = parsed.pathname || "";
  pathname = pathname.toLowerCase();
  while (pathname.length > 1 && pathname.endsWith("/")) pathname = pathname.slice(0, -1);
  if (pathname === "/") pathname = "";
  validatePath(pathname, input);

  return `${host}${pathname}`;
}

export function parseAllowedScopes(input) {
  return input
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map(normalizeScope);
}

export async function connectWallet() {
  if (!window.ethereum) throw new Error("MetaMask is not installed.");
  const provider = new ethers.BrowserProvider(window.ethereum);
  await provider.send("eth_requestAccounts", []);
  const signer = await provider.getSigner();
  const address = await signer.getAddress();
  const network = await provider.getNetwork();
  return { provider, signer, address, chainId: Number(network.chainId) };
}

/** Returns connected account if already authorized; does not open MetaMask prompt. */
export async function getConnectedWallet() {
  if (!window.ethereum) return null;
  const provider = new ethers.BrowserProvider(window.ethereum);
  const accounts = await provider.send("eth_accounts", []);
  if (!accounts?.length) return null;
  const signer = await provider.getSigner();
  const address = await signer.getAddress();
  const network = await provider.getNetwork();
  return { provider, signer, address, chainId: Number(network.chainId) };
}

export function buildPostScope(postId) {
  return normalizeScope(`${window.location.hostname}/post/${postId}`);
}

export async function updateContentScopes({
  contractAddress,
  expectedChainId,
  pHashBytes32,
  scopesToAdd = [],
  scopesToRemove = [],
}) {
  if (!ethers.isAddress(contractAddress)) throw new Error("Contract address is invalid.");
  try {
    const { signer, chainId } = await connectWallet();
    if (expectedChainId && Number(expectedChainId) !== chainId) {
      throw new Error(`Wrong network. Connected chainId=${chainId}, expected=${expectedChainId}.`);
    }

    const contract = new ethers.Contract(contractAddress, ABI, signer);
    let lastTxHash = "";

    for (const scope of scopesToAdd) {
      const tx = await contract.updateWhitelist(pHashBytes32, scope, true);
      await tx.wait();
      lastTxHash = tx.hash;
    }
    for (const scope of scopesToRemove) {
      const tx = await contract.updateWhitelist(pHashBytes32, scope, false);
      await tx.wait();
      lastTxHash = tx.hash;
    }

    return { txHash: lastTxHash, chainId };
  } catch (error) {
    throw new Error(humanizeContractError(error));
  }
}

export async function registerOriginalContent({
  contractAddress,
  expectedChainId,
  pHashBytes32,
  allowedScopes,
  deadlineSeconds = 600,
}) {
  if (!ethers.isAddress(contractAddress)) throw new Error("Contract address is invalid.");
  try {
    const { signer, address, chainId } = await connectWallet();
    if (expectedChainId && Number(expectedChainId) !== chainId) {
      throw new Error(`Wrong network. Connected chainId=${chainId}, expected=${expectedChainId}.`);
    }

    const contract = new ethers.Contract(contractAddress, ABI, signer);

    const existing = await contract.records(pHashBytes32);
    if (existing.creator && existing.creator !== ethers.ZeroAddress) {
      throw new Error("이미 등록된 이미지입니다.");
    }

    const nonce = await contract.nonces(address);
    const deadline = Math.floor(Date.now() / 1000) + deadlineSeconds;

    const domain = {
      name: CONTRACT_NAME,
      version: CONTRACT_VERSION,
      chainId,
      verifyingContract: contractAddress,
    };
    const types = {
      RegisterContent: [
        { name: "pHash", type: "bytes32" },
        { name: "creator", type: "address" },
        { name: "allowedScopesHash", type: "bytes32" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    };

    const scopeHashes = allowedScopes.map((scope) => ethers.keccak256(ethers.toUtf8Bytes(scope)));
    const allowedScopesHash = ethers.keccak256(ethers.concat(scopeHashes));

    const value = {
      pHash: pHashBytes32,
      creator: address,
      allowedScopesHash,
      nonce,
      deadline,
    };

    const signature = await signer.signTypedData(domain, types, value);
    const tx = await contract.registerContent(pHashBytes32, address, allowedScopes, deadline, signature);
    const receipt = await tx.wait();
    return {
      txHash: tx.hash,
      creator: address,
      chainId,
      blockNumber: receipt?.blockNumber ?? null,
    };
  } catch (error) {
    throw new Error(humanizeContractError(error));
  }
}
