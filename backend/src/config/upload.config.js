import "./rag.config.js";
import { ApiError } from "../utils/api-error.js";

export const getPdfLimit = () => {
  const mb = Number(process.env.PDF_MAX_SIZE_MB || 20);
  if (!Number.isFinite(mb) || mb <= 0) throw new ApiError(503, "PDF_MAX_SIZE_MB must be a positive number.");
  return Math.floor(mb * 1024 * 1024);
};
