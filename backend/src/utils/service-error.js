import { ApiError } from "./api-error.js";

const statusOf = (error) => error?.status || error?.statusCode || error?.response?.status ||
  Number(/^Unexpected Response:\s*(\d{3})/.exec(error?.message || "")?.[1]) || undefined;

const redact = (value) => {
  let text = String(value || "");
  for (const [name, secret] of Object.entries(process.env)) {
    if (/(?:key|secret|token|password|mongo_url|qdrant_url)/i.test(name) && secret?.length > 3) {
      text = text.split(secret).join("[redacted]");
    }
  }
  return text.replace(/https?:\/\/[^\s'"<>]+/gi, "[endpoint]")
    .replace(/(?:mongodb(?:\+srv)?:)\/\/[^\s'"<>]+/gi, "[database]")
    .replace(/((?:api[-_ ]?key|authorization|password|token)\s*[:=]\s*)[^\s,;}]+/gi, "$1[redacted]");
};

// Retain useful exception details without dumping request headers, credentials,
// PDF contents, or arbitrary provider response bodies into logs.
export const logServiceError = (stage, error) => {
  const chain = [];
  const seen = new Set();
  for (let current = error; current && chain.length < 5 && !seen.has(current); current = current.cause) {
    seen.add(current);
    chain.push({ name: redact(current.name), code: redact(current.code),
      status: statusOf(current),
      message: redact(current.message),
      providerMessage: typeof current.data?.status?.error === "string" ? redact(current.data.status.error) : undefined,
      stack: redact(current.stack) });
  }
  console.error("[service-error]", { stage, errors: chain });
};

export const causedError = (status, message, cause) => {
  const error = new ApiError(status, message);
  // Keep the exception for diagnostics; the shared logger redacts this chain
  // and the API response includes only status/message/details.
  Object.defineProperty(error, "cause", { value: cause });
  return error;
};

export const qdrantError = (stage, error) => {
  logServiceError(`qdrant.${stage}`, error);
  const status = statusOf(error);
  const codes = [error.code, error.cause?.code, error.cause?.cause?.code];
  if (status === 401 || status === 403) return causedError(503, "Qdrant rejected access. Check that QDRANT_API_KEY belongs to this cluster and permits this operation.", error);
  if (status === 404) return causedError(503, "Qdrant collection or REST endpoint was not found. Check QDRANT_COLLECTION and the cluster endpoint.", error);
  if (status === 429 || error.name === "QdrantClientResourceExhaustedError") return causedError(503, "Qdrant rate or resource limit reached. Wait before retrying the upload.", error);
  if (/timeout|abort/i.test(error.name || "") || codes.some((code) => ["ETIMEDOUT", "UND_ERR_CONNECT_TIMEOUT"].includes(code))) {
    return causedError(503, "Qdrant connection timed out after 10 seconds. Check cluster availability, network access, and the endpoint port.", error);
  }
  if (codes.some((code) => ["ENOTFOUND", "EAI_AGAIN"].includes(code))) return causedError(503, "Qdrant cluster hostname could not be resolved. Check QDRANT_URL and DNS/network access.", error);
  if (codes.some((code) => ["ECONNREFUSED", "ECONNRESET", "ENETUNREACH", "EHOSTUNREACH"].includes(code))) return causedError(503, "Cannot connect to the Qdrant cluster. Check cluster availability, network access, and the endpoint port.", error);
  if (status === 400 || status === 409) return causedError(409, "Qdrant rejected the collection or vector configuration. Check the 768-dimensional Cosine collection and keyword payload indexes.", error);
  return causedError(503, "Qdrant is unavailable. Check the cluster REST endpoint and the backend service diagnostics.", error);
};
