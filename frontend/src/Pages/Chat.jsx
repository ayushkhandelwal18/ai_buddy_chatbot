import { useEffect, useMemo, useState } from "react";
import { Box, useMediaQuery, useTheme } from "@mui/material";
import { useNavigate, useParams } from "react-router-dom";
import { ChatProvider, useChat } from "../context/ChatContext";
import { useAuth } from "../context/AuthContent";
import Sidebar from "../components/chat/Sidebar";
import TopBar from "../components/chat/TopBar";
import MessageList from "../components/chat/MessageList";
import EmptyState from "../components/chat/EmptyState";
import Composer from "../components/chat/Composer";
import MemoryDialog from "../components/chat/MemoryDialog";

const SIDEBAR_WIDTH = 288;

/**
 * The chat workspace: sidebar + conversation area.
 */
function ChatWorkspace() {
  const { conversationId } = useParams();
  const auth = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));

  const {
    conversations,
    messages,
    hasMoreMessages,
    loadingMessages,
    loadOlderMessages,
    isStreaming,
    isRegenerating,
    streamingText,
    sendMessage,
    stopStreaming,
    regenerate,
    removeMessage,
    attachments,
  } = useChat();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [memoryOpen, setMemoryOpen] = useState(false);

  // Redirect to the login page when the session is gone — but only after the
  // initial auth check has finished, so a valid session is not interrupted.
  useEffect(() => {
    if (!auth) return;
    if (auth.isAuthLoading) return;
    if (!auth.isLoggedIn) {
      navigate("/login", { replace: true });
    }
  }, [auth, navigate]);

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === conversationId),
    [conversations, conversationId]
  );

  const hasConversation = Boolean(conversationId);
  const title = activeConversation?.title || (hasConversation ? "Chat" : "New chat");

  const handleNewChat = () => {
    navigate("/chat");
    setMobileOpen(false);
  };

  const handleSelectConversation = (id) => {
    navigate(`/chat/${id}`);
  };

  const handleSuggestion = (prompt) => {
    sendMessage(prompt);
  };

  const busy = isStreaming || isRegenerating;

  return (
    <Box
      sx={{
        display: "flex",
        height: "100%",
        minHeight: 0,
        bgcolor: "background.default",
        overflow: "hidden",
      }}
    >
      {/* Desktop sidebar */}
      <Box
        sx={{
          display: { xs: "none", md: "block" },
          width: sidebarOpen ? SIDEBAR_WIDTH : 0,
          transition: "width 220ms ease",
          overflow: "hidden",
          flexShrink: 0,
        }}
      >
        <Box sx={{ width: SIDEBAR_WIDTH, height: "100%" }}>
          <Sidebar
            activeId={conversationId}
            onClose={() => setSidebarOpen(false)}
            onSelectConversation={handleSelectConversation}
            onNewChat={handleNewChat}
          />
        </Box>
      </Box>

      {/* Mobile sidebar */}
      <Box
        sx={{
          display: { xs: "block", md: "none" },
          position: "fixed",
          inset: 0,
          zIndex: 1200,
          pointerEvents: mobileOpen ? "auto" : "none",
        }}
      >
        <Box
          onClick={() => setMobileOpen(false)}
          sx={{
            position: "absolute",
            inset: 0,
            bgcolor: "rgba(0,0,0,0.6)",
            opacity: mobileOpen ? 1 : 0,
            transition: "opacity 220ms ease",
          }}
        />
        <Box
          sx={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            width: SIDEBAR_WIDTH,
            maxWidth: "85vw",
            transform: mobileOpen ? "translateX(0)" : "translateX(-100%)",
            transition: "transform 240ms ease",
            boxShadow: mobileOpen ? "12px 0 40px rgba(0,0,0,0.45)" : "none",
          }}
        >
          <Sidebar
            activeId={conversationId}
            onClose={() => setMobileOpen(false)}
            onSelectConversation={handleSelectConversation}
            onNewChat={handleNewChat}
          />
        </Box>
      </Box>

      {/* Conversation area */}
      <MemoryDialog open={memoryOpen} onClose={() => setMemoryOpen(false)} />
      <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", height: "100%" }}>
        <TopBar
          title={title}
          showMenuButton
          onToggleSidebar={() =>
            isDesktop ? setSidebarOpen((open) => !open) : setMobileOpen((open) => !open)
          }
          onNewChat={handleNewChat}
          onOpenMemory={() => setMemoryOpen(true)}
        />

        {hasConversation ? (
          <MessageList
            messages={messages}
            hasMore={hasMoreMessages}
            loadingMore={loadingMessages}
            onLoadMore={loadOlderMessages}
            streamingText={streamingText}
            isStreaming={isStreaming}
            onRegenerate={regenerate}
            onDelete={removeMessage}
            isBusy={busy}
          />
        ) : (
          <Box sx={{ flex: 1, overflowY: "auto", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <EmptyState onSuggestion={handleSuggestion} />
          </Box>
        )}
        <Box sx={{ flexShrink: 0, px: { xs: 1.5, sm: 2, md: 3 }, pb: { xs: 1.5, md: 2 }, pt: 1,
          borderTop: hasConversation ? "1px solid" : "none", borderColor: "divider" }}>
          <Box sx={{ maxWidth: 820, mx: "auto" }}>
            <Composer
              attachments={attachments}
              onSend={sendMessage}
              onStop={stopStreaming}
              isStreaming={isStreaming}
              disabled={isRegenerating}
              autoFocus={!hasConversation}
              placeholder={hasConversation ? "Message AI-Buddy…" : "Ask AI-Buddy anything…"}
            />
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

/**
 * Route entry point — the active conversation lives in the URL
 * (`/chat/:conversationId`) so it survives refreshes and can be linked.
 */
function Chat() {
  const { conversationId } = useParams();

  return (
    <ChatProvider conversationId={conversationId}>
      <ChatWorkspace />
    </ChatProvider>
  );
}

export default Chat;
