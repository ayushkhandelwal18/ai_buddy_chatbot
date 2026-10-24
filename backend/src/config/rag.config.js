import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { ApiError } from "../utils/api-error.js";

export const BACKEND_ENV_PATH = fileURLToPath(new URL("../../.env", import.meta.url));
// Resolve from this module, not the terminal's working directory. Existing
// deployment environment variables still take precedence over the local file.
dotenv.config({ path: BACKEND_ENV_PATH, quiet: true });

export const EMBEDDING_MODEL = "gemini-embedding-001";
export const EMBEDDING_DIMENSIONS = 768;

export const requireRagEnv = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new ApiError(503, `Missing required configuration: ${name}`);
  return value;
};
