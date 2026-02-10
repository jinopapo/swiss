import { NextResponse } from "next/server";
import { renameWorkflow } from "@/lib/files";

type RenameWorkflowInput = {
  from?: string;
  to?: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as RenameWorkflowInput;
  const from = body.from?.trim();
  const to = body.to?.trim();

  if (!from || !to) {
    return NextResponse.json(
      { error: "from と to の workflow 名が必要です" },
      { status: 400 }
    );
  }

  try {
    await renameWorkflow(from, to);
    return NextResponse.json({ ok: true, workflow: to });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "workflow 名の変更に失敗しました";
    const status = message.includes("すでに存在します") ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}