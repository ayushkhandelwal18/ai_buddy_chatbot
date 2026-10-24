import { getQdrantClient } from "../config/qdrant.config.js";
import { EMBEDDING_DIMENSIONS, requireRagEnv } from "../config/rag.config.js";
import { ApiError } from "../utils/api-error.js";
import { qdrantError } from "../utils/service-error.js";

const requestQdrant = async (stage, operation) => {
  try {
    return await operation();
  } catch (error) {
    throw qdrantError(stage, error);
  }
};

const validateCollection = (info) => {
  const vectors = info.config?.params?.vectors;
  if (!vectors || vectors.size !== EMBEDDING_DIMENSIONS || vectors.distance !== "Cosine" || vectors.multivector_config) {
    throw new ApiError(409, "QDRANT_COLLECTION must use a single unnamed 768-dimensional vector with Cosine distance. Select a compatible collection or a new collection name; existing data was not changed.");
  }
};

// Read-only inspection. Missing collections are reported without creating them.
export const inspectQdrantCollection = async () => {
  const collection = requireRagEnv("QDRANT_COLLECTION");
  const client = getQdrantClient();
  const { exists } = await requestQdrant("collection-exists", () => client.collectionExists(collection));
  if (!exists) return { exists: false };
  const info = await requestQdrant("collection-config", () => client.getCollection(collection));
  validateCollection(info);
  return { exists: true, size: EMBEDDING_DIMENSIONS, distance: "Cosine", status: info.status };
};

// Explicit initialization only; never called by application startup.
export const initializeQdrantCollection = async () => {
  const existing = await inspectQdrantCollection();
  if (existing.exists) return { ...existing, created: false };
  const client = getQdrantClient();
  const collection = requireRagEnv("QDRANT_COLLECTION");
  try {
    await client.createCollection(collection, {
      vectors: { size: EMBEDDING_DIMENSIONS, distance: "Cosine" },
    });
  } catch (error) {
    if (error.status !== 409 && error.statusCode !== 409) throw qdrantError("create-collection", error);
    // Another initializer may have created it concurrently. Re-read safely.
    const current = await inspectQdrantCollection();
    if (current.exists) return { ...current, created: false };
    throw qdrantError("create-collection", error);
  }
  return { ...(await inspectQdrantCollection()), created: true };
};
