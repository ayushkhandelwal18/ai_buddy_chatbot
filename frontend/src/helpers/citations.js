export const citationPages = (source) => {
  if (source.sourceType === "memory" || !Number.isSafeInteger(source.pageStart) || source.pageStart < 1) return [];
  const end = source.pageEnd ?? source.pageStart;
  // Ingestion permits 500 pages. Ignore malformed ranges rather than fabricate
  // pages or allocate an unbounded list from old/missing metadata.
  if (!Number.isSafeInteger(end) || end < source.pageStart || end - source.pageStart >= 500) return [];
  return Array.from({ length: end - source.pageStart + 1 }, (_, index) => source.pageStart + index);
};

const pageLabels = (pages) => [...new Set(pages)].sort((a, b) => a - b).map((page) => `[Page ${page}]`).join(" ");

// Older saved answers still contain source IDs. Translate only their citation
// markers at display/copy time, using their own saved source metadata.
export const displayCitations = (content, sources = []) => {
  const byId = new Map(sources.map((source) => [source.sourceId, source]));
  return (content || "").replace(/\[(?:S|M)\d+\](?:[ \t]*\[(?:S|M)\d+\])*/g, (group) => {
    const pages = [...group.matchAll(/\[([SM]\d+)\]/g)].flatMap(([, id]) => {
      const source = byId.get(id);
      return source ? citationPages(source) : [];
    });
    return pageLabels(pages);
  });
};

export const sourceLabels = (sources = []) => {
  const groups = new Map();
  for (const source of sources) {
    if (source.sourceType === "memory") {
      const key = `memory:${source.memoryId || source.sourceId}`;
      const field = String(source.key || "");
      groups.set(key, { key, label: `Saved memory · ${source.category} · ${field.includes(".") ? field.split(".")[0] : field.replaceAll("_", " ")}` });
      continue;
    }
    const pages = citationPages(source);
    if (!pages.length) continue;
    const key = `document:${source.documentId || source.originalFilename}`;
    if (!groups.has(key)) groups.set(key, { key, filename: source.originalFilename, pages: [] });
    groups.get(key).pages.push(...pages);
  }
  return [...groups.values()].map((group) => ({ key: group.key,
    label: group.label || [group.filename, pageLabels(group.pages)].filter(Boolean).join(" · "),
  }));
};
