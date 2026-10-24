import { useEffect, useRef } from "react";
import { Box, Button, CircularProgress, Typography } from "@mui/material";
import MessageBubble from "./MessageBubble";
import TypingIndicator from "./TypingIndicator";
import MarkdownContent from "./MarkdownContent";

/**
 * Scrollable list of messages with an optional "load older messages" action
 * and the live streaming bubble.
 */
function MessageList({
  messages,
  hasMore,
  onLoadMore,
  loadingMore,
  streamingText,
  isStreaming,
  onRegenerate,
  onDelete,
  isBusy,
}) {
  const scrollRef = useRef(null);
  const bottomRef = useRef(null);
  const stickToBottomRef = useRef(true);

  // Follow the conversation while the user is at the bottom of the list.
  useEffect(() => {
    if (!stickToBottomRef.current) return;
    const element = scrollRef.current;
    if (!element) return;
    element.scrollTop = element.scrollHeight;
  }, [messages, streamingText]);

  const handleScroll = () => {
    const element = scrollRef.current;
    if (!element) return;
    const distance = element.scrollHeight - element.scrollTop - element.clientHeight;
    stickToBottomRef.current = distance < 120;
  };

  /** Regenerating always restarts from the user message that came before. */
  const handleRegenerate = (assistantMessageId) => {
    const index = messages.findIndex((message) => message.id === assistantMessageId);
    for (let i = index - 1; i >= 0; i -= 1) {
      if (messages[i].role === "user") {
        onRegenerate?.(messages[i].id);
        return;
      }
    }
  };

  const lastMessageId = messages[messages.length - 1]?.id;

  return (
    <Box
      ref={scrollRef}
      onScroll={handleScroll}
      sx={{
        flex: 1,
        overflowY: "auto",
        overflowX: "hidden",
        px: { xs: 1.5, sm: 2, md: 3 },
        py: { xs: 2, md: 3 },
      }}
    >
      <Box sx={{ maxWidth: 820, mx: "auto" }}>
        {hasMore && (
          <Box sx={{ display: "grid", placeItems: "center", mb: 2 }}>
            <Button
              size="small"
              onClick={onLoadMore}
              disabled={loadingMore}
              sx={{
                color: "text.secondary",
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 2,
                fontSize: 13,
                "&:hover": { borderColor: "primary.main", color: "primary.main" },
              }}
            >
              {loadingMore ? <CircularProgress size={16} /> : "Load older messages"}
            </Button>
          </Box>
        )}

        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            onRegenerate={handleRegenerate}
            onDelete={onDelete}
            canRegenerate={message.id === lastMessageId}
            isBusy={isBusy}
          />
        ))}

        {isStreaming && (
          <Box sx={{ display: "flex", gap: 1.5, px: { xs: 0, md: 2 } }}>
            <Box
              sx={{
                width: 32,
                height: 32,
                flexShrink: 0,
                borderRadius: "50%",
                bgcolor: "rgba(34,211,238,0.15)",
                border: "1px solid rgba(34,211,238,0.3)",
                mt: 0.25,
              }}
            />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <TypingIndicator />
              {streamingText && (
                <Box
                  sx={{
                    fontSize: 15,
                    lineHeight: 1.7,
                    color: "text.primary",
                    overflowWrap: "anywhere",
                  }}
                >
                  <MarkdownContent content={streamingText} />
                </Box>
              )}
            </Box>
          </Box>
        )}

        {!messages.length && !isStreaming && (
          <Typography sx={{ textAlign: "center", color: "text.secondary", py: 6 }}>
            This conversation has no messages yet.
          </Typography>
        )}

        <div ref={bottomRef} />
      </Box>
    </Box>
  );
}

export default MessageList;
