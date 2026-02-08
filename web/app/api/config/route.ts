import { NextResponse } from "next/server";
import YAML from "yaml";
import { readConfigFile, writeConfigFile } from "@/lib/files";

export async function GET() {
  const content = await readConfigFile();
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
  const body = (await request.json()) as { config?: ConfigInput };
  const config = body.config ?? { model: "", reviews: [] };
  const yaml = YAML.stringify(config);
  await writeConfigFile(yaml);
  return NextResponse.json({ ok: true });
}