import { Router } from "express";
import { verifyToken } from "../utils/token-manager.js";
import {
  conversationIdValidator,
  messageIdValidator,
  messageValidator,
  titleValidator,
  paginationValidator,
  messagesPaginationValidator,
  validate,
} from "../utils/validators.js";
import {
  listUserConversations,
  createUserConversation,
  getUserConversation,
  renameUserConversation,
  deleteUserConversation,
  deleteAllUserConversations,
  getConversationMessages,
  sendConversationMessage,
  streamConversationMessage,
  regenerateConversationMessage,
  deleteConversationMessage,
} from "../controllers/conversation.controller.js";

const conversationRoutes = Router();

// Every route below requires an authenticated user.
conversationRoutes.use(verifyToken);

/* ------------------------------- conversations ---------------------------- */

conversationRoutes.get(
  "/",
  validate(paginationValidator),
  listUserConversations
);

conversationRoutes.post("/", createUserConversation);

conversationRoutes.delete("/", deleteAllUserConversations);

conversationRoutes.get(
  "/:id",
  validate(conversationIdValidator),
  getUserConversation
);

conversationRoutes.patch(
  "/:id",
  validate([...conversationIdValidator, ...titleValidator]),
  renameUserConversation
);

conversationRoutes.delete(
  "/:id",
  validate(conversationIdValidator),
  deleteUserConversation
);

/* --------------------------------- messages ------------------------------- */

conversationRoutes.get(
  "/:id/messages",
  validate([...conversationIdValidator, ...messagesPaginationValidator]),
  getConversationMessages
);

conversationRoutes.post(
  "/:id/messages",
  validate([...conversationIdValidator, ...messageValidator]),
  sendConversationMessage
);

conversationRoutes.post(
  "/:id/messages/stream",
  validate([...conversationIdValidator, ...messageValidator]),
  streamConversationMessage
);

conversationRoutes.post(
  "/:id/messages/:messageId/regenerate",
  validate([...conversationIdValidator, ...messageIdValidator]),
  regenerateConversationMessage
);

conversationRoutes.delete(
  "/:id/messages/:messageId",
  validate([...conversationIdValidator, ...messageIdValidator]),
  deleteConversationMessage
);

export default conversationRoutes;
