import { Worker } from "node:worker_threads";
import { ApiError } from "../utils/api-error.js";

export const extractPdf = (filename, signal) => new Promise((resolve, reject) => {
  const worker = new Worker(new URL("./pdf-extraction.worker.js", import.meta.url), {
    workerData: filename, resourceLimits: { maxOldGenerationSizeMb: 256 },
    stdout: true, stderr: true,
  });
  // Do not forward PDF.js diagnostics, which may include private content.
  worker.stdout.resume();
  worker.stderr.resume();
  const finish = (error, result) => {
    clearTimeout(timer);
    signal.removeEventListener("abort", abort);
    worker.removeAllListeners();
    void worker.terminate();
    if (error) reject(error); else resolve(result);
  };
  const abort = () => finish(new ApiError(422, "PDF processing timed out. Upload a smaller PDF."));
  const timer = setTimeout(abort, 60000);
  signal.addEventListener("abort", abort, { once: true });
  worker.once("message", (result) => finish(result.error ? new ApiError(422, result.error) : null, result));
  worker.once("error", () => finish(new ApiError(422, "PDF extraction failed. Check the PDF format and server PDF.js installation.")));
  worker.once("exit", () => finish(new ApiError(422, "PDF extraction stopped before completion.")));
  if (signal.aborted) abort();
});
