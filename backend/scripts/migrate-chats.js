/**
 * ---------------------------------------------------------------------------
 * MIGRATION: user.chats  →  conversations + messages
 * ---------------------------------------------------------------------------
 * The original app stored every message of every user inside a single
 * `users.chats` array. This script moves that history into the new
 * `conversations` / `messages` collections, one conversation per user
 * (flagged `isLegacy`), and then clears the old array.
 *
 * The script is safe and idempotent:
 *   - a user that already owns a legacy conversation is skipped;
 *   - `--dry-run` shows what would happen without writing anything.
 *
 * Usage:
 *   npm run migrate              # run the migration
 *   npm run migrate -- --dry-run # preview only
 */

import { config } from "dotenv";
import mongoose from "mongoose";
import Conversation from "../src/models/conversation.model.js";
import Message from "../src/models/message.model.js";
import User from "../src/models/user.model.js";
import { fallbackTitle } from "../src/services/gemini.service.js";

config();

const DRY_RUN = process.argv.includes("--dry-run");

const titleFromChats = (chats = []) => {
  const firstUserMessage = chats.find((c) => c.role === "user");
  return fallbackTitle(firstUserMessage?.content || chats[0]?.content || "Previous chat");
};

const run = async () => {
  await mongoose.connect(process.env.MONGO_URL);
  console.log(`[migrate] connected${DRY_RUN ? " (dry run)" : ""}`);

  // Every user that ever had a chat is inspected — users whose chats array is
  // already empty were migrated before, and are reported as skipped.
  const users = await User.find({ chats: { $type: "array" } }).lean();

  let migrated = 0;
  let skipped = 0;
  let messagesCreated = 0;

  for (const user of users) {
    const chats = Array.isArray(user.chats) ? user.chats : [];

    const existing = await Conversation.findOne({ userId: user._id, isLegacy: true });
    if (existing || !chats.length) {
      skipped += 1;
      console.log(
        `[migrate] user ${user.email} already migrated — skipping` +
          (chats.length ? "" : " (no legacy messages left)")
      );
      continue;
    }

    const documents = chats.map((chat) => ({
      conversationId: null,
      userId: user._id,
      role: chat.role === "assistant" ? "assistant" : "user",
      content: chat.content,
      status: "complete",
      legacyId: chat.id || null,
      // The original ObjectId still carries its creation time.
      createdAt: chat._id?.getTimestamp?.() || new Date(),
      updatedAt: chat._id?.getTimestamp?.() || new Date(),
    }));

    const lastMessageAt =
      documents[documents.length - 1]?.createdAt || new Date();

    if (DRY_RUN) {
      console.log(
        `[migrate] would migrate ${documents.length} message(s) for ${user.email} ` +
          `→ "${titleFromChats(chats)}"`
      );
      migrated += 1;
      messagesCreated += documents.length;
      continue;
    }

    const conversation = await Conversation.create({
      userId: user._id,
      title: titleFromChats(chats),
      isLegacy: true,
      lastMessageAt,
      messageCount: documents.length,
      lastMessage: (documents[documents.length - 1]?.content || "")
        .replace(/\s+/g, " ")
        .slice(0, 280),
    });

    documents.forEach((doc) => {
      doc.conversationId = conversation._id;
    });

    await Message.insertMany(documents, { ordered: true });

    // The old array is emptied only after the new documents exist.
    await User.updateOne({ _id: user._id }, { $set: { chats: [] } });

    migrated += 1;
    messagesCreated += documents.length;
    console.log(
      `[migrate] ${user.email}: ${documents.length} message(s) → conversation ${conversation._id}`
    );
  }

  console.log(
    `[migrate] done — users migrated: ${migrated}, skipped: ${skipped}, messages: ${messagesCreated}`
  );

  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error("[migrate] failed:", error);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
