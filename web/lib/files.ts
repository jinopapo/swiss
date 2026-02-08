import fs from "node:fs/promises";
import path from "node:path";

const baseDir = process.cwd();

function configPath() {
  return path.join(baseDir, "..", ".swiss", "swiss.yaml");
}

function promptsDir() {
  return path.join(baseDir, "..", ".swiss", "prompts");
}

export async function readConfigFile(): Promise<string> {
  try {
    return await fs.readFile(configPath(), "utf8");
  } catch {
    return "";
  }
}

export async function writeConfigFile(content: string): Promise<void> {
  await fs.mkdir(path.dirname(configPath()), { recursive: true });
  await fs.writeFile(configPath(), content, "utf8");
}

export async function listPrompts(): Promise<{ name: string; content: string }[]> {
  try {
    const dir = promptsDir();
    await fs.mkdir(dir, { recursive: true });
    const files = await fs.readdir(dir);
    const prompts = await Promise.all(
      files
        .filter((file) => file.endsWith(".md"))
        .map(async (file) => {
          const content = await fs.readFile(path.join(dir, file), "utf8");
          return { name: file.replace(/\.md$/, ""), content };
        })
    );
    return prompts;
  } catch {
    return [];
  }
}

export async function writePromptFile(name: string, content: string): Promise<void> {
  const dir = promptsDir();
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, `${name}.md`), content, "utf8");
}