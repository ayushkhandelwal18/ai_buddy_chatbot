import mongoose from "mongoose";
import Document from "../models/document.model.js";
import { fingerprintPdf, removeTemporaryPdf } from "../services/pdf-storage.service.js";
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
  if (!req.file || !req.temporaryPdf) throw ApiError.badRequest("Select one PDF file to upload.");
  const userId = res.locals.jwtData.id;
  let release;
  let stage = "read-upload";
  let processingDocument;
  let handedOff = false;
  try {
    const contentHash = await fingerprintPdf(req.temporaryPdf.path);
    stage = "metadata-lookup";
    await Document.init();
    await expireInterruptedDocuments(userId);
    const retryId = req.query.retryDocumentId;
    if (retryId !== undefined && (typeof retryId !== "string" || !mongoose.isObjectIdOrHexString(retryId))) throw ApiError.badRequest("Invalid retry document ID.");
    let existing = await Document.findOne({ userId, ...(retryId ? { _id: retryId } : { contentHash }) })
      .select("+contentHash +deletionDeadline");
    if (retryId && !existing) throw ApiError.notFound("Retry document not found.");
    if (existing?.deletionDeadline > new Date()) throw new ApiError(409, "Document deletion is in progress. Try again later.");
    if (existing && retryId) {
      if (!existing.contentHash) throw ApiError.badRequest("This older document has no content fingerprint. Upload the PDF as a new attachment instead.");
      if (existing.contentHash !== contentHash) throw ApiError.badRequest("Retry must use the same PDF. Attach the new file as a separate upload.");
    }
    stage = "qdrant-preflight";
    const collection = await inspectQdrantCollection();
    if (!collection.exists) throw new ApiError(503, "Qdrant collection is missing. Run npm run qdrant:init from the backend directory.");
    if (existing && ["ready", "uploaded", "processing"].includes(existing.status)) {
      stage = "duplicate-file-cleanup";
      await removeTemporaryPdf(req.temporaryPdf.directory);
      return res.status(existing.status === "ready" ? 200 : 202).json({ document: publicDocument(existing), reused: true });
    }
    release = reserveProcessing(userId);
    if (existing) {
      stage = "metadata-retry";
      processingDocument = await Document.findOneAndUpdate({ _id: existing._id, userId, status: "failed",
        $or: [{ deletionDeadline: null }, { deletionDeadline: { $lte: new Date() } }],
      }, { $set: { contentHash, status: "uploaded", pageCount: null, chunkCount: 0, processingError: "",
        processingDeadline: new Date(Date.now() + 20 * 60 * 1000) } }, { new: true });
      if (!processingDocument) throw new ApiError(409, "The document is already being retried or deleted. Refresh its status.");
      // Claim the failed record before cleanup so concurrent retries cannot
      // delete points while the winning attempt is already indexing.
      stage = "retry-index-cleanup";
      await deleteDocumentPoints(userId, existing._id);
    } else {
      stage = "metadata-create";
      const originalFilename = req.file.originalname.replace(/\\/g, "/").split("/").at(-1)
        .replace(/[\x00-\x1f\x7f]/g, "").slice(0, 255) || "document.pdf";
      try {
        processingDocument = await Document.create({
          userId, contentHash, originalFilename,
          fileSize: req.file.size, mimeType: "application/pdf", status: "uploaded",
          processingDeadline: new Date(Date.now() + 20 * 60 * 1000),
        });
      } catch (error) {
        if (error.code !== 11000) throw error;
        existing = await Document.findOne({ userId, contentHash });
        if (!existing) throw error;
        stage = "duplicate-file-cleanup";
        await removeTemporaryPdf(req.temporaryPdf.directory);
        return res.status(existing.status === "ready" ? 200 : 202).json({ document: publicDocument(existing), reused: true });
      }
    }
    const finish = release;
    setImmediate(() => { void processDocument(processingDocument, req.temporaryPdf, finish); });
    handedOff = true;
    release = null;
    return res.status(202).json({ document: publicDocument(processingDocument) });
  } catch (error) {
    logServiceError("document-upload." + stage, error);
    if (processingDocument && !handedOff) {
      try { await Document.updateOne({ _id: processingDocument._id, userId }, { $set: { status: "failed", processingError: "Upload setup failed. Retry the same PDF after resolving the reported service error." } }); }
      catch (statusError) { logServiceError("document-upload.save-failure", statusError); }
    }
    if (error instanceof ApiError) throw error;
    const message = stage.startsWith("metadata") ? "Unable to save PDF metadata. Check MongoDB availability and the backend diagnostics."
      : "Unable to process the temporary PDF. Check temporary-storage permissions and available space.";
    throw causedError(503, message, error);
  } finally {
    try {
      // Once handed off, the processing job owns cleanup even if the client disconnects.
      if (!handedOff) await removeTemporaryPdf(req.temporaryPdf.directory);
    } finally { release?.(); }
  }
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
  }, { $set: { deletionDeadline: new Date(Date.now() + 120000) } }, { new: true });
  if (!document) {
    if (!await Document.exists(filter)) throw ApiError.notFound("Document not found.");
    throw new ApiError(409, "Document is processing or deletion is already in progress. Try again later.");
  }
  try {
    await deleteDocumentPoints(filter.userId, document._id);
    await Document.deleteOne(filter);
    res.json({ message: "Document and indexed chunks deleted.", id: String(document._id) });
  } catch (error) {
    await Document.updateOne(filter, {
      $set: { status: "failed", processingError: "Deletion incomplete. Retry deletion to finish cleanup." },
      $unset: { deletionDeadline: "" },
    });
    throw error instanceof ApiError ? error : new ApiError(503, "Document deletion is incomplete. Check database availability and retry.");
  }
};
