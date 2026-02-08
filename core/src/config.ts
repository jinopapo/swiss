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

export async function loadConfig(baseDir: string): Promise<SwissConfig> {
  const configPath = path.join(baseDir, ".swiss", "swiss.yaml");
  const raw = await fs.readFile(configPath, "utf8");
  const parsed = YAML.parse(raw);
  return configSchema.parse(parsed);
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