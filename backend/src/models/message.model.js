import mongoose from "mongoose";

/**
 * A single message inside a conversation.
 *
 * `userId` is denormalised onto the message so that every read/write can be
 * scoped to the owner in a single query — a conversation id alone is never
 * enough to authorise access.
 */
const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ["user", "assistant"],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    // "stopped" = the user aborted a streamed answer, "error" = the provider
    // failed mid-answer. Both keep the partial content for context.
    // "failed" = a user message whose answer never arrived (provider down).
    // Failed turns are kept in the transcript but excluded from the context
    // that is sent to the model.
    status: {
      type: String,
      enum: ["complete", "stopped", "error", "failed"],
      default: "complete",
    },
    // Original uuid of the message inside `user.chats` — kept so migrated
    // history stays traceable back to the original document.
    legacyId: {
      type: String,
      default: null,
    },
    rag: { type: Boolean, default: false },
    documentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Document" }],
    sources: { type: [new mongoose.Schema({
      sourceId: String, documentId: String, originalFilename: String,
      pageStart: Number, pageEnd: Number, chunkIndex: Number,
      chunkReference: String, score: Number,
      sourceType: { type: String, enum: ["document", "memory"] },
      memoryId: String, category: String, key: String,
    }, { _id: false })], default: [] },
  },
  { timestamps: true }
);

// Paginated history reads for one conversation.
messageSchema.index({ conversationId: 1, _id: -1 });

export default mongoose.model("Message", messageSchema);
