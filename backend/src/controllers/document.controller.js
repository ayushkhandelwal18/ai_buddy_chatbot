import mongoose from "mongoose";
import { access, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import Document from "../models/document.model.js";
import { pdfPath } from "../config/upload.config.js";
import { removePdf } from "../middleware/pdf-upload.middleware.js";
import { deleteDocumentPoints } from "../services/document-index.service.js";
import { publicDocument, reserveProcessing, processDocument, expireInterruptedDocuments } from "../services/document-processing.service.js";
import { ApiError } from "../utils/api-error.js";
import { inspectQdrantCollection } from "../services/qdrant.service.js";
import { causedError, logServiceError } from "../utils/service-error.js";

const scope = (req, res) => {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) throw ApiError.badRequest("Invalid document ID.");
  return { _id: req.params.id, userId: res.locals.jwtData.id };
};

export const uploadDocument = async (req, res) => {
  if (!req.file) throw ApiError.badRequest("Select one PDF file to upload.");
  const userId = res.locals.jwtData.id;
  let release;
  let stage = "read-upload";
  let processingDocument;
  let keepIncoming = false;
  let handedOff = false;
  try {
    const bytes = await readFile(pdfPath(req.file.filename));
    if (bytes.subarray(0, 5).toString("ascii") !== "%PDF-") throw ApiError.badRequest("Invalid PDF signature. Select a valid PDF file.");
    const contentHash = createHash("sha256").update(bytes).digest("hex");
    stage = "metadata-lookup";
    await Document.init();
    await expireInterruptedDocuments(userId);
    const retryId = req.query.retryDocumentId;
    if (retryId !== undefined && (typeof retryId !== "string" || !mongoose.isObjectIdOrHexString(retryId))) throw ApiError.badRequest("Invalid retry document ID.");
    let existing = await Document.findOne({ userId, ...(retryId ? { _id: retryId } : { contentHash }) })
      .select("+storageFilename +contentHash +deletionDeadline");
    if (retryId && !existing) throw ApiError.notFound("Retry document not found.");
    if (existing?.deletionDeadline > new Date()) throw new ApiError(409, "Document deletion is in progress. Try again later.");
    if (existing && retryId) {
      stage = "read-original-upload";
      const previousHash = existing.contentHash || createHash("sha256").update(await readFile(pdfPath(existing.storageFilename))).digest("hex");
      if (previousHash !== contentHash) throw ApiError.badRequest("Retry must use the same PDF. Attach the new file as a separate upload.");
    }
    stage = "qdrant-preflight";
    const collection = await inspectQdrantCollection();
    if (!collection.exists) throw new ApiError(503, "Qdrant collection is missing. Run npm run qdrant:init from the backend directory.");
    if (existing && ["ready", "uploaded", "processing"].includes(existing.status)) {
      stage = "duplicate-file-cleanup";
      await removePdf(req.file.filename);
      return res.status(existing.status === "ready" ? 200 : 202).json({ document: publicDocument(existing), reused: true });
    }
    release = reserveProcessing(userId);
    if (existing) {
      let storageFilename = existing.storageFilename;
      stage = "read-original-upload";
      try { await access(pdfPath(storageFilename)); } catch (error) {
        if (error.code !== "ENOENT") throw error;
        storageFilename = req.file.filename;
      }
      stage = "metadata-retry";
      processingDocument = await Document.findOneAndUpdate({ _id: existing._id, userId, status: "failed",
        $or: [{ deletionDeadline: null }, { deletionDeadline: { $lte: new Date() } }],
      }, { $set: { contentHash, storageFilename, status: "uploaded", pageCount: null, chunkCount: 0, processingError: "",
        processingDeadline: new Date(Date.now() + 20 * 60 * 1000) } }, { new: true }).select("+storageFilename");
      if (!processingDocument) throw new ApiError(409, "The document is already being retried or deleted. Refresh its status.");
      keepIncoming = storageFilename === req.file.filename;
      // Claim the failed record before cleanup so another retry cannot delete
      // points while the winning attempt is already indexing.
      stage = "retry-index-cleanup";
      await deleteDocumentPoints(userId, existing._id);
      if (!keepIncoming) { stage = "duplicate-file-cleanup"; await removePdf(req.file.filename); }
    } else {
      stage = "metadata-create";
      const originalFilename = req.file.originalname.replace(/\\/g, "/").split("/").at(-1)
        .replace(/[\x00-\x1f\x7f]/g, "").slice(0, 255) || "document.pdf";
      try {
        processingDocument = await Document.create({
          userId, contentHash, originalFilename, storageFilename: req.file.filename,
          fileSize: req.file.size, mimeType: "application/pdf", status: "uploaded",
          processingDeadline: new Date(Date.now() + 20 * 60 * 1000),
        });
        keepIncoming = true;
      } catch (error) {
        if (error.code !== 11000) throw error;
        existing = await Document.findOne({ userId, contentHash });
        if (!existing) throw error;
        await removePdf(req.file.filename);
        return res.status(existing.status === "ready" ? 200 : 202).json({ document: publicDocument(existing), reused: true });
      }
    }
    const finish = release;
    release = null;
    handedOff = true;
    setImmediate(() => { void processDocument(processingDocument, finish); });
    return res.status(202).json({ document: publicDocument(processingDocument) });
  } catch (error) {
    logServiceError("document-upload." + stage, error);
    if (processingDocument && !handedOff) {
      try { await Document.updateOne({ _id: processingDocument._id, userId }, { $set: { status: "failed", processingError: "Upload setup failed. Retry the same PDF after resolving the reported service error." } }); }
      catch (statusError) { logServiceError("document-upload.save-failure", statusError); }
    }
    let cleanupFailed = false;
    if (!keepIncoming) {
      try { await removePdf(req.file.filename); }
      catch (cleanupError) { cleanupFailed = true; logServiceError("document-upload.file-cleanup", cleanupError); }
    }
    if (error instanceof ApiError && !cleanupFailed) throw error;
    const message = cleanupFailed ? "Upload failed and local file cleanup was incomplete. Check backend storage diagnostics before retrying."
      : stage.startsWith("metadata") ? "Unable to save PDF metadata. Check MongoDB availability and the backend diagnostics."
      : "Unable to read or clean up the uploaded PDF. Check backend storage permissions and available disk space.";
    throw causedError(503, message, error);
  } finally { release?.(); }
};

