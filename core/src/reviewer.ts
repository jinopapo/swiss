import { Codex } from "@openai/codex-sdk";
import { z } from "zod";
import type { ReviewInput, ReviewResult, ReviewSpec, SwissConfig } from "./types.js";
import { loadPrompt } from "./config.js";

const reviewItemSchema = z.object({
  review: z.string(),
  score: z.number().int().min(0).max(100),
  filePath: z.string(),
  line: z.number().int().min(0),
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
            description: "スコア（0-100）。80超えは要対応。0は全く問題なし、100は完全に問題ありを意味する。",
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

type ReviewRunnerOptions = {
  baseDir: string;
  config: SwissConfig;
  input: ReviewInput;
  context?: string;
  onProgress?: (event: ReviewProgressEvent) => void;
};

type ReviewProgressEvent =
  | {
      type: "review_started";
      index: number;
      total: number;
      name: string;
      model: string;
    }
  | {
      type: "review_finished";
      index: number;
      total: number;
      name: string;
      elapsedMs: number;
      flaggedCount: number;
    };

export async function runReviews(
  opts: ReviewRunnerOptions
): Promise<{ results: ReviewResult[]; stopReason: "needs_action" | "completed" }>{
  const codex = new Codex({ apiKey: process.env.OPENAI_API_KEY });
  const results: ReviewResult[] = [];
  const total = opts.config.reviews.length;

  for (const [index, review] of opts.config.reviews.entries()) {
    const reviewIndex = index + 1;
    const model = review.model ?? opts.config.model;
    opts.onProgress?.({
      type: "review_started",
      index: reviewIndex,
      total,
      name: review.name,
      model,
    });

    const startedAt = Date.now();
    const thread = codex.startThread({
      workingDirectory: opts.baseDir,
      skipGitRepoCheck: true,
      model,
    });
    const result = await runSingleReview({
      thread,
      baseDir: opts.baseDir,
      input: opts.input,
      review,
      context: opts.context,
    });

    opts.onProgress?.({
      type: "review_finished",
      index: reviewIndex,
      total,
      name: review.name,
      elapsedMs: Date.now() - startedAt,
      flaggedCount: result.length,
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
  context?: string;
}): Promise<ReviewResult[]> {
  const userPrompt = await loadPrompt(args.baseDir, args.review.name);
  const message = buildMessage({
    context: args.context,
    userPrompt,
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
  context?: string;
  userPrompt: string;
  input: ReviewInput;
}): string {
  const trimmedContext = args.context?.trim() ?? "";
  return [
    trimmedContext ? "# 前提条件" : "",
    trimmedContext,
    trimmedContext ? "\n---\n" : "",
    "# レビュー観点",
    args.userPrompt,
    "\n---\n",
    "# 入力",
    "```",
    args.input.content,
    "```",
  ]
    .filter(Boolean)
    .join("\n");
}
