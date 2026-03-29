import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PDFParse } from "pdf-parse";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const pdfPath = path.join(projectRoot, "public", "screenplay", "screenplaytest.pdf");
const txtPath = path.join(projectRoot, "public", "screenplay", "screenplaytest.txt");
const indexPath = path.join(projectRoot, "public", "screenplay", "screenplaytest.index.json");

async function main() {
  const pdfBuffer = await readFile(pdfPath);
  const parser = new PDFParse({ data: pdfBuffer, disableWorker: true });
  const parsed = await parser.getText();
  await parser.destroy().catch(() => {});

  const text = (parsed.text ?? "").trim();
  await writeFile(txtPath, `${text}\n`, "utf8");

  const pageBlocks = [];
  for (const page of parsed.pages ?? []) {
    const pageText = (page.text ?? "").trim();
    const parts = pageText
      .split(/\n\s*\n+/)
      .map((chunk) => chunk.trim())
      .filter(Boolean);

    for (let i = 0; i < parts.length; i += 1) {
      pageBlocks.push({
        id: `screenplay-page-${page.num}-block-${i}`,
        page: page.num,
        text: parts[i],
      });
    }
  }

  const indexPayload = {
    rawText: text,
    blocks: pageBlocks,
  };
  await writeFile(indexPath, `${JSON.stringify(indexPayload, null, 2)}\n`, "utf8");

  console.log(`Wrote screenplay text to ${txtPath}`);
  console.log(`Wrote screenplay index to ${indexPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
