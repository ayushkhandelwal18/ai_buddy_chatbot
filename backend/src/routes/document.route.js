import { Router } from "express";
import { verifyToken } from "../utils/token-manager.js";
import { uploadPdf } from "../middleware/pdf-upload.middleware.js";
import { uploadDocument, listDocuments, documentStatus, deleteDocument } from "../controllers/document.controller.js";
import { ApiError } from "../utils/api-error.js";

const documentRoutes = Router();
documentRoutes.use(verifyToken);
documentRoutes.post("/upload", uploadPdf, uploadDocument);
documentRoutes.get("/", listDocuments);
documentRoutes.get("/:id/status", documentStatus);
documentRoutes.delete("/:id", deleteDocument);
// Keep database/filesystem/provider details out of responses and shared logs.
documentRoutes.use((error, req, res, next) => {
  next(error instanceof ApiError ? error : new ApiError(503, "Document service is unavailable. Try again later."));
});
export default documentRoutes;
