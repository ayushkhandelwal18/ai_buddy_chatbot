import Conversation from "../models/conversation.model.js";
import Message from "../models/message.model.js";
import { ApiError } from "../utils/api-error.js";
import { generateConversationTitle } from "./gemini.service.js";
import { resolveRagDocuments } from "./retrieval.service.js";

/**
 * Data access layer for conversations + messages.
 *
 * Every read/write is scoped by `userId`, so a conversation id belonging to
 * another user simply does not resolve — there is no code path that returns
 * or mutates another user's data.
 */

/** Serialises a conversation document for the API. */
export const serializeConversation = (conversation) => ({
  id: conversation._id.toString(),
  title: conversation.title,
  lastMessage: conversation.lastMessage || "",
  lastMessageAt: conversation.lastMessageAt,
  messageCount: conversation.messageCount || 0,
  isLegacy: Boolean(conversation.isLegacy),
  documentIds: (conversation.documentIds || []).map(String),
  createdAt: conversation.createdAt,
  updatedAt: conversation.updatedAt,
});

/** Serialises a message document for the API. */
export const serializeMessage = (message) => ({
  id: message._id.toString(),
  conversationId: message.conversationId.toString(),
  role: message.role,
  content: message.content,
  status: message.status || "complete",
  rag: Boolean(message.rag),
  documentIds: (message.documentIds || []).map(String),
  sources: message.sources || [],
  createdAt: message.createdAt,
});

