import { Codex } from "@openai/codex-sdk";
import { z } from "zod";
import type { ReviewInput, ReviewResult, ReviewSpec, SwissConfig } from "./types.js";
import { loadBuiltInPrompt, loadPrompt } from "./config.js";

const reviewItemSchema = z.object({
  review: z.string(),
  score: z.number().int().min(0).max(100),
  filePath: z.string(),
  line: z.number().int().min(1),
});

const reviewResultSchema = z.object({
  results: z.array(reviewItemSchema),
});

const jsonSchema = {
  type: "object",
  description: "レビュー結果。ファイルと行番号ごとにスコアとレビュー内容を含む。",
  properties: {
    results: {
      type: "array",
      description: "レビュー結果の配列。",
      items: {
        type: "object",
        properties: {
          filePath: {
            type: "string",
            description: "レビュー対象のファイルパス。",
          },
          line: {
            type: "integer",
            description: "レビュー対象の行番号。",
          },
          review: {
            type: "string",
            description: "レビュー内容。修正に必要な指摘を含む必要がある",
          },
          score: {
            type: "integer",
            minimum: 0,
            maximum: 100,
            description: "スコア（0-100）。80超えは要対応",
          },
        },
        required: ["review", "score", "filePath", "line"],
        additionalProperties: false,
      },
    },
  },
  required: ["results"],
  additionalProperties: false,
} as const;

export type ReviewRunnerOptions = {
  baseDir: string;
  config: SwissConfig;
  input: ReviewInput;
};

export async function runReviews(
  opts: ReviewRunnerOptions
): Promise<{ results: ReviewResult[]; stopReason: "needs_action" | "completed" }>{
  const codex = new Codex({ apiKey: process.env.OPENAI_API_KEY });
  const results: ReviewResult[] = [];

  for (const review of opts.config.reviews) {
    const thread = codex.startThread({
      workingDirectory: opts.baseDir,
      skipGitRepoCheck: true,
      model: review.model ?? opts.config.model,
    });
    const result = await runSingleReview({
      thread,
      baseDir: opts.baseDir,
      input: opts.input,
      review,
      defaultModel: opts.config.model,
    });
    results.push(...result);
    if (result.length > 0) {
      return { results, stopReason: "needs_action" };
    }
  }

  return { results, stopReason: "completed" };
}

async function runSingleReview(args: {
  thread: ReturnType<Codex["startThread"]>;
  baseDir: string;
  input: ReviewInput;
  review: ReviewSpec;
  defaultModel: string;
}): Promise<ReviewResult[]> {
  const [userPrompt, builtInPrompt] = await Promise.all([
    loadPrompt(args.baseDir, args.review.name),
    loadBuiltInPrompt(args.input.kind),
  ]);
  const message = buildMessage({
    userPrompt,
    builtInPrompt,
    review: args.review,
    input: args.input,
  });

  const turn = await args.thread.run(message, {
    outputSchema: jsonSchema,
  });

  const rawParsed = JSON.parse(turn.finalResponse);
  const normalized = Array.isArray(rawParsed) ? { results: rawParsed } : rawParsed;
  const parsed = reviewResultSchema.parse(normalized);
  return parsed.results
    .filter((item) => item.score > 80)
    .map((item) => ({
      name: args.review.name,
      review: item.review,
      score: item.score,
      filePath: item.filePath,
      line: item.line,
    }));
}

function buildMessage(args: {
  userPrompt: string;
  builtInPrompt: string;
  review: ReviewSpec;
  input: ReviewInput;
}): string {
  const header = [`# ${args.review.name}`, args.review.description]
    .filter(Boolean)
    .join("\n");
  return [
    header,
    `入力種別: ${args.input.kind}`,
    args.input.content,
    "\n---\n",
    args.builtInPrompt,
    "\n---\n",
    args.userPrompt,
  ]
    .filter(Boolean)
    .join("\n");
}
