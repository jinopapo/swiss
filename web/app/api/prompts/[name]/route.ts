import { NextResponse } from "next/server";
import { writePromptFile } from "@/lib/files";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const body = (await request.json()) as { content?: string };
  await writePromptFile(name, body.content ?? "");
  return NextResponse.json({ ok: true });
}