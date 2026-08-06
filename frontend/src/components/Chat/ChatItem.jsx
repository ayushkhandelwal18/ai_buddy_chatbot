// import React from "react";
import { Box, Avatar, Typography } from "@mui/material";
import { useAuth } from "../../context/AuthContent";

// syntax highlighter
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { coldarkDark } from "react-syntax-highlighter/dist/esm/styles/prism";

// regex se saare code blocks detect karo
function extractCodeBlocks(message) {
  const regex = /```(\w+)?\n([\s\S]*?)```/g;
  const blocks = [];
  let match;

  while ((match = regex.exec(message)) !== null) {
    blocks.push({
      lang: match[1] || "plaintext", // agar lang missing ho to default
      code: match[2].trim(),
    });
  }

  // agar koi code block nahi mila, plain text return
  if (blocks.length === 0) return null;
  return blocks;
}

const ChatItem = ({
  content,
  role,
}) => {
  const auth = useAuth();
  const codeBlocks = extractCodeBlocks(content);

  return role === "assistant" ? (
    <Box
      sx={{
        display: "flex",
        p: 2,
        bgcolor: "#004d5612",
        gap: 2,
        borderRadius: 2,
        my: 1,
      }}
    >
      <Avatar sx={{ ml: "0" }}>
        <img src="logo.png" alt="openai" width={"30px"} />
      </Avatar>

      <Box>
        {/* agar koi code block nahi hai, plain text dikhado */}
        {!codeBlocks && <Typography sx={{ fontSize: "20px" }}>{content}</Typography>}

        {/* multiple code blocks render */}
        {codeBlocks &&
          codeBlocks.map((block, i) => (
            <SyntaxHighlighter
              key={i}
              style={coldarkDark}
              language={block.lang.toLowerCase()}
              customStyle={{
                borderRadius: "10px",
                fontSize: "14px",
                padding: "10px",
                marginTop: "10px",
              }}
            >
              {block.code}
            </SyntaxHighlighter>
          ))}
      </Box>
    </Box>
  ) : (
    <Box
      sx={{
        display: "flex",
        p: 2,
        bgcolor: "#004d56",
        gap: 2,
        borderRadius: 2,
      }}
    >
      <Avatar sx={{ ml: 0, bgcolor: "black", color: "white" }}>
  {auth?.user?.name[0]}{/* first letter always */}
  {auth?.user?.name.split(" ")[1] ? auth.user.name.split(" ")[1][0] : ""}{/* second letter if exists */}
</Avatar>
      <Box>
        {!codeBlocks && <Typography sx={{ fontSize: "20px" }}>{content}</Typography>}

        {codeBlocks &&
          codeBlocks.map((block, i) => (
            <SyntaxHighlighter
              key={i}
              style={coldarkDark}
              language={block.lang.toLowerCase()}
              customStyle={{
                borderRadius: "10px",
                fontSize: "14px",
                padding: "10px",
                marginTop: "10px",
              }}
            >
              {block.code}
            </SyntaxHighlighter>
          ))}
      </Box>
    </Box>
  );
};

export default ChatItem;
