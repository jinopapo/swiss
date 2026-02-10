#!/usr/bin/env node
import { Command } from "commander";
import { listWorkflows, loadWorkflowConfig, runReviews } from "@swiss/core";
import { readStdin } from "./stdin.js";
import { openConfigUi } from "./open-config.js";
import type { ReviewInput } from "@swiss/core";

const program = new Command();
const WORKFLOW_NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

program
  .name("swiss")
  .description("AIレビューCLI")
  .version("0.1.0");

program
  .command("review")
  .argument("<workflow>", "workflow名")
  .option("--text", "textレビュー")
  .option("--diff", "diffレビュー")
  .description("レビューを実行")
  .action(async (workflow, options) => {
    const workflowName = workflow.trim();

    if (!isValidWorkflowName(workflowName)) {
      console.error("workflow名は英数字・ハイフン・アンダースコアのみ使用できます");
      process.exit(1);
    }

    const kind = options.diff ? "diff" : "text";
    const content = await readStdin();
    if (!content.trim()) {
      if (kind === "diff") {
        console.log("差分がないためレビューをスキップしました");
        return;
      }
      console.error("stdin が空です");
      process.exit(1);
    }

    const input: ReviewInput = { kind, content };
    const baseDir = process.env.INIT_CWD ?? process.cwd();
    try {
      const config = await loadWorkflowConfig(baseDir, workflowName);
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
    } catch (error) {
      if (isWorkflowConfigNotFoundError(error, workflowName)) {
        console.error(`設定ファイルが見つかりません: .swiss/flows/${workflowName}.yaml`);
        const workflows = await listWorkflows(baseDir);
        if (workflows.length > 0) {
          console.error(`利用可能な workflow: ${workflows.join(", ")}`);
        } else {
          console.error("利用可能な workflow がありません（.swiss/flows/*.yaml を作成してください）");
        }
        process.exit(1);
      }

      console.error(error instanceof Error ? error.message : "レビュー実行中にエラーが発生しました");
      process.exit(1);
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
  const lineLabel = result.line === 0 ? "全体 (0)" : String(result.line);
  return [
    `レビュー: ${result.name}`,
    `スコア: ${result.score}`,
    `ファイルパス: ${result.filePath}`,
    `行番号: ${lineLabel}`,
    "内容:",
    result.review,
  ].join("\n");
}

function generateFishCompletion(): string {
  return [
    "complete -c swiss -f",
    "complete -c swiss -n '__fish_seen_subcommand_from review' -a '(ls -1 .swiss/flows/*.yaml 2>/dev/null | sed -E \"s#.*/##; s#\\\\.yaml$##\")' -d 'workflow名'",
    "complete -c swiss -n '__fish_seen_subcommand_from review' -l text -d 'textレビュー'",
    "complete -c swiss -n '__fish_seen_subcommand_from review' -l diff -d 'diffレビュー'",
    "complete -c swiss -n '__fish_seen_subcommand_from completion' -a fish",
  ].join("\n");
}

function isWorkflowConfigNotFoundError(error: unknown, workflow: string): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeError = error as { code?: string; path?: string };
  if (maybeError.code !== "ENOENT") {
    return false;
  }

  return maybeError.path?.endsWith(`.swiss/flows/${workflow}.yaml`) ?? false;
}

function isValidWorkflowName(workflow: string): boolean {
  return WORKFLOW_NAME_PATTERN.test(workflow);
}