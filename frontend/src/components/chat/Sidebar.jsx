import { useMemo, useState } from "react";
import { Box, Button, CircularProgress, InputBase, Tooltip, Typography } from "@mui/material";
import {
  MdAdd,
  MdDeleteSweep,
  MdLogout,
  MdSearch,
  MdAutoAwesome,
} from "react-icons/md";
import ConversationItem from "./ConversationItem";
import { useChat } from "../../context/ChatContext";
import { useAuth } from "../../context/AuthContent";

const DAY = 24 * 60 * 60 * 1000;

/** Buckets conversations into Today / Yesterday / Previous 7 days / Older. */
const groupByRecency = (conversations) => {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  const groups = [
    { label: "Today", items: [] },
    { label: "Yesterday", items: [] },
    { label: "Previous 7 days", items: [] },
    { label: "Older", items: [] },
  ];

  conversations.forEach((conversation) => {
    const time = new Date(conversation.lastMessageAt || conversation.updatedAt).getTime();
    if (time >= startOfToday) groups[0].items.push(conversation);
    else if (time >= startOfToday - DAY) groups[1].items.push(conversation);
    else if (time >= startOfToday - 7 * DAY) groups[2].items.push(conversation);
    else groups[3].items.push(conversation);
  });

  return groups.filter((group) => group.items.length > 0);
};

/**
 * The collapsible conversation sidebar.
 */
function Sidebar({ onClose, activeId, onSelectConversation, onNewChat }) {
  const {
    conversations,
    loadingConversations,
    hasMoreConversations,
    loadMoreConversations,
    rename,
    remove,
    removeAll,
  } = useChat();
  const auth = useAuth();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return conversations;
    return conversations.filter(
      (conversation) =>
        conversation.title.toLowerCase().includes(needle) ||
        (conversation.lastMessage || "").toLowerCase().includes(needle)
    );
  }, [conversations, query]);

  const groups = useMemo(() => groupByRecency(filtered), [filtered]);

  const initials = (auth?.user?.name || "U")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const handleSelect = (id) => {
    onSelectConversation?.(id);
    onClose?.();
  };

  const handleNew = () => {
    onNewChat?.();
    onClose?.();
  };

  return (
    <Box
      component="aside"
      sx={{
        width: 288,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        bgcolor: "background.paper",
        borderRight: "1px solid",
        borderColor: "divider",
      }}
    >
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 1.5, py: 1.5 }}>
        <Box
          sx={{
            width: 30,
            height: 30,
            borderRadius: 1.5,
            display: "grid",
            placeItems: "center",
            bgcolor: "rgba(34,211,238,0.14)",
            color: "primary.main",
            flexShrink: 0,
          }}
        >
          <MdAutoAwesome fontSize="small" />
        </Box>
        <Typography sx={{ fontWeight: 700, fontSize: 16, letterSpacing: "-0.01em" }}>
          AI-Buddy
        </Typography>
      </Box>

      {/* New chat */}
      <Box sx={{ px: 1.5, pb: 1 }}>
        <Button
          fullWidth
          variant="contained"
          startIcon={<MdAdd />}
          onClick={handleNew}
          sx={{
            justifyContent: "flex-start",
            textTransform: "none",
            fontWeight: 600,
            py: 1.1,
            borderRadius: 2.5,
            bgcolor: "rgba(34,211,238,0.12)",
            color: "primary.main",
            border: "1px solid rgba(34,211,238,0.28)",
            "&:hover": { bgcolor: "rgba(34,211,238,0.2)" },
          }}
        >
          New chat
        </Button>
      </Box>

      {/* Search */}
      <Box sx={{ px: 1.5, pb: 1 }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            px: 1.25,
            py: 0.6,
            borderRadius: 2,
            bgcolor: "rgba(255,255,255,0.04)",
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          <MdSearch fontSize="small" sx={{ color: "text.secondary" }} />
          <InputBase
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search conversations"
            inputProps={{ "aria-label": "Search conversations" }}
            sx={{ flex: 1, fontSize: 14, color: "text.primary" }}
          />
        </Box>
      </Box>

      {/* Conversation list */}
      <Box sx={{ flex: 1, overflowY: "auto", px: 1, pb: 1 }}>
        {loadingConversations && conversations.length === 0 ? (
          <Box sx={{ display: "grid", placeItems: "center", py: 4 }}>
            <CircularProgress size={22} sx={{ color: "primary.main" }} />
          </Box>
        ) : filtered.length === 0 ? (
          <Typography
            sx={{
              px: 1,
              py: 2,
              fontSize: 13,
              color: "text.secondary",
              textAlign: "center",
            }}
          >
            {query ? "No conversations match your search." : "No conversations yet."}
          </Typography>
        ) : (
          groups.map((group) => (
            <Box key={group.label} sx={{ mb: 1.5 }}>
              <Typography
                sx={{
                  px: 1,
                  mb: 0.5,
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "text.secondary",
                }}
              >
                {group.label}
              </Typography>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
                {group.items.map((conversation) => (
                  <ConversationItem
                    key={conversation.id}
                    conversation={conversation}
                    isActive={conversation.id === activeId}
                    onSelect={handleSelect}
                    onRename={rename}
                    onDelete={remove}
                  />
                ))}
              </Box>
            </Box>
          ))
        )}

        {hasMoreConversations && (
          <Button
            fullWidth
            size="small"
            onClick={loadMoreConversations}
            sx={{ color: "text.secondary", fontSize: 13 }}
          >
            Load older conversations
          </Button>
        )}
      </Box>

      {/* Footer */}
      <Box
        sx={{
          borderTop: "1px solid",
          borderColor: "divider",
          p: 1.5,
          display: "flex",
          flexDirection: "column",
          gap: 1,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Box
            sx={{
              width: 30,
              height: 30,
              borderRadius: "50%",
              display: "grid",
              placeItems: "center",
              bgcolor: "rgba(129,140,248,0.18)",
              color: "secondary.main",
              fontSize: 12,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {initials}
          </Box>
          <Typography sx={{ flex: 1, fontSize: 13.5, fontWeight: 500 }} noWrap>
            {auth?.user?.name || "Account"}
          </Typography>

          <Tooltip title="Delete all conversations">
            <span>
              <Button
                size="small"
                onClick={removeAll}
                sx={{ minWidth: 0, p: 0.5, color: "text.secondary" }}
                aria-label="Delete all conversations"
              >
                <MdDeleteSweep fontSize="small" />
              </Button>
            </span>
          </Tooltip>

          <Tooltip title="Log out">
            <Button
              size="small"
              onClick={auth.logout}
              sx={{ minWidth: 0, p: 0.5, color: "text.secondary" }}
              aria-label="Log out"
            >
              <MdLogout fontSize="small" />
            </Button>
          </Tooltip>
        </Box>
      </Box>
    </Box>
  );
}

export default Sidebar;
