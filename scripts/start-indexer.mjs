import { spawn } from "node:child_process";

const DEFAULT_RPC_URL = "http://127.0.0.1:8545";
const DEFAULT_CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

function parseArgs(argv) {
  const args = { rpcUrl: "", contractAddress: "", port: "" };
  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];
    const next = argv[i + 1];
    if (current === "--rpc-url" && next) {
      args.rpcUrl = String(next).trim();
      i += 1;
      continue;
    }
    if (current === "--contract-address" && next) {
      args.contractAddress = String(next).trim();
      i += 1;
      continue;
    }
    if (current === "--port" && next) {
      args.port = String(next).trim();
      i += 1;
    }
  }
  return args;
}

function validateAddress(address) {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

function validateHttpUrl(url) {
  return /^https?:\/\//i.test(url);
}

function log(message) {
  process.stdout.write(`${message}\n`);
}

function run() {
  const cli = parseArgs(process.argv.slice(2));
  const rpcUrl = cli.rpcUrl || process.env.RPC_URL || DEFAULT_RPC_URL;
  const contractAddress =
    cli.contractAddress || process.env.CONTRACT_ADDRESS || DEFAULT_CONTRACT_ADDRESS;
  const port = cli.port || process.env.PORT || "";

  if (!validateHttpUrl(rpcUrl)) {
    throw new Error("RPC URL must start with http:// or https://");
  }
  if (!validateAddress(contractAddress)) {
    throw new Error("Contract address must be a valid 0x-prefixed 20-byte address.");
  }
  if (port && !/^\d+$/.test(port)) {
    throw new Error("PORT must be numeric.");
  }

  log(`[indexer] RPC_URL=${rpcUrl}`);
  log(`[indexer] CONTRACT_ADDRESS=${contractAddress}`);
  if (port) {
    log(`[indexer] PORT=${port}`);
  }

  const child = spawn("npm", ["--prefix", "indexer", "run", "dev"], {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: {
      ...process.env,
      RPC_URL: rpcUrl,
      CONTRACT_ADDRESS: contractAddress,
      ...(port ? { PORT: port } : {})
    }
  });

  child.on("error", (error) => {
    process.stderr.write(`[indexer] Failed to start: ${error.message}\n`);
    process.exit(1);
  });

  child.on("close", (code) => {
    process.exit(code ?? 0);
  });
}

try {
  run();
} catch (error) {
  process.stderr.write(`[indexer] ${error.message}\n`);
  process.exit(1);
}
