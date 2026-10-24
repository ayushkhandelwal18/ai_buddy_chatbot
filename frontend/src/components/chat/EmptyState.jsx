import { Box, Typography } from "@mui/material";
import { MdAutoAwesome } from "react-icons/md";

const SUGGESTIONS = [
  {
    title: "Explain a concept",
    prompt: "Explain how a REST API works, simply.",
  },
  {
    title: "Write some code",
    prompt: "Write a React hook that debounces a value in TypeScript.",
  },
  {
    title: "Plan something",
    prompt: "Give me a 4-week plan to learn the MERN stack.",
  },
  {
    title: "Help me write",
    prompt: "Draft a short, friendly email asking for a deadline extension.",
  },
];

/**
 * Welcome screen shown when no conversation is selected.
 */
function EmptyState({ onSuggestion }) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        px: 2,
        py: { xs: 3, md: 6 },
        width: "100%",
        maxWidth: 760,
        mx: "auto",
        animation: "fadeUp 420ms ease both",
        "@keyframes fadeUp": {
          from: { opacity: 0, transform: "translateY(12px)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },
      }}
    >
      <Box
        sx={{
          width: 56,
          height: 56,
          borderRadius: 3,
          display: "grid",
          placeItems: "center",
          bgcolor: "rgba(34,211,238,0.12)",
          color: "primary.main",
          border: "1px solid rgba(34,211,238,0.25)",
          mb: 2,
        }}
      >
        <MdAutoAwesome fontSize="large" />
      </Box>

      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
        How can I help you today?
      </Typography>
      <Typography sx={{ color: "text.secondary", mb: 3.5, maxWidth: 480 }}>
        Ask anything — AI-Buddy keeps the conversation context so you can build on
        previous answers.
      </Typography>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
          gap: 1.25,
          width: "100%",
        }}
      >
        {SUGGESTIONS.map((suggestion) => (
          <Box
            key={suggestion.title}
            component="button"
            onClick={() => onSuggestion?.(suggestion.prompt)}
            sx={{
              textAlign: "left",
              cursor: "pointer",
              p: 1.75,
              borderRadius: 2.5,
              bgcolor: "background.paper",
              border: "1px solid",
              borderColor: "divider",
              color: "text.primary",
              font: "inherit",
              transition: "border-color 160ms ease, background-color 160ms ease, transform 160ms ease",
              "&:hover": {
                borderColor: "rgba(34,211,238,0.4)",
                bgcolor: "background.paper",
                transform: "translateY(-1px)",
              },
            }}
          >
            <Typography sx={{ fontSize: 13.5, fontWeight: 600, mb: 0.25 }}>
              {suggestion.title}
            </Typography>
            <Typography sx={{ fontSize: 13, color: "text.secondary" }}>
              {suggestion.prompt}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

export default EmptyState;
