import { NextResponse } from "next/server";
import { readContextFile, writeContextFile } from "@/lib/files";

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

  const content = await readContextFile(workflow);
  return NextResponse.json({ content });
}

export async function POST(request: Request) {
  const workflow = getWorkflowName(request);
  if (!isValidWorkflowName(workflow)) {
    return NextResponse.json(
      { error: "workflow名は英数字・ハイフン・アンダースコアのみ使用できます" },
      { status: 400 }
    );
  }

  const body = (await request.json()) as { content?: string };
  if (typeof body.content !== "string" || !body.content.trim()) {
    return NextResponse.json(
      { error: "context は空にできません" },
      { status: 400 }
    );
  }

  await writeContextFile(workflow, body.content);
  return NextResponse.json({ ok: true });
}