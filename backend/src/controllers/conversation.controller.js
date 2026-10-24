import {
  listConversations,
  listMessages,
  createConversation,
  getConversationForUser,
  renameConversation,
  deleteConversation,
  deleteAllConversations,
  appendMessage,
  getMessageForUser,
  markMessageStatus,
  deleteMessagesAfter,
  deleteMessage,
  getRecentMessages,
  syncConversationMeta,
  ensureConversationTitle,
  serializeConversation,
  serializeMessage,
  resolveConversationAttachments,
} from "../services/conversation.service.js";
import {
  generateReply,
  streamReply,
  HISTORY_LIMIT,
} from "../services/gemini.service.js";
import { ApiError } from "../utils/api-error.js";
import { answerRagQuestion, ragErrorMessage } from "../services/rag.service.js";
import { prepareMemoryTurn, memoryTurnStatus } from "../services/memory.service.js";

/** Reads the authenticated user id from the locals set by verifyToken. */
const userIdOf = (res) => res.locals.jwtData?.id;

/**
 * Generates a title for a conversation that only has its first user message.
 * Returns the (possibly unchanged) title.
 */
const maybeGenerateTitle = (conversation, firstMessage) =>
  ensureConversationTitle(conversation, firstMessage);

// ---------------------------------------------------------------------------
// Conversation CRUD
// ---------------------------------------------------------------------------

export const listUserConversations = async (req, res) => {
  const userId = userIdOf(res);
  const limit = Number(req.query.limit) || 30;
  const skip = Number(req.query.skip) || 0;

  const result = await listConversations(userId, { limit, skip });
  return res.status(200).json({
    message: "OK",
    conversations: result.conversations,
    total: result.total,
    hasMore: result.hasMore,
  });
};

export const createUserConversation = async (req, res) => {
  const userId = userIdOf(res);
  const conversation = await createConversation(userId, { title: req.body?.title });
  return res.status(201).json({
    message: "Conversation created",
    conversation: serializeConversation(conversation),
  });
};

export const getUserConversation = async (req, res) => {
  const userId = userIdOf(res);
  const conversation = await getConversationForUser(userId, req.params.id);
  return res.status(200).json({
    message: "OK",
    conversation: serializeConversation(conversation),
  });
};

export const renameUserConversation = async (req, res) => {
  const userId = userIdOf(res);
  const conversation = await renameConversation(userId, req.params.id, req.body.title);
  return res.status(200).json({
    message: "Conversation renamed",
    conversation: serializeConversation(conversation),
  });
};

export const deleteUserConversation = async (req, res) => {
  const userId = userIdOf(res);
  await deleteConversation(userId, req.params.id);
  return res.status(200).json({ message: "Conversation deleted" });
};

export const deleteAllUserConversations = async (req, res) => {
  const userId = userIdOf(res);
  const deleted = await deleteAllConversations(userId);
  return res.status(200).json({ message: "OK", deleted });
};

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export const getConversationMessages = async (req, res) => {
  const userId = userIdOf(res);
  const conversation = await getConversationForUser(userId, req.params.id);

  const limit = Number(req.query.limit) || 20;
  const skip = Number(req.query.skip) || 0;
  const before = req.query.before || undefined;

  const { messages, hasMore } = await listMessages(conversation._id, {
    limit,
    skip,
    before,
  });

  return res.status(200).json({
    message: "OK",
    conversation: serializeConversation(conversation),
    messages,
    hasMore,
  });
};

