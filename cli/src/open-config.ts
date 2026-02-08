import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export async function openConfigUi(): Promise<void> {
  const url = "http://localhost:3000";
  const command = process.platform === "darwin" ? `open ${url}` : `xdg-open ${url}`;
  await execAsync(command);
}