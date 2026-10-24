import { useState } from "react";
import { Box, IconButton, Tooltip, Typography } from "@mui/material";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { MdCheck, MdContentCopy } from "react-icons/md";

/** Languages the bundled Prism build can highlight. */
const SUPPORTED = new Set(SyntaxHighlighter.supportedLanguages || []);

/** Common aliases the model tends to emit. */
const ALIASES = {
  js: "javascript",
  jsx: "jsx",
  ts: "typescript",
  tsx: "tsx",
  py: "python",
  rb: "ruby",
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  yml: "yaml",
  md: "markdown",
  html: "markup",
  xml: "markup",
  "c++": "cpp",
  "c#": "csharp",
  cs: "csharp",
  golang: "go",
  plaintext: "text",
  txt: "text",
  text: "text",
};

const resolveLanguage = (raw) => {
  if (!raw) return null;
  const lower = String(raw).toLowerCase().trim();
  const mapped = ALIASES[lower] || lower;
  if (mapped === "text") return "text";
  return SUPPORTED.has(mapped) ? mapped : null;
};

/**
 * A fenced code block with syntax highlighting and a copy-to-clipboard button.
 */
function CodeBlock({ language, code }) {
  const [copied, setCopied] = useState(false);
  const resolved = resolveLanguage(language);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable (http / permissions) */
    }
  };

  return (
    <Box
      sx={{
        my: 1.5,
        borderRadius: 2,
        overflow: "hidden",
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "#0b1120",
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 1.5,
          py: 0.5,
          borderBottom: "1px solid",
          borderColor: "divider",
          bgcolor: "rgba(255,255,255,0.03)",
        }}
      >
        <Typography
          sx={{
            fontSize: 11.5,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "text.secondary",
            fontFamily: "monospace",
          }}
        >
          {resolved || "code"}
        </Typography>

        <Tooltip title={copied ? "Copied" : "Copy code"}>
          <IconButton
            size="small"
            onClick={handleCopy}
            aria-label="Copy code"
            sx={{ color: copied ? "success.main" : "text.secondary" }}
          >
            {copied ? <MdCheck fontSize="small" /> : <MdContentCopy fontSize="small" />}
          </IconButton>
        </Tooltip>
      </Box>

      <SyntaxHighlighter
        language={resolved || "text"}
        style={oneDark}
        customStyle={{
          margin: 0,
          padding: "14px 16px",
          fontSize: 13,
          lineHeight: 1.6,
          background: "transparent",
          overflowX: "auto",
        }}
        codeTagProps={{ style: { fontFamily: '"Fira Code", Consolas, monospace' } }}
      >
        {code}
      </SyntaxHighlighter>
    </Box>
  );
}

export default CodeBlock;
