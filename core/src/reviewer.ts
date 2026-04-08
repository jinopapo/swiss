import { Codex } from "@openai/codex-sdk";
import { z } from "zod";
import type {
  ReviewDebugEntry,
  ReviewInput,
  ReviewItem,
  ReviewResult,
  ReviewSpec,
  RunReviewsResult,
  ScoredReviewItem,
  SwissConfig,
} from "./types.js";
import { loadPrompt } from "./config.js";

const reviewItemSchema = z.object({
  review: z.string(),
  filePath: z.string(),
  line: z.number().int().min(0),
});

const scoredReviewItemSchema = reviewItemSchema.extend({
  score: z.number().int().min(0).max(10),
  reason: z.string(),
});

const generatedReviewResultSchema = z.object({
  results: z.array(reviewItemSchema),
});

const scoredReviewResultSchema = z.object({
  results: z.array(scoredReviewItemSchema),
});

const reviewItemsJsonSchema = {
  type: "object",
  description: "レビュー指摘の候補一覧。ファイルと行番号ごとに指摘内容を含む。",
  properties: {
    results: {
      type: "array",
      description: "レビュー指摘の配列。",
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
        },
        required: ["review", "filePath", "line"],
        additionalProperties: false,
      },
    },
  },
  required: ["results"],
  additionalProperties: false,
} as const;

const scoredReviewItemsJsonSchema = {
  type: "object",
  description: "レビュー指摘のスコアリング結果。ファイルと行番号ごとにスコアとレビュー内容を含む。",
  properties: {
    results: {
      type: "array",
      description: "スコア付きレビュー結果の配列。",
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
            maximum: 10,
            description: "スコア（0-10）。",
          },
          reason: {
            type: "string",
            description: "そのスコアにした理由。元の入力・レビュー観点・指摘内容をもとに簡潔に説明する。",
          },
        },
        required: ["review", "score", "reason", "filePath", "line"],
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
  debug?: boolean;
  skipReviews?: string[];
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
    }
  | {
      type: "review_skipped";
      index: number;
      total: number;
      name: string;
      model: string;
    };

export async function runReviews(
  opts: ReviewRunnerOptions
): Promise<RunReviewsResult> {
  const codex = new Codex({ apiKey: process.env.OPENAI_API_KEY });
  const results: ReviewResult[] = [];
  const debugEntries: ReviewDebugEntry[] = [];
  const shouldCollectDebug = opts.debug === true;
  const total = opts.config.reviews.length;
  const skipReviews = new Set((opts.skipReviews ?? []).map((name) => name.trim()).filter(Boolean));

  for (const [index, review] of opts.config.reviews.entries()) {
    const reviewIndex = index + 1;
    const model = review.model?.trim() ? review.model : opts.config.model;

    if (skipReviews.has(review.name)) {
      opts.onProgress?.({
        type: "review_skipped",
        index: reviewIndex,
        total,
        name: review.name,
        model,
      });
      continue;
    }

    opts.onProgress?.({
      type: "review_started",
      index: reviewIndex,
      total,
      name: review.name,
      model,
    });

    const startedAt = Date.now();
    const result = await runSingleReview({
      codex,
      baseDir: opts.baseDir,
      model,
      input: opts.input,
      review,
      context: opts.context,
      debug: shouldCollectDebug,
    });

    opts.onProgress?.({
      type: "review_finished",
      index: reviewIndex,
      total,
      name: review.name,
      elapsedMs: Date.now() - startedAt,
      flaggedCount: result.results.length,
    });

    results.push(...result.results);
    if (result.debug) {
      debugEntries.push(result.debug);
    }
    if (result.results.length > 0) {
      return {
        results,
        stopReason: "needs_action",
        ...(shouldCollectDebug ? { debug: debugEntries } : {}),
      };
    }
  }

  return {
    results,
    stopReason: "completed",
    ...(shouldCollectDebug ? { debug: debugEntries } : {}),
  };
}

