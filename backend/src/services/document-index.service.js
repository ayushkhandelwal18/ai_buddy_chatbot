import { createHash } from "node:crypto";
import { getQdrantClient } from "../config/qdrant.config.js";
import { EMBEDDING_DIMENSIONS, requireRagEnv } from "../config/rag.config.js";
import { ApiError } from "../utils/api-error.js";
import { qdrantError } from "../utils/service-error.js";

const documentFilter = (userId, documentId) => ({ must: [
  { key: "userId", match: { value: String(userId) } },
  { key: "documentId", match: { value: String(documentId) } },
] });

// Keyword indexes support owner/document filters, including strict-mode clusters.
export const ensureDocumentPayloadIndexes = async () => {
  const client = getQdrantClient();
  const collection = requireRagEnv("QDRANT_COLLECTION");
  try {
    const info = await client.getCollection(collection);
    for (const field of ["userId", "documentId"]) {
      const existing = info.payload_schema?.[field];
      if (existing && existing.data_type !== "keyword") throw new ApiError(409, "Qdrant userId and documentId payload indexes must use keyword fields.");
      if (!existing) {
        const result = await client.createPayloadIndex(collection, {
          field_name: field, field_schema: "keyword", wait: true,
        });
        if (result.status !== "completed") throw new Error();
      }
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw qdrantError("payload-indexes", error);
  }
};

export const chunkPointId = (documentId, chunkIndex) => {
  const hash = createHash("sha256").update(`${documentId}:${chunkIndex}`).digest("hex").slice(0, 32).split("");
  hash[12] = "5";
  hash[16] = "89ab"[parseInt(hash[16], 16) % 4];
  const hex = hash.join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

export const indexChunks = async (document, chunks, vectors) => {
  if (chunks.length !== vectors.length || vectors.some((vector) =>
    !Array.isArray(vector) || vector.length !== EMBEDDING_DIMENSIONS || !vector.every(Number.isFinite))) {
    throw new ApiError(502, "Invalid chunk embedding dimensions.");
  }
  const client = getQdrantClient();
  const collection = requireRagEnv("QDRANT_COLLECTION");
  try {
    const result = await client.upsert(collection, { wait: true, points: chunks.map((chunk, index) => ({
      id: chunkPointId(document._id, chunk.chunkIndex), vector: vectors[index],
      payload: { ...chunk, userId: String(document.userId), documentId: String(document._id), originalFilename: document.originalFilename },
    })) });
    if (result.status !== "completed") throw new Error();
  } catch (error) {
    throw qdrantError("upsert-chunks", error);
  }
};

export const deleteDocumentPoints = async (userId, documentId) => {
  const client = getQdrantClient();
  const collection = requireRagEnv("QDRANT_COLLECTION");
  try {
    const { exists } = await client.collectionExists(collection);
    if (!exists) return; // Already removed; no indexed points can remain.
    const result = await client.delete(collection, { wait: true, filter: documentFilter(userId, documentId) });
    if (result.status !== "completed") throw new Error();
  } catch (error) {
    throw qdrantError("delete-chunks", error);
  }
};
