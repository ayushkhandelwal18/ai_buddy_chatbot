import { parentPort, workerData } from "node:worker_threads";
import { pathToFileURL } from "node:url";

let task;
let result;
try {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // PDF.js's installed Node file transport supports bounded range reads.
  // Avoid an extra whole-file Buffer/Uint8Array copy in the extraction worker.
  task = getDocument({ url: pathToFileURL(workerData).href,
    disableStream: true, disableAutoFetch: true, rangeChunkSize: 64 * 1024,
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
    result = { error: "No meaningful extractable text found. Scanned/image-only PDFs require OCR, which is not implemented." };
  } else result = { pages, pageCount: pdf.numPages };
} catch (error) {
  result = { error: error.message === "limit"
    ? "PDF exceeds the processing limit of 500 pages or 2 million text characters."
    : "PDF could not be read. It may be malformed, encrypted, or unsupported." };
} finally {
  await task?.destroy().catch(() => {});
}
// Close parser file handles before the parent removes temporary files (Windows).
parentPort.postMessage(result);
