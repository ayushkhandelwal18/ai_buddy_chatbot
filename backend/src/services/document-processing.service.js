import Document from "../models/document.model.js";
import { removeTemporaryPdf } from "./pdf-storage.service.js";
import { extractPdf } from "./pdf.service.js";
import { chunkPages } from "./chunking.service.js";
import { generateEmbeddings } from "./embedding.service.js";
import { inspectQdrantCollection } from "./qdrant.service.js";
import { indexChunks, deleteDocumentPoints, ensureDocumentPayloadIndexes } from "./document-index.service.js";
import { ApiError } from "../utils/api-error.js";
import { logServiceError } from "../utils/service-error.js";

// Small, in-process development worker pool; no automatic processing on startup.
const activeUsers = new Set();
export const reserveProcessing = (userId) => {
  if (activeUsers.has(String(userId)) || activeUsers.size >= 2) {
    throw new ApiError(429, "PDF processing is busy. Wait for the current upload to finish and try again.");
  }
  activeUsers.add(String(userId));
  return () => activeUsers.delete(String(userId));
};

export const publicDocument = (doc) => ({
  id: String(doc._id), originalFilename: doc.originalFilename,
  fileSize: doc.fileSize, mimeType: doc.mimeType, pageCount: doc.pageCount,
  chunkCount: doc.chunkCount, status: doc.status, processingError: doc.processingError,
  createdAt: doc.createdAt, updatedAt: doc.updatedAt,
});

// Interrupted jobs expire on the next owner-scoped list/status/delete request.
// This never generates embeddings or resumes work automatically.
export const expireInterruptedDocuments = (userId) => Document.updateMany({
  userId, status: { $in: ["uploaded", "processing"] }, processingDeadline: { $lt: new Date() },
}, { $set: { status: "failed", processingError: "Processing was interrupted or timed out. Delete this document to clean up any partial chunks, then upload again." } });

export const processDocument = async (document, temporary, release) => {
  const scope = { _id: document._id, userId: document.userId };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15 * 60 * 1000);
  let indexingStarted = false;
  let stage = "claim-processing";
  const checkpoint = () => {
    if (controller.signal.aborted) throw new ApiError(422, "PDF processing timed out. Delete the document and upload a smaller PDF.");
  };
  try {
    const claim = await Document.updateOne({ ...scope, status: "uploaded", processingDeadline: { $gt: new Date() } }, { $set: { status: "processing" } });
    if (claim.modifiedCount !== 1) throw new ApiError(409, "PDF processing reservation expired. Delete the document and upload again.");
    stage = "extract-text";
    const { pages, pageCount } = await extractPdf(temporary.path, controller.signal);
    // Extraction is the last consumer of original bytes. Do not retain them
    // during provider requests, and never mark Ready if their removal fails.
    stage = "temporary-file-cleanup";
    await removeTemporaryPdf(temporary.directory);
    checkpoint();
    stage = "chunk-text";
    const chunks = chunkPages(pages);
    if (!chunks.length) throw new ApiError(422, "No usable text chunks found. OCR is not implemented.");
    if (chunks.length > 500) throw new ApiError(422, "PDF exceeds the limit of 500 text chunks. Upload a smaller PDF.");
    await Document.updateOne(scope, { $set: { pageCount, chunkCount: chunks.length } });
    stage = "qdrant-preflight";
    const collection = await inspectQdrantCollection();
    if (!collection.exists) throw new ApiError(503, "Qdrant collection is missing. Run npm run qdrant:init from the backend directory.");
    await ensureDocumentPayloadIndexes();
    for (let offset = 0; offset < chunks.length; offset += 2) {
      checkpoint();
      const batch = chunks.slice(offset, offset + 2);
      stage = "generate-embeddings";
      // The installed SDK supports batched contents. Two texts/request; no retries.
      const vectors = await generateEmbeddings(batch.map((chunk) => chunk.text), { signal: controller.signal });
      checkpoint();
      indexingStarted = true;
      stage = "qdrant-upsert";
      await indexChunks(document, batch, vectors);
    }
    checkpoint();
    stage = "save-ready-status";
    const ready = await Document.updateOne({ ...scope, status: "processing", processingDeadline: { $gt: new Date() } }, { $set: { status: "ready", processingError: "" } });
    if (ready.modifiedCount !== 1) throw new ApiError(409, "PDF processing reservation expired before completion. Delete the document and upload again.");
  } catch (error) {
    logServiceError(`document-processing.${stage}`, error);
    let message = error instanceof ApiError ? error.message : "PDF processing failed. Check backend services and upload again.";
    if (indexingStarted) {
      try { await deleteDocumentPoints(document.userId, document._id); }
      catch (cleanupError) { logServiceError("document-processing.cleanup", cleanupError); message += " Partial index cleanup failed; retry document deletion when Qdrant is available."; }
    }
    try { await Document.updateOne(scope, { $set: { status: "failed", processingError: message.slice(0, 500) } }); }
    catch (statusError) { logServiceError("document-processing.save-failure", statusError); }
  } finally {
    clearTimeout(timeout);
    try {
      await removeTemporaryPdf(temporary.directory);
    } catch (cleanupError) {
      logServiceError("document-processing.temporary-cleanup", cleanupError);
      try {
        await Document.updateOne(scope, { $set: { status: "failed", processingError: "Temporary PDF cleanup failed. Check server temporary-storage permissions before retrying." } });
      } catch (statusError) { logServiceError("document-processing.save-cleanup-failure", statusError); }
    } finally { release(); }
  }
};
