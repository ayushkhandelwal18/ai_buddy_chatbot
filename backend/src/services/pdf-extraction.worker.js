import { parentPort, workerData } from "node:worker_threads";
import { readFile } from "node:fs/promises";

let task;
try {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  task = getDocument({ data: new Uint8Array(await readFile(workerData)),
    useSystemFonts: false, disableFontFace: true,
    stopAtErrors: true, verbosity: 0 });
  const pdf = await task.promise;
  if (pdf.numPages > 500) throw new Error("limit");
  const pages = [];
  let total = 0;
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items.filter((item) => typeof item.str === "string")
      .map((item) => item.str + (item.hasEOL ? "\n" : " ")).join("").trim();
    total += text.length;
    if (total > 2_000_000) throw new Error("limit");
    pages.push({ pageNumber, text });
    page.cleanup();
  }
  if (pages.reduce((count, page) => count + (page.text.match(/[\p{L}\p{N}]/gu)?.length || 0), 0) < 20) {
    parentPort.postMessage({ error: "No meaningful extractable text found. Scanned/image-only PDFs require OCR, which is not implemented." });
  } else parentPort.postMessage({ pages, pageCount: pdf.numPages });
} catch (error) {
  parentPort.postMessage({ error: error.message === "limit"
    ? "PDF exceeds the processing limit of 500 pages or 2 million text characters."
    : "PDF could not be read. It may be malformed, encrypted, or unsupported." });
} finally {
  await task?.destroy().catch(() => {});
}
