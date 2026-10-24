import mongoose from "mongoose";

const documentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  originalFilename: { type: String, required: true, maxlength: 255 },
  storageFilename: { type: String, required: true, select: false },
  contentHash: { type: String, select: false },
  fileSize: { type: Number, required: true },
  mimeType: { type: String, default: "application/pdf" },
  pageCount: { type: Number, default: null },
  chunkCount: { type: Number, default: 0 },
  status: { type: String, enum: ["uploaded", "processing", "ready", "failed"], default: "uploaded" },
  processingError: { type: String, default: "", maxlength: 500 },
  processingDeadline: { type: Date, select: false },
  deletionDeadline: { type: Date, select: false },
}, { timestamps: true });
documentSchema.index({ userId: 1, createdAt: -1 });
// Existing records without a fingerprint are excluded; new uploads/retries use
// one metadata record per owner and PDF content, including concurrent retries.
documentSchema.index({ userId: 1, contentHash: 1 }, { unique: true,
  partialFilterExpression: { contentHash: { $type: "string" } } });
export default mongoose.model("Document", documentSchema);
