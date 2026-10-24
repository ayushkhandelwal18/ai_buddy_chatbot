import Conversation from "../models/conversation.model.js";
import Message from "../models/message.model.js";
import {
  appendMessage,
  getRecentMessages,
  syncConversationMeta,
  ensureConversationTitle,
} from "../services/conversation.service.js";
import { generateReply, HISTORY_LIMIT } from "../services/gemini.service.js";
import { prepareMemoryTurn, memoryTurnStatus } from "../services/memory.service.js";

/**
 * ---------------------------------------------------------------------------
 * LEGACY CHAT ENDPOINTS
 * ---------------------------------------------------------------------------
 * These are the original `/api/v1/chat/*` routes. They are kept working (and
 * unchanged in their request/response shape) so nothing that already uses the
 * old API breaks.
 *
 * They now run on top of the new conversation/message collections and are
 * mapped onto a single "legacy" conversation per user, which is also where
 * the migration moves the old `user.chats` history.
 */

const getLegacyConversation = async (userId) => {
  let conversation = await Conversation.findOne({ userId, isLegacy: true });
  if (!conversation) {
    conversation = await Conversation.create({
      userId,
      title: "Default Chat",
      isLegacy: true,
    });
  }
  return conversation;
};

/**
 * POST /api/v1/chat/new
 * Sends a message and returns the last 10 messages of the conversation.
 */
export const generateChatCompletion = async (req, res, next) => {
  const { message } = req.body;

  try {
    const userId = res.locals.jwtData.id;
    const conversation = await getLegacyConversation(userId);

    const history = await getRecentMessages(conversation._id, HISTORY_LIMIT);
    const userMessage = await appendMessage({
      conversationId: conversation._id,
      userId,
      role: "user",
      content: message,
    });

    const memoryContext = await prepareMemoryTurn({ userId, conversationId: conversation._id, userMessage, text: message });
    const reply = await generateReply({ history, message, memoryContext });

    await appendMessage({
      conversationId: conversation._id,
      userId,
      role: "assistant",
      content: reply,
    });

    await ensureConversationTitle(conversation, message);
    await syncConversationMeta(conversation._id);

    // Same shape as before: the last 10 messages, oldest → newest.
    const chats = await Message.find({ conversationId: conversation._id })
      .sort({ _id: -1 })
      .limit(10)
      .lean();

    return res.status(200).json({ chats: chats.reverse().map(toLegacyChat), memory: memoryTurnStatus(memoryContext) });
  } catch (error) {
    console.error("Gemini Error:", error);
    const providerDown =
      error?.status === 429 ||
      /429|quota|RESOURCE_EXHAUSTED|fetch failed/i.test(error?.message || "");
    return res.status(providerDown ? 503 : 500).json({
      message: providerDown
        ? "The AI provider is unavailable right now. Please try again."
        : "Something went wrong",
    });
  }
};

/**
 * Maps a stored message back to the original `{ id, role, content }` shape
 * that the legacy endpoints used to return.
 */
const toLegacyChat = (chat) => ({
  id: chat.legacyId || chat._id?.toString(),
  role: chat.role,
  content: chat.content,
});

/**
 * GET /api/v1/chat/all-chats?limit=&skip=
 * Pagination counts backwards from the newest message, exactly like before.
 */
export const sendALLChatstoUSer = async (req, res, next) => {
  try {
    const userId = res.locals.jwtData.id;
    const conversation = await getLegacyConversation(userId);

    const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 100);
    const skip = Math.max(parseInt(req.query.skip) || 0, 0);

    const totalChats = await Message.countDocuments({
      conversationId: conversation._id,
    });

    const end = Math.max(0, totalChats - skip);
    const start = Math.max(0, end - limit);

    const chats = await Message.find({ conversationId: conversation._id })
      .sort({ _id: 1 })
      .skip(start)
      .limit(end - start)
      .lean();

    return res.status(200).json({
      message: "OK",
      chats: chats.map(toLegacyChat),
      hasMore: start > 0,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "ERROR", cause: error.message });
  }
};

/**
 * DELETE /api/v1/chat/delete
 * Clears every message of the legacy conversation.
 */
export const deleteUserChats = async (req, res, next) => {
  try {
    const userId = res.locals.jwtData.id;
    const conversation = await getLegacyConversation(userId);

    await Message.deleteMany({ conversationId: conversation._id });
    await syncConversationMeta(conversation._id);

    return res.status(200).json({ message: "OK" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "ERROR", cause: error.message });
  }
};
