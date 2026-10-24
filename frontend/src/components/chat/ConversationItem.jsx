import { useEffect, useRef, useState } from "react";
import { Box, IconButton, InputBase, Tooltip, Typography } from "@mui/material";
import { MdCheck, MdDeleteOutline, MdEdit } from "react-icons/md";

/**
 * One entry of the conversation list. The title can be edited inline.
 */
function ConversationItem({ conversation, isActive, onSelect, onRename, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(conversation.title);
  const inputRef = useRef(null);

  useEffect(() => {
    setDraft(conversation.title);
  }, [conversation.title]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (!trimmed) {
      setDraft(conversation.title);
      return;
    }
    if (trimmed !== conversation.title) {
      onRename(conversation.id, trimmed);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
    } else if (event.key === "Escape") {
      setDraft(conversation.title);
      setEditing(false);
    }
  };

  return (
    <Box
      onClick={() => !editing && onSelect(conversation.id)}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.5,
        px: 1,
        py: 0.75,
        borderRadius: 2,
        cursor: "pointer",
        bgcolor: isActive ? "rgba(34,211,238,0.12)" : "transparent",
        color: isActive ? "text.primary" : "text.secondary",
        transition: "background-color 140ms ease, color 140ms ease",
        "&:hover": {
          bgcolor: isActive ? "rgba(34,211,238,0.16)" : "rgba(255,255,255,0.05)",
          color: "text.primary",
          "& .conversation-actions": { opacity: 1 },
        },
      }}
    >
      {editing ? (
        <InputBase
          inputRef={inputRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          onClick={(event) => event.stopPropagation()}
          fullWidth
          autoFocus
          inputProps={{
            "aria-label": "Conversation title",
            style: { fontSize: 14, padding: "2px 4px" },
          }}
          sx={{
            borderRadius: 1,
            bgcolor: "background.default",
            px: 0.5,
            "& input": { fontWeight: 500 },
          }}
        />
      ) : (
        <Typography
          sx={{
            flex: 1,
            minWidth: 0,
            fontSize: 14,
            fontWeight: isActive ? 600 : 500,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
          title={conversation.title}
        >
          {conversation.title}
        </Typography>
      )}

      {editing ? (
        <IconButton
          size="small"
          onClick={(event) => {
            event.stopPropagation();
            commit();
          }}
          aria-label="Save title"
          sx={{ color: "primary.main" }}
        >
          <MdCheck fontSize="small" />
        </IconButton>
      ) : (
        <Box
          className="conversation-actions"
          sx={{ display: "flex", opacity: isActive ? 1 : 0, transition: "opacity 140ms ease" }}
        >
          <Tooltip title="Rename">
            <IconButton
              size="small"
              onClick={(event) => {
                event.stopPropagation();
                setEditing(true);
              }}
              aria-label="Rename conversation"
              sx={{ color: "text.secondary" }}
            >
              <MdEdit fontSize="small" />
            </IconButton>
          </Tooltip>

          <Tooltip title="Delete">
            <IconButton
              size="small"
              onClick={(event) => {
                event.stopPropagation();
                onDelete(conversation.id);
              }}
              aria-label="Delete conversation"
              sx={{ color: "text.secondary" }}
            >
              <MdDeleteOutline fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      )}
    </Box>
  );
}

export default ConversationItem;
