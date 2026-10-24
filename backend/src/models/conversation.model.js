import mongoose from "mongoose";

/**
 * A single chat thread owned by exactly one user.
 *
 * Messages live in their own collection (see message.model.js) so a user can
 * have many independent conversations without hitting the 16MB document limit
 * of a single embedded array.
 */
const conversationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      default: "New chat",
      trim: true,
      maxlength: 120,
    },
    documentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Document" }],
    // Short preview of the last message, used for the sidebar list.
    lastMessage: {
      type: String,
      default: "",
      maxlength: 280,
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    messageCount: {
      type: Number,
      default: 0,
    },
    // True for conversations created by the legacy /chat/* migration.
    // The legacy endpoints keep operating on this thread.
    isLegacy: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Sidebar listing: newest conversations of a user first.
conversationSchema.index({ userId: 1, lastMessageAt: -1, _id: -1 });

export default mongoose.model("Conversation", conversationSchema);
