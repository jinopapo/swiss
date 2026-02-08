import { fileURLToPath } from "node:url";
import path from "node:path";
import net from "node:net";
import { spawn } from "node:child_process";

const START_PORT = 3000;
const END_PORT = 3999;
const BOOT_TIMEOUT_MS = 30_000;
const BOOT_POLL_MS = 500;

export async function openConfigUi(): Promise<void> {
  const port = await findAvailablePort(START_PORT, END_PORT);
  const url = `http://localhost:${port}/`;

  startWebServer(port);
  await waitUntilReachable(url, BOOT_TIMEOUT_MS, BOOT_POLL_MS);
  await openInBrowser(url);
}

async function findAvailablePort(start: number, end: number): Promise<number> {
  for (let port = start; port <= end; port += 1) {
    // eslint-disable-next-line no-await-in-loop
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`利用可能なポートが見つかりませんでした (${start}-${end})`);
}

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once("error", () => {
      resolve(false);
    });

    server.once("listening", () => {
      server.close(() => resolve(true));
    });

    server.listen(port, "127.0.0.1");
  });
}

function startWebServer(port: number): void {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const projectRoot = path.resolve(moduleDir, "..", "..");
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  const baseDir = process.cwd();

  const child = spawn(npmCommand, ["run", "-w", "web", "dev", "--", "--port", String(port)], {
    cwd: projectRoot,
    env: {
      ...process.env,
      SWISS_BASE_DIR: baseDir,
    },
    detached: true,
    stdio: "ignore",
  });

  child.unref();
}

async function waitUntilReachable(url: string, timeoutMs: number, intervalMs: number): Promise<void> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    // eslint-disable-next-line no-await-in-loop
    if (await isHttpReachable(url)) {
      return;
    }
    // eslint-disable-next-line no-await-in-loop
    await sleep(intervalMs);
  }

  throw new Error(`設定UIの起動を確認できませんでした: ${url}`);
}

async function isHttpReachable(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(2_000),
    });
    return response.status > 0;
  } catch {
    return false;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function openInBrowser(url: string): Promise<void> {
  if (process.platform === "darwin") {
    await spawnAndWait("open", [url]);
    return;
  }

  if (process.platform === "win32") {
    await spawnAndWait("cmd", ["/c", "start", "", url]);
    return;
  }

  await spawnAndWait("xdg-open", [url]);
}

function spawnAndWait(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "ignore" });

    child.once("error", (error) => {
      reject(error);
    });

    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} の実行に失敗しました (exit code: ${code ?? "null"})`));
    });
  });
}