import { useEffect, useRef, useState } from "react";
import { Box, IconButton, Menu, MenuItem, Tooltip } from "@mui/material";
import { MdAdd, MdSend, MdStop } from "react-icons/md";
import DocumentAttachments from "./DocumentAttachments";
import DocumentManager from "./DocumentManager";

const MAX_HEIGHT = 200;

/**
 * Message composer.
 * Enter sends, Shift+Enter inserts a newline. While the assistant is
 * streaming the send button turns into a "stop" button.
 */
function Composer({
  onSend,
  onStop,
  isStreaming = false,
  disabled = false,
  autoFocus = false,
  placeholder = "Message AI-Buddy…",
  attachments,
}) {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [managerOpen, setManagerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef(null);
  const textareaRef = useRef(null);

  // Auto-grow the textarea with its content.
  useEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, MAX_HEIGHT)}px`;
  }, [value]);

  useEffect(() => {
    if (autoFocus) {
      textareaRef.current?.focus();
    }
  }, [autoFocus]);

  const submit = async () => {
    const content = value.trim();
    if (!content || disabled || isStreaming || submitting || attachments.blocked) return;
    setSubmitting(true);
    setValue("");
    try {
      const sent = await onSend(content);
      if (sent === false) setValue((current) => current || content);
    } finally {
      setSubmitting(false);
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  const canSend = value.trim().length > 0 && !disabled && !isStreaming && !submitting && !attachments.blocked;

  return (
    <Box>
    <DocumentAttachments attachments={attachments} disabled={disabled || isStreaming || submitting} />
    <input ref={fileRef} hidden type="file" multiple accept=".pdf,application/pdf" onChange={(event) => {
      attachments.addFiles(Array.from(event.target.files || []));
      event.target.value = "";
    }} />
    <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
      <MenuItem onClick={() => { setMenuAnchor(null); fileRef.current?.click(); }}>Upload PDF</MenuItem>
      <MenuItem onClick={() => { setMenuAnchor(null); setManagerOpen(true); }}>Manage PDFs</MenuItem>
    </Menu>
    <DocumentManager open={managerOpen} onClose={() => setManagerOpen(false)} onChange={attachments.refresh} />
    <Box
      sx={{
        display: "flex",
        alignItems: "flex-end",
        gap: 1,
        px: 1.25,
        py: 1,
        borderRadius: 3,
        bgcolor: "background.paper",
        border: "1px solid",
        borderColor: focused ? "primary.main" : "divider",
        boxShadow: focused ? "0 0 0 1px rgba(34,211,238,0.25)" : "none",
        transition: "border-color 160ms ease, box-shadow 160ms ease",
      }}
    >
      <Tooltip title="Add attachment">
        <span><IconButton aria-label="Add attachment" aria-haspopup="menu" aria-expanded={Boolean(menuAnchor)} disabled={disabled || isStreaming || submitting} onClick={(event) => setMenuAnchor(event.currentTarget)}><MdAdd /></IconButton></span>
      </Tooltip>
      <Box
        component="textarea"
        ref={textareaRef}
        rows={1}
        value={value}
        disabled={disabled}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        aria-label="Message AI-Buddy"
        sx={{
          flex: 1,
          border: "none",
          outline: "none",
          resize: "none",
          background: "transparent",
          color: "text.primary",
          font: "inherit",
          fontSize: 15,
          lineHeight: 1.6,
          py: 0.75,
          maxHeight: MAX_HEIGHT,
          overflowY: "auto",
          "&::placeholder": { color: "text.secondary" },
        }}
      />

      {isStreaming ? (
        <Tooltip title="Stop generating">
          <IconButton
            onClick={onStop}
            aria-label="Stop generating"
            sx={{
              color: "#041016",
              bgcolor: "primary.main",
              "&:hover": { bgcolor: "primary.light" },
            }}
          >
            <MdStop />
          </IconButton>
        </Tooltip>
      ) : (
        <Tooltip title="Send message">
          <span>
            <IconButton
              onClick={submit}
              disabled={!canSend}
              aria-label="Send message"
              sx={{
                color: canSend ? "#041016" : "text.secondary",
                bgcolor: canSend ? "primary.main" : "transparent",
                "&:hover": {
                  bgcolor: canSend ? "primary.light" : "rgba(255,255,255,0.06)",
                },
                "&.Mui-disabled": { color: "text.secondary", bgcolor: "transparent" },
              }}
            >
              <MdSend />
            </IconButton>
          </span>
        </Tooltip>
      )}
    </Box>
    </Box>
  );
}

export default Composer;
