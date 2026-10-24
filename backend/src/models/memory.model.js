import mongoose from "mongoose";

const alternativeSchema = new mongoose.Schema({
  value: { type: String, required: true, maxlength: 240 },
  sourceConversationId: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation" },
  sourceMessageId: { type: mongoose.Schema.Types.ObjectId, ref: "Message" },
  updatedAt: { type: Date, required: true },
}, { _id: false });

const entrySchema = new mongoose.Schema({
  category: { type: String, enum: ["personal", "education", "skills", "projects", "preferences", "learning", "goals"], required: true },
  key: { type: String, required: true, maxlength: 80 },
  value: { type: String, required: true, maxlength: 240 },
  status: { type: String, enum: ["confirmed", "conflict"], default: "confirmed" },
  alternatives: { type: [alternativeSchema], default: [], validate: (values) => values.length <= 3 },
  sourceConversationId: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation" },
  sourceMessageId: { type: mongoose.Schema.Types.ObjectId, ref: "Message" },
  expiresAt: { type: Date, default: null },
  createdAt: { type: Date, required: true },
  updatedAt: { type: Date, required: true },
});

// One bounded profile makes updates, clears, and deletion races atomic without
// requiring a replica-set transaction or a second vector database.
const memorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  enabled: { type: Boolean, default: true },
  revision: { type: Number, default: 0 },
  manualChangeAt: { type: Date, default: null },
  entries: { type: [entrySchema], default: [], validate: (entries) => entries.length <= 128 },
}, { timestamps: true, versionKey: false, bufferCommands: false });
memorySchema.index({ userId: 1 }, { unique: true });

export default mongoose.model("MemoryProfile", memorySchema);