async function runSingleReview(args: {
  codex: Codex;
  baseDir: string;
  model: string;
  input: ReviewInput;
  review: ReviewSpec;
  context?: string;
  debug?: boolean;
}): Promise<{ results: ReviewResult[]; debug?: ReviewDebugEntry }> {
  const userPrompt = await loadPrompt(args.baseDir, args.review.name);
  const generatedItems = await generateReviewItems({
    codex: args.codex,
    baseDir: args.baseDir,
    model: args.model,
    context: args.context,
    userPrompt,
    input: args.input,
  });

  const scoredItems = await scoreReviewItems({
    codex: args.codex,
    baseDir: args.baseDir,
    model: args.model,
    input: args.input,
    userPrompt,
    items: generatedItems,
  });

  const flaggedItems = filterFlaggedReviewItems(scoredItems);

  return {
    results: flaggedItems.map((item) => ({
      name: args.review.name,
      review: item.review,
      score: item.score,
      reason: item.reason,
      filePath: item.filePath,
      line: item.line,
    })),
    ...(args.debug
      ? {
          debug: {
            name: args.review.name,
            generatedItems,
            scoredItems,
          },
        }
      : {}),
  };
}

async function generateReviewItems(args: {
  codex: Codex;
  baseDir: string;
  model: string;
  context?: string;
  userPrompt: string;
  input: ReviewInput;
}): Promise<ReviewItem[]> {
  const thread = args.codex.startThread({
    workingDirectory: args.baseDir,
    skipGitRepoCheck: true,
    model: args.model,
  });
  const message = buildReviewGenerationMessage({
    context: args.context,
    userPrompt: args.userPrompt,
    input: args.input,
  });

  const turn = await thread.run(message, {
    outputSchema: reviewItemsJsonSchema,
  });

  const rawParsed = JSON.parse(turn.finalResponse);
  const normalized = Array.isArray(rawParsed) ? { results: rawParsed } : rawParsed;
  const parsed = generatedReviewResultSchema.parse(normalized);
  return parsed.results;
}

async function scoreReviewItems(args: {
  codex: Codex;
  baseDir: string;
  model: string;
  input: ReviewInput;
  userPrompt: string;
  items: ReviewItem[];
}): Promise<ScoredReviewItem[]> {
  if (args.items.length === 0) {
    return [];
  }

  const thread = args.codex.startThread({
    workingDirectory: args.baseDir,
    skipGitRepoCheck: true,
    model: args.model,
  });
  const message = buildScoringMessage({
    input: args.input,
    userPrompt: args.userPrompt,
    items: args.items,
  });

  const turn = await thread.run(message, {
    outputSchema: scoredReviewItemsJsonSchema,
  });

  const rawParsed = JSON.parse(turn.finalResponse);
  const normalized = Array.isArray(rawParsed) ? { results: rawParsed } : rawParsed;
  const parsed = scoredReviewResultSchema.parse(normalized);
  return parsed.results;
}

function filterFlaggedReviewItems(items: ScoredReviewItem[]): ScoredReviewItem[] {
  return items.filter((item) => isFlaggedScore(item.score));
}

function isFlaggedScore(score: number): boolean {
  return score >= 7;
}

function buildReviewGenerationMessage(args: {
  context?: string;
  userPrompt: string;
  input: ReviewInput;
}): string {
  const trimmedContext = args.context?.trim() ?? "";
  return [
    "レビュー基準に基づいて、入力内容から修正が必要な指摘候補を洗い出してください。",
    "スコアは付けず、指摘内容のみをJSONで返してください。問題がなければ results を空配列にしてください。",
    "\n---\n",
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

function buildScoringMessage(args: {
  input: ReviewInput;
  userPrompt: string;
  items: ReviewItem[];
}): string {
  return [
    "与えられたレビュー指摘を1件ずつスコアリングしてください。",
    "0は的外れもしくは対応不要な細かな指摘、10は的確な指摘を意味します。7以上は要対応です。",
    "レビュー観点、指摘一覧(JSON)、元の入力内容の3つを根拠に評価してください。",
    "入力の review / filePath / line は変更せず、そのまま score と reason を追加してJSONで返してください。",
    "reason には、なぜそのスコアにしたのかを各指摘ごとに具体的かつ簡潔に記載してください。",
    "問題がない場合でも、受け取った全件に対して score を付けて返してください。",
    "\n---\n",
    "# レビュー観点",
    args.userPrompt,
    "\n---\n",
    "# 元の入力",
    "```",
    args.input.content,
    "```",
    "\n---\n",
    "# 指摘一覧(JSON)",
    "```json",
    JSON.stringify({ results: args.items }, null, 2),
    "```",
  ].join("\n");
}
