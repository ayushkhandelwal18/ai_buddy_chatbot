import multer from "multer";
import { randomUUID } from "node:crypto";
import { mkdir, unlink } from "node:fs/promises";
import { PDF_DIRECTORY, getPdfLimit, pdfPath } from "../config/upload.config.js";
import { ApiError } from "../utils/api-error.js";

export const removePdf = async (filename) => {
  try { await unlink(pdfPath(filename)); } catch (error) {
    if (error.code !== "ENOENT") throw new ApiError(503, "Local PDF cleanup failed. Check storage permissions and retry deletion.");
  }
};

export const uploadPdf = async (req, res, next) => {
  try {
    await mkdir(PDF_DIRECTORY, { recursive: true });
    const upload = multer({
      storage: multer.diskStorage({
        destination: PDF_DIRECTORY,
        filename: (request, file, done) => done(null, `${randomUUID()}.pdf`),
      }),
      limits: { fileSize: getPdfLimit(), files: 1, fields: 0, parts: 1 },
      fileFilter: (request, file, done) => {
        if (!/\.pdf$/i.test(file.originalname) || file.mimetype !== "application/pdf") {
          return done(ApiError.badRequest("Only PDF files with application/pdf MIME type are accepted."));
        }
        done(null, true);
      },
    }).single("file");
    upload(req, res, (error) => {
      if (!error) return next();
      if (error instanceof ApiError) return next(error);
      if (error.code === "LIMIT_FILE_SIZE") return next(new ApiError(413, "PDF exceeds the configured upload size limit."));
      next(new ApiError(error instanceof multer.MulterError ? 400 : 503,
        error instanceof multer.MulterError ? "Invalid multipart upload. Send exactly one PDF in the file field." : "PDF upload could not be saved. Check available storage and permissions."));
    });
  } catch (error) {
    next(error instanceof ApiError ? error : new ApiError(503, "PDF storage is unavailable."));
  }
};
