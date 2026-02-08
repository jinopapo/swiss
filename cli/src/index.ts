#!/usr/bin/env node
import { Command } from "commander";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { loadConfig, runReviews } from "@swiss/core";
import { readStdin } from "./stdin.js";
import { openConfigUi } from "./open-config.js";
import type { ReviewInput } from "@swiss/core";

const program = new Command();

program
  .name("swiss")
  .description("AIレビューCLI")
  .version("0.1.0");

program
  .command("review")
  .option("--text", "textレビュー")
  .option("--diff", "diffレビュー")
  .description("レビューを実行")
  .action(async (options) => {
    const kind = options.diff ? "diff" : "text";
    const content = await readStdin();
    if (!content.trim()) {
      console.error("stdin が空です");
      process.exit(1);
    }

    const input: ReviewInput = { kind, content };
    const baseDir = process.cwd();
    const config = await loadConfig(baseDir);
    const { results, stopReason } = await runReviews({ baseDir, config, input });

    for (const result of results) {
      console.log(formatReview(result));
      console.log("\n---\n");
    }

    if (stopReason === "completed") {
      console.log("レビュー結果: すべてOKでした ✅");
    }

    if (stopReason === "needs_action") {
      process.exit(2);
    }
  });

program
  .command("config")
  .description("設定UIを開く")
  .action(async () => {
    await openConfigUi();
  });

program
  .command("completion")
  .argument("<shell>", "shell name")
  .description("補完スクリプトを出力")
  .action((shell) => {
    if (shell === "fish") {
      console.log(generateFishCompletion());
      return;
    }
    console.error("現在対応しているのは fish のみです");
    process.exit(1);
  });

program.parse();

function formatReview(result: { name: string; review: string; score: number; filePath: string; line: number }): string {
  return [
    `レビュー: ${result.name}`,
    `スコア: ${result.score}`,
    `ファイルパス: ${result.filePath}`,
    `行番号: ${result.line}`,
    "内容:",
    result.review,
  ].join("\n");
}

function generateFishCompletion(): string {
  return [
    "complete -c swiss -f",
    "complete -c swiss -n '__fish_seen_subcommand_from review' -l text -d 'textレビュー'",
    "complete -c swiss -n '__fish_seen_subcommand_from review' -l diff -d 'diffレビュー'",
    "complete -c swiss -n '__fish_seen_subcommand_from completion' -a fish",
  ].join("\n");
}