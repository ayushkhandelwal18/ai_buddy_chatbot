import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Box } from "@mui/material";
import CodeBlock from "./CodeBlock";

/**
 * Renders assistant answers as Markdown (headings, lists, tables, links…)
 * and turns fenced code blocks into highlighted, copyable code panels.
 */
function MarkdownContent({ content }) {
  return (
    <Box className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Fenced blocks arrive wrapped in <pre><code>.
          pre({ children }) {
            const codeElement = Array.isArray(children) ? children[0] : children;
            const className = codeElement?.props?.className || "";
            const match = /language-([\w+#-]+)/.exec(className);
            const code = String(codeElement?.props?.children ?? "").replace(/\n$/, "");
            return <CodeBlock language={match?.[1]} code={code} />;
          },
          code({ className, children, ...props }) {
            return (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
          a({ children, href, ...props }) {
            return (
              <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
                {children}
              </a>
            );
          },
          table({ children }) {
            return (
              <Box
                component="table"
                sx={{
                  width: "100%",
                  borderCollapse: "collapse",
                  my: 1.5,
                  fontSize: 14,
                  display: "block",
                  overflowX: "auto",
                }}
              >
                {children}
              </Box>
            );
          },
        }}
      >
        {content || ""}
      </ReactMarkdown>
    </Box>
  );
}

export default MarkdownContent;