export const listConversations = async (userId, { limit = 30, skip = 0 } = {}) => {
  const [conversations, total] = await Promise.all([
    Conversation.find({ userId })
      .sort({ lastMessageAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Conversation.countDocuments({ userId }),
  ]);

  return {
    conversations: conversations.map(serializeConversation),
    total,
    hasMore: skip + conversations.length < total,
  };
};

/**
 * Fetches a conversation that belongs to the given user.
 * Throws 404 when it does not exist or belongs to somebody else.
 */
export const getConversationForUser = async (userId, conversationId) => {
  if (!conversationId) {
    throw ApiError.notFound("Conversation not found");
  }

  let conversation;
  try {
    conversation = await Conversation.findOne({ _id: conversationId, userId }).lean();
  } catch (error) {
    // Malformed ObjectId — treat it as "not found" rather than leaking a 500.
    if (error.name === "CastError") {
      throw ApiError.notFound("Conversation not found");
    }
    throw error;
  }

  if (!conversation) {
    throw ApiError.notFound("Conversation not found");
  }

  // Older conversations keep their attachment references on user messages.
  if (!Array.isArray(conversation.documentIds)) {
    const last = await Message.findOne({ conversationId: conversation._id, userId, role: "user", rag: true })
      .sort({ _id: -1 }).select("documentIds").lean();
    conversation.documentIds = last?.documentIds || [];
  }

  return conversation;
};

export const resolveConversationAttachments = async (userId, conversation, request = {}) => {
  const explicit = request.documentIds !== undefined;
  const selected = explicit ? request.documentIds
    : request.rag === false ? [] : (conversation.documentIds || []).map(String);
  if (!Array.isArray(selected)) throw ApiError.badRequest("documentIds must be an array.");
  // IDs activate RAG without requiring a separate checkbox/flag.
  const rag = selected.length > 0 || (request.rag === true && !explicit);
  const documentIds = rag
    ? (await resolveRagDocuments(userId, selected)).map((doc) => String(doc._id)) : [];
  if (explicit || request.rag !== undefined) {
    await Conversation.updateOne({ _id: conversation._id, userId }, { $set: { documentIds } });
  }
  conversation.documentIds = documentIds;
  return { rag, documentIds };
};

export const createConversation = async (userId, { title } = {}) => {
  const conversation = await Conversation.create({
    userId,
    title: title && title.trim() ? title.trim().slice(0, 120) : "New chat",
  });
  return conversation;
};

export const renameConversation = async (userId, conversationId, title) => {
  const conversation = await Conversation.findOneAndUpdate(
    { _id: conversationId, userId },
    { title: title.trim().slice(0, 120) },
    { new: true }
  ).lean();

  if (!conversation) {
    throw ApiError.notFound("Conversation not found");
  }
  return conversation;
};

export const deleteConversation = async (userId, conversationId) => {
  const conversation = await Conversation.findOneAndDelete({
    _id: conversationId,
    userId,
  });

  if (!conversation) {
    throw ApiError.notFound("Conversation not found");
  }

  await Message.deleteMany({ conversationId: conversation._id });
  return conversation;
};

export const deleteAllConversations = async (userId) => {
  const conversations = await Conversation.find({ userId }).select("_id").lean();
  const ids = conversations.map((c) => c._id);

  if (ids.length) {
    await Message.deleteMany({ conversationId: { $in: ids } });
  }
  await Conversation.deleteMany({ userId });

  return ids.length;
};

/**
 * Paginated message history.
 *
 * `before` is a cursor (message id): only messages older than it are returned.
 * When `before` is not supplied, `skip` is used for offset pagination.
 * Messages are always returned oldest → newest.
 */
export const listMessages = async (
  conversationId,
  { limit = 20, before, skip = 0 } = {}
) => {
  const query = { conversationId };
  if (before) {
    query._id = { $lt: before };
  }

  const pageSize = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const offset = before ? 0 : Math.max(Number(skip) || 0, 0);

  const docs = await Message.find(query)
    .sort({ _id: -1 })
    .skip(offset)
    .limit(pageSize + 1)
    .lean();

  const hasMore = docs.length > pageSize;
  const messages = docs.slice(0, pageSize).reverse().map(serializeMessage);

  return { messages, hasMore };
};

/**
 * The most recent messages of a conversation, oldest → newest.
 * Used to build the Gemini context window.
 *
 * `before` excludes that message id and everything after it — used when the
 * message we are about to send must not appear in its own history.
 */
export const getRecentMessages = async (conversationId, limit, before) => {
  const query = { conversationId };
  if (before) {
    query._id = { $lt: before };
  }

  const docs = await Message.find(query)
    .sort({ _id: -1 })
    .limit(limit)
    .lean();

  return docs.reverse();
};

export const appendMessage = async ({ conversationId, userId, role, content, status, rag = false, documentIds = [], sources = [] }) => {
  const message = await Message.create({
    conversationId,
    userId,
    role,
    content,
    rag,
    documentIds,
    sources,
    ...(status ? { status } : {}),
  });
  return message;
};

/**
 * Marks a message with a new status (used to flag a turn whose answer never
 * arrived because the AI provider was unavailable).
 */
export const markMessageStatus = async (messageId, status) => {
  return Message.findByIdAndUpdate(
    messageId,
    { $set: { status } },
    { new: true }
  );
};

export const getMessageForUser = async (conversationId, userId, messageId) => {
  const message = await Message.findOne({
    _id: messageId,
    conversationId,
    userId,
  }).lean();

  if (!message) {
    throw ApiError.notFound("Message not found");
  }
  return message;
};

/**
 * Removes every message after `messageId` inside a conversation.
 * Used by "regenerate": the old answer and anything that followed it is
 * dropped so the thread stays consistent.
 */
export const deleteMessagesAfter = async (conversationId, messageId) => {
  const result = await Message.deleteMany({
    conversationId,
    _id: { $gt: messageId },
  });
  return result.deletedCount || 0;
};

export const deleteMessage = async (conversationId, userId, messageId) => {
  const result = await Message.deleteOne({ _id: messageId, conversationId, userId });
  return result.deletedCount || 0;
};

/**
 * Recomputes the denormalised conversation metadata (preview, count, sort key)
 * after the message list changed.
 */
export const syncConversationMeta = async (conversationId, { title } = {}) => {
  const [lastMessage, messageCount] = await Promise.all([
    Message.findOne({ conversationId }).sort({ _id: -1 }).lean(),
    Message.countDocuments({ conversationId }),
  ]);

  const update = {
    lastMessageAt: lastMessage?.createdAt || new Date(),
    messageCount,
    lastMessage: (lastMessage?.content || "").replace(/\s+/g, " ").slice(0, 280),
  };

  if (title) {
    update.title = title;
  }

  return Conversation.findByIdAndUpdate(conversationId, update, { new: true }).lean();
};

/**
 * Gives a conversation a meaningful title once its first user message exists.
 * Conversations that already have a title are left untouched.
 */
export const ensureConversationTitle = async (conversation, firstMessage) => {
  const needsTitle = !conversation.title || conversation.title === "New chat";
  if (!needsTitle) {
    return conversation.title;
  }

  const title = await generateConversationTitle(firstMessage);
  await syncConversationMeta(conversation._id, { title });
  return title;
};
