import { NextResponse } from "next/server";
import YAML from "yaml";
import { readConfigFile, writeConfigFile } from "@/lib/files";

const WORKFLOW_NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

function getWorkflowName(request: Request): string {
  const { searchParams } = new URL(request.url);
  const workflow = searchParams.get("workflow")?.trim();
  return workflow || "default";
}

function isValidWorkflowName(workflow: string): boolean {
  return WORKFLOW_NAME_PATTERN.test(workflow);
}

export async function GET(request: Request) {
  const workflow = getWorkflowName(request);
  if (!isValidWorkflowName(workflow)) {
    return NextResponse.json(
      { error: "workflow名は英数字・ハイフン・アンダースコアのみ使用できます" },
      { status: 400 }
    );
  }

  const content = await readConfigFile(workflow);
  if (!content.trim()) {
    return NextResponse.json({
      config: {
        model: "",
        reviews: [],
      },
    });
  }

  const config = YAML.parse(content) ?? { model: "", reviews: [] };
  return NextResponse.json({ config });
}

type ReviewInput = {
  name: string;
  description?: string;
  model?: string;
  parallel?: boolean;
};

type ConfigInput = {
  model: string;
  reviews: ReviewInput[];
};

export async function POST(request: Request) {
  const workflow = getWorkflowName(request);
  if (!isValidWorkflowName(workflow)) {
    return NextResponse.json(
      { error: "workflow名は英数字・ハイフン・アンダースコアのみ使用できます" },
      { status: 400 }
    );
  }

  try {
    const body = (await request.json()) as { config?: ConfigInput };
    const config = body.config ?? { model: "", reviews: [] };
    const yaml = YAML.stringify(config);
    await writeConfigFile(workflow, yaml);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "workflow 設定の保存に失敗しました";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}