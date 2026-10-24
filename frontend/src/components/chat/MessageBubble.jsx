import { useState } from "react";
import { Avatar, Box, IconButton, Tooltip, Typography } from "@mui/material";
import { MdCheck, MdContentCopy, MdDeleteOutline, MdRefresh } from "react-icons/md";
import MarkdownContent from "./MarkdownContent";

/**
 * A single message.
 *
 * User messages are rendered as a right aligned bubble, assistant messages as
 * a full width entry with an avatar, Markdown content and action buttons
 * (copy answer / regenerate / delete).
 */
function MessageBubble({
  message,
  onRegenerate,
  onDelete,
  canRegenerate = false,
  isBusy = false,
}) {
  const [copied, setCopied] = useState(false);

  const isUser = message.role === "user";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  };

  if (isUser) {
    return (
      <Box sx={{ display: "flex", justifyContent: "flex-end", px: { xs: 0, md: 2 }, mb: 2.5 }}>
        <Box
          sx={{
            maxWidth: { xs: "88%", md: "72%" },
            bgcolor: "rgba(34,211,238,0.12)",
            border: "1px solid rgba(34,211,238,0.25)",
            borderRadius: "18px 18px 4px 18px",
            px: 2,
            py: 1.25,
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
            fontSize: 15,
            lineHeight: 1.65,
          }}
        >
          {message.content}
          {message.status === "failed" && (
            <Typography
              sx={{
                display: "block",
                mt: 0.75,
                fontSize: 12,
                color: "error.main",
                whiteSpace: "normal",
              }}
            >
              {message.rag ? "Document answering failed. Check the error and try again." : "No answer — the AI provider was unavailable."}
            </Typography>
          )}
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", gap: 1.5, px: { xs: 0, md: 2 }, mb: 3 }}>
      <Avatar
        src="/logo.png"
        alt="AI-Buddy"
        sx={{
          width: 32,
          height: 32,
          flexShrink: 0,
          mt: 0.25,
          bgcolor: "rgba(34,211,238,0.15)",
          border: "1px solid rgba(34,211,238,0.3)",
        }}
      />

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          sx={{
            fontSize: 12.5,
            fontWeight: 600,
            color: "text.secondary",
            mb: 0.5,
            letterSpacing: "0.02em",
          }}
        >
          AI-Buddy
          {message.status === "stopped" && (
            <Box
              component="span"
              sx={{ ml: 1, fontWeight: 500, color: "warning.main", fontSize: 11.5 }}
            >
              stopped
            </Box>
          )}
          {message.status === "error" && (
            <Box
              component="span"
              sx={{ ml: 1, fontWeight: 500, color: "error.main", fontSize: 11.5 }}
            >
              incomplete
            </Box>
          )}
        </Typography>

        <Box
          sx={{
            fontSize: 15,
            lineHeight: 1.7,
            color: "text.primary",
            overflowWrap: "anywhere",
          }}
        >
          <MarkdownContent content={message.content} />
        </Box>

        {!!message.sources?.length && <Box sx={{ mt: 1 }}>
          <Typography variant="caption" color="text.secondary">Sources</Typography>
          {message.sources.map((source) => <Typography key={source.sourceId} variant="caption" sx={{ display: "block", overflowWrap: "anywhere" }}>
            [{source.sourceId}] {source.sourceType === "memory"
              ? `Saved memory · ${source.category} · ${source.key.includes(".") ? source.key.split(".")[0] : source.key.replaceAll("_", " ")}`
              : <>{source.originalFilename}, {source.pageStart === source.pageEnd
                ? `page ${source.pageStart}` : `pages ${source.pageStart}–${source.pageEnd}`} · chunk {source.chunkIndex + 1}</>}
          </Typography>)}
        </Box>}

        <Box sx={{ display: "flex", alignItems: "center", gap: 0.25, mt: 0.5 }}>
          <Tooltip title={copied ? "Copied" : "Copy answer"}>
            <IconButton
              size="small"
              onClick={handleCopy}
              aria-label="Copy answer"
              sx={{ color: "text.secondary" }}
            >
              {copied ? <MdCheck fontSize="small" /> : <MdContentCopy fontSize="small" />}
            </IconButton>
          </Tooltip>

          {canRegenerate && (
            <Tooltip title="Regenerate response">
              <IconButton
                size="small"
                onClick={() => onRegenerate?.(message.id)}
                disabled={isBusy}
                aria-label="Regenerate response"
                sx={{ color: "text.secondary" }}
              >
                <MdRefresh fontSize="small" />
              </IconButton>
            </Tooltip>
          )}

          <Tooltip title="Delete message">
            <IconButton
              size="small"
              onClick={() => onDelete?.(message.id)}
              aria-label="Delete message"
              sx={{ color: "text.secondary" }}
            >
              <MdDeleteOutline fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
    </Box>
  );
}

export default MessageBubble;
