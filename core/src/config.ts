import fs from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import { z } from "zod";
import type { SwissConfig } from "./types.js";

const reviewSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  model: z.string().optional(),
  parallel: z.boolean().optional(),
});

const configSchema = z.object({
  model: z.string().min(1),
  reviews: z.array(reviewSchema).min(1),
});

const workflowNameSchema = z
  .string()
  .min(1)
  .regex(/^[a-zA-Z0-9_-]+$/, "workflow名は英数字・ハイフン・アンダースコアのみ使用できます");

function flowsDir(baseDir: string): string {
  return path.join(baseDir, ".swiss", "flows");
}

function contextsDir(baseDir: string): string {
  return path.join(baseDir, ".swiss", "contexts");
}

function workflowConfigPath(baseDir: string, workflowName: string): string {
  return path.join(flowsDir(baseDir), `${workflowName}.yaml`);
}

function workflowContextPath(baseDir: string, workflowName: string): string {
  return path.join(contextsDir(baseDir), `${workflowName}.md`);
}

export async function loadWorkflowConfig(baseDir: string, workflowName: string): Promise<SwissConfig> {
  const normalizedWorkflowName = workflowNameSchema.parse(workflowName);
  const configPath = workflowConfigPath(baseDir, normalizedWorkflowName);
  const raw = await fs.readFile(configPath, "utf8");
  const parsed = YAML.parse(raw);
  return configSchema.parse(parsed);
}

export async function listWorkflows(baseDir: string): Promise<string[]> {
  try {
    const files = await fs.readdir(flowsDir(baseDir));
    return files
      .filter((file) => file.endsWith(".yaml"))
      .map((file) => file.replace(/\.yaml$/, ""))
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

export async function loadPrompt(baseDir: string, name: string): Promise<string> {
  const promptPath = path.join(baseDir, ".swiss", "prompts", `${name}.md`);
  return fs.readFile(promptPath, "utf8");
}

export async function loadWorkflowContext(baseDir: string, workflowName: string): Promise<string> {
  const normalizedWorkflowName = workflowNameSchema.parse(workflowName);
  const contextPath = workflowContextPath(baseDir, normalizedWorkflowName);
  try {
    const context = await fs.readFile(contextPath, "utf8");
    if (!context.trim()) {
      throw new Error(`workflow context が空です: .swiss/contexts/${normalizedWorkflowName}.md`);
    }
    return context;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`設定ファイルが見つかりません: .swiss/contexts/${normalizedWorkflowName}.md`);
    }
    throw error;
  }
}