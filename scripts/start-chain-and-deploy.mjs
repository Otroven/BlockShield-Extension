import net from "node:net";
import { spawn } from "node:child_process";
import { URL } from "node:url";

const rpcUrl = process.env.RPC_URL || "http://127.0.0.1:8545";
const privateKey =
  process.env.ANVIL_PRIVATE_KEY ||
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const contractDir = "contract/original-content";

function log(message) {
  process.stdout.write(`${message}\n`);
}

function spawnCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: process.platform === "win32",
      ...options
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} exited with code ${code}`));
      }
    });
  });
}

function isPortOpen(host, port, timeoutMs = 700) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;
    const done = (result) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
    socket.connect(port, host);
  });
}

async function waitForPort(host, port, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isPortOpen(host, port)) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

function startAnvilDetached(host, port) {
  const args = ["--host", host, "--port", String(port)];
  if (process.platform === "win32") {
    const child = spawn("anvil", args, {
      detached: true,
      stdio: "ignore",
      shell: true
    });
    child.unref();
    return;
  }
  const child = spawn("anvil", args, {
    detached: true,
    stdio: "ignore"
  });
  child.unref();
}

async function main() {
  const parsed = new URL(rpcUrl);
  const host = parsed.hostname;
  const port = Number(parsed.port || "8545");

  const alive = await isPortOpen(host, port);
  if (!alive) {
    log(`[chain] Anvil is not running. Starting on ${host}:${port} ...`);
    startAnvilDetached(host, port);
    const ready = await waitForPort(host, port);
    if (!ready) {
      throw new Error("Anvil did not start within timeout.");
    }
    log("[chain] Anvil started.");
  } else {
    log(`[chain] Anvil already running on ${host}:${port}.`);
  }

  log("[chain] Deploying OriginalContent...");
  await spawnCommand(
    "forge",
    [
      "script",
      "script/DeployOriginalContent.s.sol:DeployOriginalContent",
      "--rpc-url",
      rpcUrl,
      "--broadcast",
      "--private-key",
      privateKey
    ],
    { cwd: contractDir }
  );
  log("[chain] Deployment finished.");
}

main().catch((error) => {
  process.stderr.write(`[chain] ${error.message}\n`);
  process.exit(1);
});
