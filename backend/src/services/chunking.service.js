// Approximation: 4 characters/token, targeting 600 tokens with 100-token overlap.
// Chunks stay within a page so citation boundaries remain exact.
export const chunkPages = (pages) => {
  const chunks = [];
  const seen = new Set();
  for (const { pageNumber, text } of pages) {
    const normalized = text.replace(/[^\S\n]+/g, " ").trim();
    let start = 0;
    while (start < normalized.length) {
      let end = Math.min(start + 2800, normalized.length);
      if (end < normalized.length) {
        const portion = normalized.slice(start + 2000, end);
        const boundaries = [...portion.matchAll(/\n|[.!?]\s/g)];
        const boundary = boundaries.at(-1);
        if (boundary) end = start + 2000 + boundary.index + 1;
        else {
          const space = normalized.lastIndexOf(" ", end);
          if (space > start + 2000) end = space;
        }
      }
      const content = normalized.slice(start, end).trim();
      if (content && !seen.has(content)) {
        seen.add(content);
        chunks.push({ text: content, pageStart: pageNumber, pageEnd: pageNumber, chunkIndex: chunks.length });
      }
      if (end === normalized.length) break;
      start = end - 400;
      const space = normalized.indexOf(" ", start);
      if (space >= start && space < end) start = space + 1;
    }
  }
  return chunks;
};
