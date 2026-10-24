import { GoogleGenAI } from "@google/genai";
import { EMBEDDING_MODEL, EMBEDDING_DIMENSIONS, requireRagEnv } from "../config/rag.config.js";
import { ApiError } from "../utils/api-error.js";
import { causedError, logServiceError } from "../utils/service-error.js";

let client;

export const generateEmbeddings = async (texts, { signal } = {}) => {
  if (!Array.isArray(texts) || !texts.length || texts.length > 8 ||
      texts.some((text) => typeof text !== "string" || !text.trim())) {
    throw ApiError.badRequest("Embedding input must contain 1–8 non-empty texts.");
  }
  if (!client) {
    client = new GoogleGenAI({ apiKey: requireRagEnv("Gemini_API_KEY_for_embedding") });
  }

  let response;
  try {
    response = await client.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: texts.map((text) => text.trim()),
      config: {
        outputDimensionality: EMBEDDING_DIMENSIONS,
        abortSignal: signal,
        httpOptions: { timeout: 60000, retryOptions: { attempts: 1 } },
      },
    });
  } catch (error) {
    logServiceError("embedding-request", error);
    if (error.status === 429 || error.statusCode === 429) {
      throw causedError(429, "Embedding quota or rate limit reached. Wait for quota to reset before trying again.", error);
    }
    // Provider errors can contain request details; never forward or log them.
    throw causedError(502, "Embedding generation failed. Check the embedding API key, quota, and provider availability.", error);
  }

  if (response.embeddings?.length !== texts.length) {
    throw new ApiError(502, "Embedding provider returned an unexpected number of vectors.");
  }
  return response.embeddings.map(({ values: vector }) => {
    if (!Array.isArray(vector) || vector.length !== EMBEDDING_DIMENSIONS || !vector.every(Number.isFinite)) {
      throw new ApiError(502, "Embedding provider returned an invalid vector; expected 768 finite numbers.");
    }
    const norm = Math.hypot(...vector);
    if (!Number.isFinite(norm) || norm === 0) {
      throw new ApiError(502, "Embedding provider returned a vector with an invalid magnitude.");
    }
    // gemini-embedding-001 requires normalization for reduced dimensions.
    return vector.map((value) => value / norm);
  });
};

export const generateEmbedding = async (text, options = {}) =>
  (await generateEmbeddings([text], options))[0];
