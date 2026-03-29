import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { buildScreenplayBlocksFromText } from "@/lib/screenplay-matching";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let cachedPayload:
  | {
      rawText: string;
      blocks: Array<{ id: string; text: string; page: number }>;
    }
  | null = null;

export async function GET() {
  try {
    if (cachedPayload) {
      return NextResponse.json(cachedPayload, {
        headers: { "Cache-Control": "no-store, max-age=0" },
      });
    }

    const screenplayIndexPath = path.join(
      process.cwd(),
      "public",
      "screenplay",
      "screenplaytest.index.json"
    );
    const indexRaw = await fs.readFile(screenplayIndexPath, "utf8");
    const parsedIndex = JSON.parse(indexRaw) as {
      rawText?: string;
      blocks?: Array<{ id: string; text: string; page?: number }>;
    };

    const rawText = (parsedIndex.rawText ?? "").trim();
    const blocks =
      parsedIndex.blocks?.map((block, index) => ({
        id: block.id || `screenplay-block-${index}`,
        text: block.text ?? "",
        page: block.page && Number.isFinite(block.page) ? block.page : 1,
      })) ??
      buildScreenplayBlocksFromText(rawText).map((block, index) => ({
        id: block.id,
        text: block.text,
        page: index + 1,
      }));

    cachedPayload = { rawText, blocks };

    return NextResponse.json(cachedPayload, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    console.error("Failed to parse screenplay PDF:", error);
    const errorText =
      error instanceof Error
        ? `${error.name}: ${error.message}`
        : typeof error === "string"
          ? error
          : JSON.stringify(error);
    return NextResponse.json(
      {
        error: `Could not load screenplay file. ${errorText}`,
      },
      { status: 500 }
    );
  }
}
