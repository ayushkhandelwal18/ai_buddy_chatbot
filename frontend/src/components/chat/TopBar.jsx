import { Box, IconButton, Tooltip, Typography } from "@mui/material";
import { MdAdd, MdMenu, MdMemory } from "react-icons/md";

/**
 * Top bar of the chat workspace — collapses the sidebar on desktop and opens
 * it as a drawer on small screens.
 */
function TopBar({ title, onToggleSidebar, onNewChat, onOpenMemory, showMenuButton = true }) {
  return (
    <Box
      component="header"
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        px: { xs: 1, md: 2 },
        py: 1.25,
        borderBottom: "1px solid",
        borderColor: "divider",
        bgcolor: "rgba(10,15,25,0.85)",
        backdropFilter: "blur(10px)",
        position: "sticky",
        top: 0,
        zIndex: 5,
        flexShrink: 0,
      }}
    >
      {showMenuButton && (
        <Tooltip title="Toggle sidebar">
          <IconButton onClick={onToggleSidebar} aria-label="Toggle sidebar" sx={{ color: "text.secondary" }}>
            <MdMenu />
          </IconButton>
        </Tooltip>
      )}

      <Typography
        sx={{
          flex: 1,
          minWidth: 0,
          fontSize: 15,
          fontWeight: 600,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
        title={title}
      >
        {title}
      </Typography>

      <Tooltip title="Manage memory">
        <IconButton onClick={onOpenMemory} aria-label="Manage memory" sx={{ color: "text.secondary" }}>
          <MdMemory />
        </IconButton>
      </Tooltip>

      <Tooltip title="New chat">
        <IconButton onClick={onNewChat} aria-label="New chat" sx={{ color: "text.secondary" }}>
          <MdAdd />
        </IconButton>
      </Tooltip>
    </Box>
  );
}

export default TopBar;
