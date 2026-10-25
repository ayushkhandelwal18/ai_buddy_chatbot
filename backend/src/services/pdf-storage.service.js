import { createReadStream } from "node:fs";
import { lstat, mkdtemp, open, readdir, realpath, rm, unlink } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ApiError } from "../utils/api-error.js";
import { logServiceError } from "../utils/service-error.js";

const temporaryRoot = path.resolve(tmpdir());
const prefix = "ai-buddy-pdf-";
const temporaryName = /^ai-buddy-pdf-(\d+)-[A-Za-z0-9]{6}$/;
const activeDirectories = new Set();
// Read/delete compatibility only: no new files or directories are created here.
const legacyDirectory = fileURLToPath(new URL("../../uploads/pdfs/", import.meta.url));

export const createTemporaryPdf = async () => {
  const directory = await mkdtemp(path.join(temporaryRoot, `${prefix}${process.pid}-`));
  activeDirectories.add(directory);
  return { directory, path: path.join(directory, `${randomUUID()}.pdf`) };
};

export const removeTemporaryPdf = async (directory) => {
  const target = path.resolve(directory);
  // Recursive removal is restricted to a generated direct child of the OS temp root.
  if (path.dirname(target) !== temporaryRoot || !temporaryName.test(path.basename(target))) {
    throw new ApiError(500, "Invalid temporary PDF identifier.");
  }
  try {
    await rm(target, { recursive: true, force: true, maxRetries: 2, retryDelay: 100 });
  } catch (error) {
    logServiceError("pdf.temporary-cleanup", error);
    throw new ApiError(503, "Temporary PDF cleanup failed. Check the server's temporary-storage permissions.");
  } finally {
    activeDirectories.delete(target);
  }
};

export const fingerprintPdf = async (filename) => {
  const handle = await open(filename, "r");
  try {
    const signature = Buffer.alloc(5);
    const { bytesRead } = await handle.read(signature, 0, signature.length, 0);
    if (bytesRead !== 5 || signature.toString("ascii") !== "%PDF-") {
      throw ApiError.badRequest("Invalid PDF signature. Select a valid PDF file.");
    }
  } finally {
    await handle.close();
  }
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filename, { highWaterMark: 64 * 1024 })) hash.update(chunk);
  return hash.digest("hex");
};

const entries = async (directory) => {
  try { return await readdir(directory, { withFileTypes: true }); }
  catch (error) { if (error.code === "ENOENT") return []; throw error; }
};

const cleanAbandonedPdfs = async () => {
  for (const entry of await entries(temporaryRoot)) {
    const match = temporaryName.exec(entry.name);
    if (!entry.isDirectory() || !match) continue;
    const directory = path.join(temporaryRoot, entry.name);
    if (activeDirectories.has(directory)) continue;
    if (Number(match[1]) !== process.pid) {
      // Do not remove another running backend's upload, regardless of its age.
      try { process.kill(Number(match[1]), 0); continue; }
      catch (error) { if (error.code !== "ESRCH") continue; }
    }
    try {
      await removeTemporaryPdf(directory);
    } catch (error) { if (error.code !== "ENOENT") logServiceError("pdf.abandoned-cleanup", error); }
  }
};

const cleanLegacyPdfs = async () => {
  try {
    const legacy = await lstat(legacyDirectory);
    if (!legacy.isDirectory() || legacy.isSymbolicLink() || path.relative(path.resolve(legacyDirectory), await realpath(legacyDirectory)) !== "") return;
  } catch (error) { if (error.code === "ENOENT") return; throw error; }
  for (const entry of await entries(legacyDirectory)) {
    // Old originals are unnecessary for ready-document retrieval. Never touch
    // unknown filenames, other directories, Mongo metadata, or Qdrant points.
    if (!entry.isFile() || !/^[0-9a-f-]{36}\.pdf$/i.test(entry.name)) continue;
    try { await unlink(path.join(legacyDirectory, entry.name)); }
    catch (error) { if (error.code !== "ENOENT") logServiceError("pdf.legacy-cleanup", error); }
  }
};

export const startPdfCleanup = async () => {
  const cleanup = () => Promise.all([
    cleanAbandonedPdfs().catch((error) => logServiceError("pdf.abandoned-cleanup", error)),
    cleanLegacyPdfs().catch((error) => logServiceError("pdf.legacy-cleanup", error)),
  ]);
  await cleanup();
  const timer = setInterval(() => { void cleanup(); }, 5 * 60 * 1000);
  timer.unref();
};
