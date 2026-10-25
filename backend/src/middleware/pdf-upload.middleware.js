import multer from "multer";
import path from "node:path";
import { getPdfLimit } from "../config/upload.config.js";
import { createTemporaryPdf, removeTemporaryPdf } from "../services/pdf-storage.service.js";
import { ApiError } from "../utils/api-error.js";

export const uploadPdf = async (req, res, next) => {
  let temporary;
  try {
    const fileSize = getPdfLimit();
    temporary = await createTemporaryPdf();
    const upload = multer({
      storage: multer.diskStorage({
        destination: temporary.directory,
        filename: (request, file, done) => done(null, path.basename(temporary.path)),
      }),
      limits: { fileSize, files: 1, fields: 0, parts: 1 },
      fileFilter: (request, file, done) => {
        if (!/\.pdf$/i.test(file.originalname) || file.mimetype !== "application/pdf") {
          return done(ApiError.badRequest("Only PDF files with application/pdf MIME type are accepted."));
        }
        done(null, true);
      },
    }).single("file");
    await new Promise((resolve, reject) => upload(req, res, (error) => error ? reject(error) : resolve()));
    if (req.aborted || res.destroyed) throw ApiError.badRequest("PDF upload was interrupted.");
    if (!req.file) throw ApiError.badRequest("Select one PDF file to upload.");
    req.temporaryPdf = temporary;
    next();
  } catch (error) {
    if (temporary) {
      try { await removeTemporaryPdf(temporary.directory); }
      catch (cleanupError) { return next(cleanupError); }
    }
    if (error instanceof ApiError) return next(error);
    if (error.code === "LIMIT_FILE_SIZE") return next(new ApiError(413, "PDF exceeds the configured upload size limit."));
    next(new ApiError(error instanceof multer.MulterError ? 400 : 503,
      error instanceof multer.MulterError ? "Invalid multipart upload. Send exactly one PDF in the file field." : "PDF upload could not be processed. Check temporary-storage permissions and available space."));
  }
};
