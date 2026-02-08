import { NextResponse } from "next/server";
import { listPrompts } from "@/lib/files";

export async function GET() {
  const prompts = await listPrompts();
  return NextResponse.json({ prompts });
}