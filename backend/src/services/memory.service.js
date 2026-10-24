import mongoose from "mongoose";
import MemoryProfile from "../models/memory.model.js";
import { extractMemories } from "./memory-extraction.service.js";
import { mergeMemoryFacts, selectRelevantMemories } from "./memory-policy.service.js";
import { ApiError } from "../utils/api-error.js";

// The installed MongoDB driver supports CSOT (timeoutMS). Memory is optional:
// do not buffer commands or hold a chat open while its store is unavailable.
const DB_OPTIONS = { timeoutMS: 1200, maxTimeMS: 1000 };
const active = (entries = []) => entries.filter((entry) => !entry.expiresAt || new Date(entry.expiresAt) > new Date());
const readProfile = (userId) => MemoryProfile.findOne({ userId }).setOptions(DB_OPTIONS).lean();
const reportFailure = (operation, error) => {
  // Mongoose validation errors can contain personal values. Never log them.
  console.warn("[memory] Operation unavailable", { operation, name: error?.name, code: typeof error?.code === "number" ? error.code : undefined });
};

const ensureProfile = async (userId) => {
  try {
    return await MemoryProfile.findOneAndUpdate({ userId }, {
      $setOnInsert: { userId, enabled: true, revision: 0, entries: [] },
    }, { ...DB_OPTIONS, upsert: true, new: true, setDefaultsOnInsert: true }).lean();
  } catch (error) {
    if (error.code === 11000) return readProfile(userId);
    throw error;
  }
};

export const prepareMemoryTurn = async ({ userId, conversationId, userMessage, text, extract = true }) => {
  let operation = "read";
  try {
    let profile = await readProfile(userId);
    operation = "extract";
    const facts = extract && userMessage ? extractMemories(text) : [];
    let saveStatus = "not_requested";
    operation = "create_profile";
    if (facts.length && !profile) profile = await ensureProfile(userId);
    if (profile?.enabled === false) return { available: true, enabled: false, items: [], saveStatus: "disabled" };
    if (facts.length) {
      operation = "save";
      saveStatus = "not_saved";
      const messageTime = new Date(userMessage.createdAt);
      // A revision predicate prevents concurrent turns from losing facts. A
      // manual deletion/clear also fences out messages accepted before it.
      for (let attempt = 0; attempt < 2 && profile; attempt++) {
        if (!profile.enabled || (profile.manualChangeAt && messageTime <= new Date(profile.manualChangeAt))) break;
        const merged = mergeMemoryFacts(profile.entries, facts, { conversationId, messageId: userMessage._id }, messageTime, () => new mongoose.Types.ObjectId());
        const updated = await MemoryProfile.findOneAndUpdate({ userId, revision: profile.revision, enabled: true }, {
          $set: { entries: merged.entries }, $inc: { revision: 1 },
        }, { ...DB_OPTIONS, new: true, runValidators: true }).lean();
        if (updated) {
          profile = updated;
          saveStatus = merged.saved === facts.length ? "saved" : "partial";
          console.info("[memory] Fact save completed", { extracted: facts.length, saved: merged.saved });
          break;
        }
        profile = await readProfile(userId);
      }
    }
    if (saveStatus === "not_saved") console.warn("[memory] Fact save skipped after a concurrent or manual change");
    operation = "select";
    const enabled = profile?.enabled !== false;
    return { available: true, enabled, items: enabled ? selectRelevantMemories(profile?.entries || [], text) : [], saveStatus: enabled ? saveStatus : "disabled" };
  } catch (error) {
    reportFailure(`chat.${operation}`, error);
    return { available: false, items: [], saveStatus: "unavailable" };
  }
};

// Safe diagnostics for API clients: no fact values, user IDs, or raw errors.
export const memoryTurnStatus = (context) => {
  const warnings = {
    unavailable: "Saved memory is unavailable for this reply. Chat can continue, but new facts may not have been saved.",
    partial: "Some facts could not be saved. Check Manage memory for capacity and repeat any missing facts.",
    not_saved: "Memory was not updated. Check Manage memory and share the facts again if you want them saved.",
  };
  return { available: context.available, enabled: context.enabled !== false, saveStatus: context.saveStatus,
    retrievedCount: context.items.length, ...(warnings[context.saveStatus] ? { warning: warnings[context.saveStatus] } : {}),
  };
};

const managementOperation = async (operation, work) => {
  try { return await work(); }
  catch (error) {
    if (error instanceof ApiError) throw error;
    reportFailure(operation, error);
    throw new ApiError(503, "Saved memory is temporarily unavailable. Please try again later.");
  }
};

export const listMemories = (userId) => managementOperation("list", async () => {
  let profile = await readProfile(userId);
  // Expired entries are never returned or used, and are pruned atomically on
  // reads/writes. A TTL index on the profile would erase unrelated facts.
  if (profile && active(profile.entries).length !== profile.entries.length) {
    const updated = await MemoryProfile.findOneAndUpdate({ userId, revision: profile.revision }, {
      $set: { entries: active(profile.entries) }, $inc: { revision: 1 },
    }, { ...DB_OPTIONS, new: true }).lean();
    profile = updated || await readProfile(userId);
  }
  return { enabled: profile?.enabled !== false, memories: active(profile?.entries).map((entry) => ({
    id: String(entry._id), category: entry.category, key: entry.key, value: entry.value, status: entry.status,
    alternatives: (entry.alternatives || []).map(({ value }) => value),
    sourceConversationId: entry.sourceConversationId ? String(entry.sourceConversationId) : null,
    createdAt: entry.createdAt, updatedAt: entry.updatedAt, expiresAt: entry.expiresAt,
  })) };
});

export const deleteMemory = (userId, id) => managementOperation("delete", async () => {
  if (!mongoose.isObjectIdOrHexString(id)) throw ApiError.badRequest("Invalid memory ID");
  const profile = await MemoryProfile.findOneAndUpdate({ userId, "entries._id": id }, {
    $pull: { entries: { _id: id } }, $set: { manualChangeAt: new Date() }, $inc: { revision: 1 },
  }, { ...DB_OPTIONS, new: true }).lean();
  if (!profile) throw ApiError.notFound("Memory not found");
});

export const clearMemories = (userId) => managementOperation("clear", () => MemoryProfile.findOneAndUpdate({ userId }, {
  $set: { entries: [], manualChangeAt: new Date() }, $inc: { revision: 1 },
  $setOnInsert: { userId, enabled: true },
}, { ...DB_OPTIONS, upsert: true, new: true, setDefaultsOnInsert: true }).lean());

export const setMemoryEnabled = (userId, enabled) => managementOperation("settings", async () => {
  if (typeof enabled !== "boolean") throw ApiError.badRequest("enabled must be a boolean");
  await MemoryProfile.findOneAndUpdate({ userId }, {
    $set: { enabled, manualChangeAt: new Date() }, $inc: { revision: 1 },
    $setOnInsert: { userId, entries: [] },
  }, { ...DB_OPTIONS, upsert: true, new: true, setDefaultsOnInsert: true }).lean();
  return { enabled };
});
