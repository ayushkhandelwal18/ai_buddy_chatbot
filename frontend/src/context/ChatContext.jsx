import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "./AuthContent";
import usePdfAttachments from "./usePdfAttachments";
import {
  listConversations,
  createConversation,
  renameConversation,
  deleteConversation,
  deleteAllConversations,
  getConversationMessages,
  regenerateConversationMessage,
  deleteConversationMessage,
  streamConversationMessage,
} from "../helpers/api";

const ChatContext = createContext(null);

const CONVERSATION_PAGE_SIZE = 30;
const MESSAGE_PAGE_SIZE = 20;

const tempId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * Holds the chat state: the conversation list, the messages of the active
 * conversation, and every action the UI needs (send, stop, regenerate,
 * rename, delete).
 *
 * The active conversation is driven by the URL (`/chat/:conversationId`), so a
 * conversation survives a page refresh and can be shared as a link.
 */
export const ChatProvider = ({ conversationId, children }) => {
  const auth = useAuth();
  const navigate = useNavigate();

  const [conversations, setConversations] = useState([]);
  const [hasMoreConversations, setHasMoreConversations] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(true);

  const [messages, setMessages] = useState([]);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const [isStreaming, setIsStreaming] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [streamingText, setStreamingText] = useState("");

  const abortRef = useRef(null);
  // Id of the conversation whose messages are currently being streamed, so the
  // "load messages" effect does not overwrite live content.
  const streamingIdRef = useRef(null);

  const isLoggedIn = Boolean(auth?.isLoggedIn);
  const attachments = usePdfAttachments(conversationId, isLoggedIn);
  const { acceptConversation, moveDraft } = attachments;

  /* ----------------------------- conversations ---------------------------- */

  const fetchConversations = useCallback(
    async ({ skip = 0, append = false } = {}) => {
      if (!isLoggedIn) return;

      if (!append) setLoadingConversations(true);
      try {
        const data = await listConversations(CONVERSATION_PAGE_SIZE, skip);
        setConversations((prev) =>
          append ? [...prev, ...data.conversations] : data.conversations
        );
        setHasMoreConversations(Boolean(data.hasMore));
      } catch (error) {
        if (!append) setConversations([]);
        toast.error(error.message || "Unable to load conversations");
      } finally {
        if (!append) setLoadingConversations(false);
      }
    },
    [isLoggedIn]
  );

  useEffect(() => {
    if (isLoggedIn) {
      fetchConversations();
    } else {
      setConversations([]);
    }
  }, [isLoggedIn, fetchConversations]);

  /* ------------------------------- messages ------------------------------ */

  const fetchMessages = useCallback(
    async (id, { append = false, before } = {}) => {
      if (!id) {
        setMessages([]);
        setHasMoreMessages(false);
        return;
      }

      setLoadingMessages(true);
      try {
        const data = await getConversationMessages(id, {
          limit: MESSAGE_PAGE_SIZE,
          skip: append ? messages.length : 0,
          before,
        });

        setMessages((prev) =>
          append ? [...data.messages, ...prev] : data.messages
        );
        setHasMoreMessages(Boolean(data.hasMore));
      } catch (error) {
        if (!append) setMessages([]);
        toast.error(error.message || "Unable to load messages");
      } finally {
        setLoadingMessages(false);
      }
    },
    // `messages.length` is intentionally read at call time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useEffect(() => {
    if (!isLoggedIn) return;
    if (streamingIdRef.current === conversationId) return;

    setMessages([]);
    setHasMoreMessages(false);
    fetchMessages(conversationId);
  }, [conversationId, isLoggedIn, fetchMessages]);

  const loadOlderMessages = useCallback(async () => {
    if (!conversationId || loadingMessages || !hasMoreMessages) return;

    const oldest = messages[0];
    if (!oldest) return;

    setLoadingMessages(true);
    try {
      const data = await getConversationMessages(conversationId, {
        limit: MESSAGE_PAGE_SIZE,
        before: oldest.id,
      });
      setMessages((prev) => [...data.messages, ...prev]);
      setHasMoreMessages(Boolean(data.hasMore));
    } catch (error) {
      toast.error(error.message || "Unable to load older messages");
    } finally {
      setLoadingMessages(false);
    }
  }, [conversationId, loadingMessages, hasMoreMessages, messages]);

  /* -------------------------------- actions ------------------------------- */

  const updateConversationInList = useCallback((id, patch) => {
    setConversations((prev) =>
      prev.map((conversation) =>
        conversation.id === id ? { ...conversation, ...patch } : conversation
      )
    );
  }, []);

  const runStream = useCallback(
    async (targetId, content, { documentIds = [] } = {}) => {
      const controller = new AbortController();
      abortRef.current = controller;
      streamingIdRef.current = targetId;

      const localUserId = tempId("user");
      let assistantText = "";
      let finished = false;

      setMessages((prev) => [
        ...prev,
        {
          id: localUserId,
          conversationId: targetId,
          role: "user",
          content,
          status: "complete",
          createdAt: new Date().toISOString(),
        },
      ]);
      setStreamingText("");
      setIsStreaming(true);

      try {
        await streamConversationMessage(targetId, content, {
          documentIds,
          signal: controller.signal,
          onEvent: (event) => {
            if (event.type === "meta") {
              if (event.conversation) acceptConversation(event.conversation);
              setMessages((prev) =>
                prev.map((message) =>
                  message.id === localUserId
                    ? { ...message, ...event.userMessage, id: event.userMessage.id }
                    : message
                )
              );
              if (event.conversation) {
                updateConversationInList(targetId, event.conversation);
              }
            } else if (event.type === "memory" && event.memory?.warning) {
              toast.error(event.memory.warning);
            } else if (event.type === "delta") {
              assistantText += event.text || "";
              setStreamingText(assistantText);
            } else if (event.type === "done" && event.assistantMessage) {
              finished = true;
              setMessages((prev) => [...prev, { ...event.assistantMessage }]);
              setStreamingText("");
              if (event.conversation) {
                updateConversationInList(targetId, event.conversation);
              }
            } else if (event.type === "stopped" && event.assistantMessage) {
              finished = true;
              setMessages((prev) => [...prev, { ...event.assistantMessage }]);
              setStreamingText("");
            } else if (event.type === "error") {
              if (event.assistantMessage) {
                finished = true;
                setMessages((prev) => [...prev, { ...event.assistantMessage }]);
                setStreamingText("");
              } else {
                toast.error(event.message || "Something went wrong");
              }
            }
          },
        });
      } catch (error) {
        if (error.name === "AbortError") {
          // The user pressed "stop" — keep the partial answer on screen.
          if (assistantText.trim()) {
            setMessages((prev) => [
              ...prev,
              {
                id: tempId("assistant"),
                conversationId: targetId,
                role: "assistant",
                content: assistantText,
                status: "stopped",
                createdAt: new Date().toISOString(),
              },
            ]);
          }
          setStreamingText("");
          toast.success("Generation stopped");
        } else {
          toast.error(error.message || "AI-Buddy is unable to give an answer.");
        }
      } finally {
        setIsStreaming(false);
        streamingIdRef.current = null;
        abortRef.current = null;
        // Keep the sidebar (titles, previews) in sync with the server.
        fetchConversations({ skip: 0 });
        if (!finished) {
          // The server persisted the turn — resync so ids/timestamps match.
          setTimeout(() => {
            if (streamingIdRef.current === null) {
              fetchMessages(targetId);
            }
          }, 500);
        }
      }
      return finished;
    },
    [fetchConversations, fetchMessages, updateConversationInList, acceptConversation]
  );

  const sendMessage = useCallback(
    async (text) => {
      const content = (text || "").trim();
      if (!content || isStreaming) return false;
      if (attachments.blocked) { toast.error(attachments.message); return false; }
      const documentIds = attachments.documentIds;

      let targetId = conversationId;

      if (!targetId) {
        try {
          const data = await createConversation();
          targetId = data.conversation.id;
          moveDraft(targetId);
          setConversations((prev) => [data.conversation, ...prev]);
          navigate(`/chat/${targetId}`);
        } catch (error) {
          toast.error(error.message || "Unable to start a new conversation");
          return false;
        }
      }

      return await runStream(targetId, content, { documentIds });
    },
    [conversationId, isStreaming, navigate, runStream, attachments, moveDraft]
  );

  const stopStreaming = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
  }, []);

  const regenerate = useCallback(
    async (messageId) => {
      if (!conversationId || isStreaming || isRegenerating) return;

      const index = messages.findIndex((message) => message.id === messageId);
      if (index === -1) return;

      // Drop the previous answer (and anything after it) before regenerating.
      setMessages((prev) => prev.slice(0, index + 1));
      setIsRegenerating(true);

      try {
        const data = await regenerateConversationMessage(conversationId, messageId);
        if (data.memory?.warning) toast.error(data.memory.warning);
        setMessages((prev) => [...prev, { ...data.assistantMessage }]);
        if (data.conversation) {
          updateConversationInList(conversationId, data.conversation);
        }
        fetchConversations({ skip: 0 });
      } catch (error) {
        toast.error(error.message || "Unable to regenerate the answer");
        fetchMessages(conversationId);
      } finally {
        setIsRegenerating(false);
      }
    },
    [
      conversationId,
      isStreaming,
      isRegenerating,
      messages,
      fetchConversations,
      fetchMessages,
      updateConversationInList,
    ]
  );

  const removeMessage = useCallback(
    async (messageId) => {
      if (!conversationId) return;
      try {
        await deleteConversationMessage(conversationId, messageId);
        setMessages((prev) => prev.filter((message) => message.id !== messageId));
      } catch (error) {
        toast.error(error.message || "Unable to delete the message");
      }
    },
    [conversationId]
  );

  const rename = useCallback(
    async (id, title) => {
      const trimmed = (title || "").trim();
      if (!trimmed) return;
      try {
        const data = await renameConversation(id, trimmed);
        updateConversationInList(id, data.conversation);
      } catch (error) {
        toast.error(error.message || "Unable to rename the conversation");
      }
    },
    [updateConversationInList]
  );

  const remove = useCallback(
    async (id) => {
      try {
        await deleteConversation(id);
        setConversations((prev) => prev.filter((conversation) => conversation.id !== id));
        if (id === conversationId) {
          navigate("/chat");
        }
        toast.success("Conversation deleted");
      } catch (error) {
        toast.error(error.message || "Unable to delete the conversation");
      }
    },
    [conversationId, navigate]
  );

  const removeAll = useCallback(async () => {
    try {
      await deleteAllConversations();
      setConversations([]);
      setMessages([]);
      navigate("/chat");
      toast.success("All conversations deleted");
    } catch (error) {
      toast.error(error.message || "Unable to delete the conversations");
    }
  }, [navigate]);

  const loadMoreConversations = useCallback(() => {
    if (!hasMoreConversations || loadingConversations) return;
    fetchConversations({ skip: conversations.length, append: true });
  }, [hasMoreConversations, loadingConversations, conversations.length, fetchConversations]);

  const value = useMemo(
    () => ({
      conversations,
      hasMoreConversations,
      loadingConversations,
      loadMoreConversations,
      messages,
      hasMoreMessages,
      loadingMessages,
      loadOlderMessages,
      isStreaming,
      isRegenerating,
      streamingText,
      attachments,
      sendMessage,
      stopStreaming,
      regenerate,
      removeMessage,
      rename,
      remove,
      removeAll,
      refreshConversations: () => fetchConversations({ skip: 0 }),
    }),
    [
      conversations,
      hasMoreConversations,
      loadingConversations,
      loadMoreConversations,
      messages,
      hasMoreMessages,
      loadingMessages,
      loadOlderMessages,
      isStreaming,
      isRegenerating,
      streamingText,
      attachments,
      sendMessage,
      stopStreaming,
      regenerate,
      removeMessage,
      rename,
      remove,
      removeAll,
      fetchConversations,
    ]
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChat must be used inside a ChatProvider");
  }
  return context;
};
