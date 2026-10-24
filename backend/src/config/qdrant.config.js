import { QdrantClient } from "@qdrant/js-client-rest";
import { requireRagEnv } from "./rag.config.js";
import { ApiError } from "../utils/api-error.js";
import { causedError, logServiceError } from "../utils/service-error.js";

let client;

// Lazy singleton: importing this module never contacts Qdrant.
export const getQdrantClient = () => {
  if (client) return client;
  const url = requireRagEnv("QDRANT_URL");
  const apiKey = requireRagEnv("QDRANT_API_KEY");
  let parsed;
  try {
    parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) {
      throw new Error();
    }
  } catch {
    throw new ApiError(503, "QDRANT_URL must be an HTTP(S) URL without embedded credentials.");
  }
  if (["cloud.qdrant.io", "qdrant.io", "www.qdrant.io"].includes(parsed.hostname.toLowerCase())) {
    throw new ApiError(503, "QDRANT_URL points to the Qdrant dashboard. Use the cluster REST endpoint from the cluster overview.");
  }
  try {
    client = new QdrantClient({
      url: parsed.origin, prefix: parsed.pathname === "/" ? "" : parsed.pathname.replace(/\/$/, ""),
      // Honor the URL's standard HTTP(S) port when no explicit port is supplied.
      port: parsed.port ? Number(parsed.port) : null,
      apiKey, timeout: 10000, checkCompatibility: false,
    });
  } catch (error) {
    logServiceError("qdrant.client-init", error);
    throw causedError(503, "Could not configure Qdrant client. Check QDRANT_URL and QDRANT_API_KEY.", error);
  }
  return client;
};
