import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
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

function workflowConfigPath(baseDir: string, workflowName: string): string {
  return path.join(flowsDir(baseDir), `${workflowName}.yaml`);
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

export async function loadBuiltInPrompt(kind: "text" | "diff"): Promise<string> {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const promptPath = path.resolve(moduleDir, "..", "prompts", `${kind}.md`);
  return fs.readFile(promptPath, "utf8");
}