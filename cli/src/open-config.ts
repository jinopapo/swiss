import { fileURLToPath } from "node:url";
import path from "node:path";
import net from "node:net";
import { type ChildProcess, spawn } from "node:child_process";

const START_PORT = 3000;
const END_PORT = 3999;
const BOOT_TIMEOUT_MS = 30_000;
const BOOT_POLL_MS = 500;

export async function openConfigUi(): Promise<void> {
  const port = await findAvailablePort(START_PORT, END_PORT);
  const url = `http://localhost:${port}/`;
  const webServer = startWebServer(port);
  const cleanupSignalHandlers = setupSignalHandlers(webServer);

  try {
    await waitUntilReachable(url, BOOT_TIMEOUT_MS, BOOT_POLL_MS, webServer);
    await openInBrowser(url);
    console.log(`設定UIを起動しました: ${url}`);
    console.log("終了するには Ctrl-C を押してください");

    const exitCode = await waitForProcessExit(webServer);
    if ((exitCode ?? 0) !== 0) {
      throw new Error(`設定UIサーバーが終了しました (exit code: ${exitCode ?? "null"})`);
    }
  } catch (error) {
    await terminateWebServer(webServer, "SIGTERM");
    throw error;
  } finally {
    cleanupSignalHandlers();
  }
}

async function findAvailablePort(start: number, end: number): Promise<number> {
  for (let port = start; port <= end; port += 1) {
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

function startWebServer(port: number): ChildProcess {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const projectRoot = path.resolve(moduleDir, "..", "..");
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  const baseDir = process.cwd();
  const detached = process.platform !== "win32";

  return spawn(npmCommand, ["run", "-w", "web", "dev", "--", "--port", String(port)], {
    cwd: projectRoot,
    env: {
      ...process.env,
      SWISS_BASE_DIR: baseDir,
    },
    detached,
    stdio: "inherit",
  });
}

async function waitUntilReachable(
  url: string,
  timeoutMs: number,
  intervalMs: number,
  webServer: ChildProcess,
): Promise<void> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (webServer.exitCode !== null) {
      throw new Error(`設定UIサーバーが終了しました (exit code: ${webServer.exitCode})`);
    }

    if (await isHttpReachable(url)) {
      return;
    }
    await sleep(intervalMs);
  }

  throw new Error(`設定UIの起動を確認できませんでした: ${url}`);
}

function setupSignalHandlers(webServer: ChildProcess): () => void {
  let isShuttingDown = false;
  const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];

  const handlers = signals.map((signal) => {
    const handler = () => {
      if (isShuttingDown) {
        return;
      }
      isShuttingDown = true;

      void (async () => {
        console.log("\n設定UIサーバーを停止しています...");
        await terminateWebServer(webServer, signal);
        process.exit(signal === "SIGINT" ? 130 : 143);
      })();
    };

    process.on(signal, handler);
    return { signal, handler };
  });

  return () => {
    for (const { signal, handler } of handlers) {
      process.off(signal, handler);
    }
  };
}

async function terminateWebServer(webServer: ChildProcess, signal: NodeJS.Signals): Promise<void> {
  if (webServer.exitCode !== null) {
    return;
  }

  const exitPromise = waitForProcessExit(webServer);

  sendSignal(webServer, signal);
  if (await waitForExitWithTimeout(exitPromise, 5_000)) {
    return;
  }

  sendSignal(webServer, "SIGKILL");
  await waitForExitWithTimeout(exitPromise, 2_000);
}

function sendSignal(webServer: ChildProcess, signal: NodeJS.Signals): void {
  if (webServer.exitCode !== null) {
    return;
  }

  try {
    if (process.platform !== "win32" && webServer.pid) {
      process.kill(-webServer.pid, signal);
      return;
    }

    webServer.kill(signal);
  } catch {
    // すでに終了している場合は無視
  }
}

function waitForProcessExit(webServer: ChildProcess): Promise<number | null> {
  if (webServer.exitCode !== null) {
    return Promise.resolve(webServer.exitCode);
  }

  return new Promise((resolve, reject) => {
    webServer.once("error", (error) => {
      reject(error);
    });

    webServer.once("exit", (code) => {
      resolve(code);
    });
  });
}

async function waitForExitWithTimeout(exitPromise: Promise<number | null>, timeoutMs: number): Promise<boolean> {
  return Promise.race([
    exitPromise.then(() => true, () => true),
    sleep(timeoutMs).then(() => false),
  ]);
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