import "./rag.config.js";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { ApiError } from "../utils/api-error.js";

export const PDF_DIRECTORY = fileURLToPath(new URL("../../uploads/pdfs/", import.meta.url));
export const getPdfLimit = () => {
  const mb = Number(process.env.PDF_MAX_SIZE_MB || 20);
  if (!Number.isFinite(mb) || mb <= 0) throw new ApiError(503, "PDF_MAX_SIZE_MB must be a positive number.");
  return Math.floor(mb * 1024 * 1024);
};
export const pdfPath = (filename) => {
  if (!/^[0-9a-f-]{36}\.pdf$/i.test(filename)) throw new ApiError(500, "Invalid stored PDF identifier.");
  return path.join(PDF_DIRECTORY, filename);
};