export const sendConversationMessage = async (req, res) => {
  const userId = userIdOf(res);
  const conversation = await getConversationForUser(userId, req.params.id);
  const text = req.body.message;

  const { rag, documentIds } = await resolveConversationAttachments(userId, conversation, req.body);

  // History is read before the new message is stored so the model never sees
  // the current turn twice.
  const history = await getRecentMessages(conversation._id, HISTORY_LIMIT);
  const userMessage = await appendMessage({
    conversationId: conversation._id,
    userId,
    role: "user",
    content: text,
    rag, documentIds,
  });

  // Title the conversation as soon as the first message exists, so the
  // sidebar shows a meaningful entry right away (the local title mode does
  // not need the model at all).
  const title = await maybeGenerateTitle(conversation, text);
  const titledConversation = await syncConversationMeta(conversation._id, { title });
  const memoryContext = await prepareMemoryTurn({ userId, conversationId: conversation._id, userMessage, text });

  let reply;
  let sources = [];
  try {
    if (rag) {
      const answer = await answerRagQuestion({ userId, question: text, documentIds, history, memoryContext });
      reply = answer.content;
      sources = answer.sources;
    } else reply = await generateReply({ history, message: text, memoryContext });
  } catch (error) {
    if (!rag) console.error("[gemini] generateReply failed:", error);
    // The user's message stays in the transcript but is flagged as failed, so
    // it is never sent back to the model as context and the thread never ends
    // up in a corrupted state.
    await markMessageStatus(userMessage._id, "failed");
    await syncConversationMeta(conversation._id);
    return res.status(rag && error instanceof ApiError ? error.status : 503).json({
      message: rag ? ragErrorMessage(error) : "The AI provider is unavailable right now. Please try again.",
      conversation: serializeConversation(titledConversation),
    });
  }

  const assistantMessage = await appendMessage({
    conversationId: conversation._id,
    userId,
    role: "assistant",
    content: reply,
    rag, sources,
  });

  const updated = await syncConversationMeta(conversation._id, { title });

  return res.status(201).json({
    message: "OK",
    userMessage: serializeMessage(userMessage),
    assistantMessage: serializeMessage(assistantMessage),
    conversation: serializeConversation(updated),
    memory: memoryTurnStatus(memoryContext),
  });
};

/**
 * Streaming (Server-Sent Events) variant of `sendConversationMessage`.
 *
 * Events sent to the client (one JSON payload per `data:` line):
 *   { type: "meta",   userMessage, conversation }
 *   { type: "delta",  text }
 *   { type: "done",   assistantMessage, conversation }
 *   { type: "error",  message }
 * The stream always terminates with `data: [DONE]`.
 */
export const streamConversationMessage = async (req, res) => {
  const userId = userIdOf(res);
  const conversation = await getConversationForUser(userId, req.params.id);
  const text = req.body.message;
  const { rag, documentIds } = await resolveConversationAttachments(userId, conversation, req.body);

  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  if (typeof res.flushHeaders === "function") {
    res.flushHeaders();
  }

  const write = (payload) => {
    if (res.writableEnded) return false;
    try {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
      return true;
    } catch {
      return false;
    }
  };

  const abortController = new AbortController();
  let clientGone = false;
  const onClose = () => {
    clientGone = true;
    abortController.abort();
  };
  res.on("close", onClose);

  try {
    const history = await getRecentMessages(conversation._id, HISTORY_LIMIT);
    const userMessage = await appendMessage({
      conversationId: conversation._id,
      userId,
      role: "user",
      content: text,
      rag, documentIds,
    });

    // Title the conversation in the background so the sidebar shows a
    // meaningful entry as soon as the first message exists. The local title
    // mode resolves immediately; the AI mode runs in parallel with the
    // stream instead of delaying the first token.
    const titlePromise = maybeGenerateTitle(conversation, text).catch(() => null);

    write({
      type: "meta",
      userMessage: serializeMessage(userMessage),
      conversation: serializeConversation(conversation),
    });

    const memoryContext = await prepareMemoryTurn({ userId, conversationId: conversation._id, userMessage, text });
    write({ type: "memory", memory: memoryTurnStatus(memoryContext) });

    let fullText = "";
    let sources = [];
    try {
      if (rag) {
        const answer = await answerRagQuestion({ userId, question: text, documentIds, history, memoryContext, signal: abortController.signal });
        if (!clientGone) {
          fullText = answer.content;
          sources = answer.sources;
          // RAG output is buffered until citations are validated.
          write({ type: "delta", text: fullText });
        }
      } else {
        for await (const chunk of streamReply({
          history,
          message: text,
          signal: abortController.signal,
          memoryContext,
        })) {
          if (clientGone) break;
          fullText += chunk;
          write({ type: "delta", text: chunk });
        }
      }
    } catch (error) {
      const aborted =
        clientGone ||
        abortController.signal.aborted ||
        error?.name === "GoogleGenerativeAIAbortError";

      if (!aborted) {
        if (!rag) console.error("[gemini] stream failed:", error);
        write({ type: "error", message: rag ? ragErrorMessage(error) : "The AI provider is unavailable right now." });
      }

      // Keep whatever was generated so far — a partial answer is still valid
      // context for the next turn.
      if (fullText.trim()) {
        const partial = await appendMessage({
          conversationId: conversation._id,
          userId,
          role: "assistant",
          content: fullText,
          rag, sources,
          status: aborted ? "stopped" : "error",
        });
        await syncConversationMeta(conversation._id);
        write({
          type: aborted ? "stopped" : "error",
          assistantMessage: serializeMessage(partial),
        });
      } else {
        // Nothing came back at all — flag the turn so it is not replayed as
        // context on the next request.
        if (!aborted) {
          await markMessageStatus(userMessage._id, "failed");
        }
        await syncConversationMeta(conversation._id);
      }

      write("[DONE]");
      return res.end();
    }

    // Client disconnected (stop generation) — persist the partial answer.
    if (clientGone) {
      if (fullText.trim()) {
        await appendMessage({
          conversationId: conversation._id,
          userId,
          role: "assistant",
          content: fullText,
          rag, sources,
          status: "stopped",
        });
      }
      const title = await titlePromise;
      await syncConversationMeta(conversation._id, { title });
      return;
    }

    const assistantMessage = await appendMessage({
      conversationId: conversation._id,
      userId,
      role: "assistant",
      content: fullText || "Sorry, no reply.",
      rag, sources,
    });

    const title = await titlePromise;
    const updated = await syncConversationMeta(conversation._id, { title });

    write({
      type: "done",
      assistantMessage: serializeMessage(assistantMessage),
      conversation: serializeConversation(updated),
    });
    write("[DONE]");
    return res.end();
  } catch (error) {
    if (!rag) console.error("[chat] stream error:", error);
    write({ type: "error", message: "Something went wrong while streaming." });
    write("[DONE]");
    return res.end();
  } finally {
    res.off("close", onClose);
  }
};

