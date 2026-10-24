import { Box } from "@mui/material";

/** Three animated dots shown while the assistant is thinking. */
function TypingIndicator() {
  return (
    <Box
      sx={{ display: "flex", alignItems: "center", gap: 0.75, py: 0.75 }}
      aria-label="AI-Buddy is thinking"
      role="status"
    >
      {[0, 1, 2].map((index) => (
        <Box
          key={index}
          sx={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            bgcolor: "primary.main",
            animation: `typingDot 1.2s ${index * 0.16}s infinite ease-in-out`,
            "@keyframes typingDot": {
              "0%, 60%, 100%": { opacity: 0.25, transform: "translateY(0)" },
              "30%": { opacity: 1, transform: "translateY(-4px)" },
            },
          }}
        />
      ))}
    </Box>
  );
}

export default TypingIndicator;
