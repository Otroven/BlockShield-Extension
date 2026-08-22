import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import net from "node:net";
import { stopDevPorts } from "./dev-ports.mjs";

const INDEX_DB_PATH = "indexer/data/index.json";

function log(message) {
  process.stdout.write(`${message}\n`);
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      shell: process.platform === "win32",
      ...options,
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(stderr || `${command} exited with code ${code}`));
      }
    });
  });
}

function isPortOpen(host, port, timeoutMs = 800) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let done = false;
    const finish = (value) => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
    socket.connect(port, host);
  });
}

async function waitForPort(host, port, timeoutMs = 25000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isPortOpen(host, port)) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function removeIndexerDb() {
  if (!existsSync(INDEX_DB_PATH)) return;
  await rm(INDEX_DB_PATH, { force: true });
  log("[reset] removed indexer/data/index.json");
}

function startDetached(command, args, env = process.env) {
  const child = spawn(command, args, {
    detached: true,
    stdio: "ignore",
    shell: process.platform === "win32",
    env,
  });
  child.unref();
}

async function main() {
  log("[reset] cleaning ports and old dev processes...");
  await stopDevPorts((message) => log(message.replace("[stop]", "[reset]")));

  await removeIndexerDb();

  log("[reset] deploying chain and contract...");
  await run("npm", ["run", "chain:deploy"], { stdio: "inherit" });

  log("[reset] starting indexer...");
  startDetached("npm", ["run", "indexer:start"]);

  const ready = await waitForPort("127.0.0.1", 8787, 20000);
  if (!ready) {
    throw new Error("Indexer failed to open port 8787 in time.");
  }
  log("[reset] indexer is ready on http://127.0.0.1:8787");

  log("[reset] starting frontend (foreground)...");
  await run("npm", ["run", "frontend:dev"], { stdio: "inherit" });
}

main().catch((error) => {
  process.stderr.write(`[reset] ${error.message}\n`);
  process.exit(1);
});
