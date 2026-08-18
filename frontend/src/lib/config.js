export const CONTRACT_ADDRESS =
  import.meta.env.VITE_CONTRACT_ADDRESS ||
  "0x5FbDB2315678afecb367f032d93F642f64180aa3";

export const CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID || 31337);

export const RPC_URL = import.meta.env.VITE_RPC_URL || "http://127.0.0.1:8545";

export const CHAIN_NAME = import.meta.env.VITE_CHAIN_NAME || "BlockShield Local";

export function toHexChainId(chainId = CHAIN_ID) {
  return `0x${Number(chainId).toString(16)}`;
}

export function shortenAddress(address) {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