/**
 * Regenerates the assistant answer for a given user message.
 * Everything after that message is removed and a fresh answer is produced.
 */
export const regenerateConversationMessage = async (req, res) => {
  const userId = userIdOf(res);
  const conversation = await getConversationForUser(userId, req.params.id);
  const target = await getMessageForUser(
    conversation._id,
    userId,
    req.params.messageId
  );

  if (target.role !== "user") {
    throw ApiError.badRequest("Only a user message can be regenerated");
  }

  if (target.rag && !target.documentIds?.length) throw ApiError.badRequest("The original document selection is unavailable. Send a new document question.");
  const { rag, documentIds } = await resolveConversationAttachments(userId, conversation, {
    documentIds: target.rag ? target.documentIds.map(String) : [],
  });

  await deleteMessagesAfter(conversation._id, target._id);

  const history = await getRecentMessages(conversation._id, HISTORY_LIMIT, target._id);
  // Regeneration reads memory but never re-saves a previously deleted fact.
  const memoryContext = await prepareMemoryTurn({ userId, text: target.content, extract: false });

  let reply;
  let sources = [];
  try {
    if (rag) {
      const answer = await answerRagQuestion({ userId, question: target.content, documentIds, history, memoryContext });
      reply = answer.content;
      sources = answer.sources;
    } else reply = await generateReply({ history, message: target.content, memoryContext });
  } catch (error) {
    if (!rag) console.error("[gemini] regenerate failed:", error);
    await syncConversationMeta(conversation._id);
    return res
      .status(rag && error instanceof ApiError ? error.status : 503)
      .json({ message: rag ? ragErrorMessage(error) : "The AI provider is unavailable right now. Please try again." });
  }

  const assistantMessage = await appendMessage({
    conversationId: conversation._id,
    userId,
    role: "assistant",
    content: reply,
    rag, sources,
  });

  const title = await maybeGenerateTitle(conversation, target.content);
  const updated = await syncConversationMeta(conversation._id, { title });

  return res.status(201).json({
    message: "OK",
    assistantMessage: serializeMessage(assistantMessage),
    conversation: serializeConversation(updated),
    memory: memoryTurnStatus(memoryContext),
  });
};

export const deleteConversationMessage = async (req, res) => {
  const userId = userIdOf(res);
  const conversation = await getConversationForUser(userId, req.params.id);
  const deleted = await deleteMessage(conversation._id, userId, req.params.messageId);

  if (!deleted) {
    throw ApiError.notFound("Message not found");
  }

  const updated = await syncConversationMeta(conversation._id);
  return res.status(200).json({
    message: "Message deleted",
    conversation: serializeConversation(updated),
  });
};
