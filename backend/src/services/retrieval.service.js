import mongoose from "mongoose";
import Document from "../models/document.model.js";
import { generateEmbedding } from "./embedding.service.js";
import { getQdrantClient } from "../config/qdrant.config.js";
import { requireRagEnv } from "../config/rag.config.js";
import { ApiError } from "../utils/api-error.js";
import { qdrantError } from "../utils/service-error.js";

export const resolveRagDocuments = async (userId, documentIds = []) => {
  if (!Array.isArray(documentIds) || documentIds.length > 100 ||
      documentIds.some((id) => typeof id !== "string" || !mongoose.isObjectIdOrHexString(id))) {
    throw ApiError.badRequest("Select at most 100 valid document IDs.");
  }
  const ids = [...new Set(documentIds.map((id) => id.toLowerCase()))];
  let documents;
  try {
    documents = await Document.find({ userId, status: "ready",
      $or: [{ deletionDeadline: null }, { deletionDeadline: { $lte: new Date() } }],
      ...(ids.length ? { _id: { $in: ids } } : {}),
    }).sort({ createdAt: -1, _id: -1 }).limit(100).select("_id originalFilename pageCount chunkCount").lean();
  } catch {
    throw new ApiError(503, "Unable to check document availability. Please try again later.");
  }
  if (ids.length && documents.length !== ids.length) {
    throw ApiError.badRequest("One or more selected documents are unavailable or not ready. Refresh your PDFs and select again.");
  }
  if (!documents.length) throw ApiError.badRequest("No ready PDFs are available. Upload a PDF and wait until it is Ready.");
  return documents;
};

export const retrieveChunks = async ({ userId, question, documentIds = [], signal }) => {
  if (typeof question !== "string" || !question.trim() || question.length > 8000) {
    throw ApiError.badRequest("Question must contain 1–8000 characters.");
  }
  const topK = Number(process.env.RAG_TOP_K || 5);
  if (!Number.isInteger(topK) || topK < 1 || topK > 10) throw new ApiError(503, "RAG_TOP_K must be an integer from 1 to 10.");
  const documents = await resolveRagDocuments(userId, documentIds);
  const owned = new Map(documents.map((doc) => [String(doc._id), doc]));
  const client = getQdrantClient();
  const collection = requireRagEnv("QDRANT_COLLECTION");
  signal?.throwIfAborted();
  const vector = await generateEmbedding(question, { signal });
  signal?.throwIfAborted();
  let points;
  try {
    const result = await client.query(collection, {
      query: vector, limit: topK, with_vector: false,
      with_payload: ["userId", "documentId", "text", "pageStart", "pageEnd", "chunkIndex"],
      filter: { must: [
        { key: "userId", match: { value: String(userId) } },
        { key: "documentId", match: { any: [...owned.keys()] } },
      ] },
    });
    points = result.points;
  } catch (error) {
    throw qdrantError("query", error);
  }
  signal?.throwIfAborted();
  // Recheck readiness after search to exclude documents deleted during retrieval.
  const current = await resolveRagDocuments(userId, [...owned.keys()]);
  const allowed = new Set(current.map((doc) => String(doc._id)));
  return (points || []).flatMap((point) => {
    const p = point.payload;
    const doc = owned.get(p?.documentId);
    if (!doc || !allowed.has(p.documentId) || p.userId !== String(userId) ||
        typeof p.text !== "string" || !p.text.trim() ||
        !Number.isInteger(p.chunkIndex) || p.chunkIndex < 0 || p.chunkIndex >= doc.chunkCount ||
        !Number.isInteger(p.pageStart) || !Number.isInteger(p.pageEnd) ||
        p.pageStart < 1 || p.pageEnd < p.pageStart || p.pageEnd > doc.pageCount) return [];
    return [{ text: p.text.slice(0, 3200), documentId: p.documentId,
      originalFilename: doc.originalFilename, pageStart: p.pageStart, pageEnd: p.pageEnd,
      chunkIndex: p.chunkIndex, chunkReference: String(point.id),
      ...(Number.isFinite(point.score) ? { score: point.score } : {}),
    }];
  });
};
