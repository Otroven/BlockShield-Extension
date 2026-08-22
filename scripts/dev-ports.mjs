import { spawn } from "node:child_process";

export const DEV_PORTS = [5173, 8787, 8545];

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      shell: process.platform === "win32",
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

async function getPidsByPort(port) {
  if (process.platform === "win32") {
    try {
      const { stdout } = await run("powershell", [
        "-NoProfile",
        "-Command",
        `Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess`,
      ]);
      return [...new Set(stdout.split(/\r?\n/).map((s) => s.trim()).filter(Boolean))];
    } catch {
      return [];
    }
  }
  try {
    const { stdout } = await run("lsof", ["-ti", `tcp:${port}`]);
    return [...new Set(stdout.split(/\r?\n/).map((s) => s.trim()).filter(Boolean))];
  } catch {
    return [];
  }
}

async function killPid(pid) {
  if (process.platform === "win32") {
    await run("taskkill", ["/PID", pid, "/F"]);
    return;
  }
  await run("kill", ["-9", pid]);
}

export async function stopDevPorts(log = (message) => process.stdout.write(`${message}\n`)) {
  for (const port of DEV_PORTS) {
    const pids = await getPidsByPort(port);
    if (!pids.length) {
      log(`[stop] nothing listening on ${port}`);
      continue;
    }
    for (const pid of pids) {
      try {
        await killPid(pid);
        log(`[stop] killed pid=${pid} on port ${port}`);
      } catch {
        log(`[stop] failed to kill pid=${pid} on port ${port}`);
      }
    }
  }
}
