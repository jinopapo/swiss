import fs from "node:fs/promises";
import path from "node:path";

const baseDir = process.env.SWISS_BASE_DIR ?? process.cwd();
const WORKFLOW_NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

function flowsDir() {
  return path.join(baseDir, ".swiss", "flows");
}

function workflowConfigPath(workflow: string) {
  return path.join(flowsDir(), `${workflow}.yaml`);
}

function contextsDir() {
  return path.join(baseDir, ".swiss", "contexts");
}

function workflowContextPath(workflow: string) {
  return path.join(contextsDir(), `${workflow}.md`);
}

function normalizeWorkflowName(workflow: string): string {
  const normalized = workflow.trim();
  if (!normalized) {
    throw new Error("workflow 名は必須です");
  }
  if (!WORKFLOW_NAME_PATTERN.test(normalized)) {
    throw new Error(
      "workflow名は英数字・ハイフン・アンダースコアのみ使用できます"
    );
  }
  return normalized;
}

function promptsDir() {
  return path.join(baseDir, ".swiss", "prompts");
}

export async function listWorkflows(): Promise<string[]> {
  try {
    await fs.mkdir(flowsDir(), { recursive: true });
    const files = await fs.readdir(flowsDir());
    return files
      .filter((file) => file.endsWith(".yaml"))
      .map((file) => file.replace(/\.yaml$/, ""))
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

export async function readConfigFile(workflow: string): Promise<string> {
  const normalized = normalizeWorkflowName(workflow);
  try {
    return await fs.readFile(workflowConfigPath(normalized), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
    return "";
  }
}

export async function writeConfigFile(workflow: string, content: string): Promise<void> {
  const normalized = normalizeWorkflowName(workflow);
  await fs.mkdir(flowsDir(), { recursive: true });
  await fs.writeFile(workflowConfigPath(normalized), content, "utf8");
}

export async function renameWorkflow(from: string, to: string): Promise<void> {
  const fromName = normalizeWorkflowName(from);
  const toName = normalizeWorkflowName(to);

  if (fromName === toName) {
    throw new Error("変更前と変更後の workflow 名が同じです");
  }

  await fs.mkdir(flowsDir(), { recursive: true });

  const fromPath = workflowConfigPath(fromName);
  const toPath = workflowConfigPath(toName);
  const fromContextPath = workflowContextPath(fromName);
  const toContextPath = workflowContextPath(toName);

  try {
    await fs.access(fromPath);
  } catch {
    throw new Error(`workflow '${fromName}' が存在しません`);
  }

  try {
    await fs.access(toPath);
    throw new Error(`workflow '${toName}' はすでに存在します`);
  } catch (error) {
    if (error instanceof Error && error.message.includes("すでに存在します")) {
      throw error;
    }
  }

  await fs.rename(fromPath, toPath);

  await fs.mkdir(contextsDir(), { recursive: true });
  try {
    await fs.rename(fromContextPath, toContextPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
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

export async function readContextFile(workflow: string): Promise<string> {
  const normalized = normalizeWorkflowName(workflow);
  try {
    return await fs.readFile(workflowContextPath(normalized), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
    return "";
  }
}

export async function writeContextFile(workflow: string, content: string): Promise<void> {
  const normalized = normalizeWorkflowName(workflow);
  await fs.mkdir(contextsDir(), { recursive: true });
  await fs.writeFile(workflowContextPath(normalized), content, "utf8");
}