export const listDocuments = async (req, res) => {
  const userId = res.locals.jwtData.id;
  await expireInterruptedDocuments(userId);
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 30, 1), 100);
  const skip = Math.max(Number.parseInt(req.query.skip, 10) || 0, 0);
  const documents = await Document.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(limit);
  res.json({ documents: documents.map(publicDocument) });
};

export const documentStatus = async (req, res) => {
  const filter = scope(req, res);
  await expireInterruptedDocuments(filter.userId);
  const document = await Document.findOne(filter);
  if (!document) throw ApiError.notFound("Document not found.");
  res.json({ document: publicDocument(document) });
};

export const deleteDocument = async (req, res) => {
  const filter = scope(req, res);
  await expireInterruptedDocuments(filter.userId);
  const document = await Document.findOneAndUpdate({ ...filter,
    status: { $in: ["ready", "failed"] },
    $or: [{ deletionDeadline: null }, { deletionDeadline: { $lte: new Date() } }],
  }, { $set: { deletionDeadline: new Date(Date.now() + 120000) } }, { new: true }).select("+storageFilename");
  if (!document) {
    if (!await Document.exists(filter)) throw ApiError.notFound("Document not found.");
    throw new ApiError(409, "Document is processing or deletion is already in progress. Try again later.");
  }
  try {
    await deleteDocumentPoints(filter.userId, document._id);
    await removePdf(document.storageFilename);
    await Document.deleteOne(filter);
    res.json({ message: "Document and indexed chunks deleted.", id: String(document._id) });
  } catch (error) {
    // Preserve metadata so partial deletion can be safely retried.
    await Document.updateOne(filter, {
      $set: { status: "failed", processingError: "Deletion incomplete. Retry deletion to finish cleanup." },
      $unset: { deletionDeadline: "" },
    });
    throw error instanceof ApiError ? error : new ApiError(503, "Document deletion is incomplete. Check database availability and retry.");
  }
};
