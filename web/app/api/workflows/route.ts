import { NextResponse } from "next/server";
import { listWorkflows } from "@/lib/files";

export async function GET() {
  const workflows = await listWorkflows();
  return NextResponse.json({ workflows });
}
