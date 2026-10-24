import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getConversation, getPdfDocumentStatus, uploadPdfDocument } from "../helpers/api";
import { attachmentReadiness } from "../helpers/document-attachments";

const pending = (record) => ["uploaded", "processing"].includes(record.status);

export default function usePdfAttachments(conversationId, enabled) {
  const scope = conversationId || "draft";
  const [drafts, setDrafts] = useState({});
  const [contexts, setContexts] = useState({});
  const [cache, setCache] = useState({});
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState("");
  const requests = useRef(new Map());
  const mounted = useRef(false);
  const contextEpochs = useRef(new Map());

  useEffect(() => {
    mounted.current = true;
    const active = requests.current;
    return () => { mounted.current = false; active.forEach((controller) => controller.abort()); active.clear(); };
  }, []);

  const acceptConversation = useCallback((conversation) => {
    contextEpochs.current.set(conversation.id, (contextEpochs.current.get(conversation.id) || 0) + 1);
    setContexts((current) => ({ ...current, [conversation.id]: { ids: conversation.documentIds || [] } }));
    setDrafts((current) => { const next = { ...current }; delete next[conversation.id]; return next; });
  }, []);

  useEffect(() => {
    if (!conversationId || !enabled) return undefined;
    const controller = new AbortController();
    const epoch = contextEpochs.current.get(conversationId) || 0;
    getConversation(conversationId, controller.signal).then((data) => {
      if (!controller.signal.aborted && (contextEpochs.current.get(conversationId) || 0) === epoch) setContexts((current) => ({ ...current, [conversationId]: { ids: data.conversation.documentIds || [] } }));
    }).catch((err) => {
      if (!controller.signal.aborted && (contextEpochs.current.get(conversationId) || 0) === epoch) setContexts((current) => ({ ...current, [conversationId]: { ...current[conversationId], error: err.message } }));
    });
    return () => controller.abort();
  }, [conversationId, enabled, refresh]);

  const inherited = contexts[scope];
  const records = useMemo(() => drafts[scope] ?? (inherited?.ids || []).map((id) => ({
    key: id, id, originalFilename: "PDF", fileSize: 0, status: "checking", ...cache[id],
  })), [drafts, scope, inherited, cache]);
  const loading = Boolean(conversationId && drafts[scope] === undefined && !inherited);
  const readiness = attachmentReadiness(records, loading,
    drafts[scope] === undefined ? inherited?.error : "");

  const updateRecord = useCallback((recordScope, key, patch) => {
    setDrafts((current) => ({ ...current, [recordScope]: (current[recordScope] || []).map((record) => record.key === key ? { ...record, ...patch } : record) }));
  }, []);

  // Watch exact attachment IDs, never a paginated global document list.
  const watchedIds = [...new Set([
    ...records.filter((record) => record.id).map((record) => record.id),
    ...Object.values(drafts).flat().filter((record) => record.id && pending(record)).map((record) => record.id),
  ])].sort().join(",");
  useEffect(() => {
    if (!enabled || !watchedIds) return undefined;
    const controller = new AbortController();
    let timer;
    let activeIds = watchedIds.split(",");
    const check = async () => {
      const updates = await Promise.all(activeIds.map(async (id) => {
        try { return (await getPdfDocumentStatus(id, controller.signal)).document; }
        catch (err) { return { id, status: "status-error", processingError: err.message }; }
      }));
      if (controller.signal.aborted) return;
      setCache((current) => {
        const next = { ...current };
        updates.forEach((doc) => { next[doc.id] = { ...next[doc.id], ...doc }; });
        return next;
      });
      setDrafts((current) => Object.fromEntries(Object.entries(current).map(([key, values]) => [key,
        values.map((record) => {
          const doc = updates.find((update) => update.id === record.id);
          return doc ? { ...record, ...doc } : record;
        }),
      ])));
      activeIds = updates.filter((doc) => ["uploaded", "processing"].includes(doc.status)).map((doc) => doc.id);
      if (activeIds.length) timer = setTimeout(check, 5000);
    };
    void check();
    return () => { clearTimeout(timer); controller.abort(); };
  }, [watchedIds, enabled, refresh]);

  // The existing backend permits one processing job per user. Queue attachments
  // until the preceding PDF becomes ready/failed instead of posting in parallel.
  useEffect(() => {
    if (!enabled) return;
    const entries = Object.entries(drafts);
    if (entries.some(([, values]) => values.some((record) => ["uploading", "uploaded", "processing"].includes(record.status)))) return;
    const next = entries.flatMap(([recordScope, values]) => values.map((record) => ({ recordScope, record })))
      .find(({ record }) => record.status === "queued");
    if (!next || requests.current.has(next.record.key)) return;
    const { recordScope, record } = next;
    const controller = new AbortController();
    requests.current.set(record.key, controller);
    updateRecord(recordScope, record.key, { status: "uploading", processingError: "", progress: 0 });
    uploadPdfDocument(record.file, { signal: controller.signal, retryDocumentId: record.retryDocumentId, onUploadProgress: (event) => {
      if (mounted.current && !controller.signal.aborted && event.total) updateRecord(recordScope, record.key, { progress: Math.round(event.loaded / event.total * 100) });
    } }).then(({ document }) => {
      if (!mounted.current || controller.signal.aborted) return;
      setCache((current) => ({ ...current, [document.id]: document }));
      updateRecord(recordScope, record.key, document);
    }).catch((err) => {
      if (mounted.current && !controller.signal.aborted) updateRecord(recordScope, record.key, { status: "failed", processingError: err.message });
    }).finally(() => { requests.current.delete(record.key); });
  }, [drafts, enabled, updateRecord]);

  const addFiles = useCallback((files) => {
    const valid = files.filter((file) => /\.pdf$/i.test(file.name) && (!file.type || file.type === "application/pdf"));
    if (valid.length !== files.length) setError("Only PDF attachments are supported."); else setError("");
    if (!valid.length) return;
    if ((drafts[scope]?.length || 0) + valid.length > 10) { setError("Attach at most 10 PDFs to a question."); return; }
    setDrafts((current) => {
      // New attachments replace inherited conversation context, then accumulate
      // with other PDFs attached to this unsent question.
      const existing = current[scope] || [];
      if (existing.length + valid.length > 10) return current;
      return { ...current, [scope]: [...existing, ...valid.map((file) => ({
        key: crypto.randomUUID(), file, originalFilename: file.name, fileSize: file.size, status: "queued",
      }))] };
    });
  }, [scope, drafts]);

  const remove = useCallback((key) => {
    requests.current.get(key)?.abort();
    setDrafts((current) => ({ ...current, [scope]: records.filter((record) => record.key !== key) }));
  }, [scope, records]);

  const retry = useCallback((key) => {
    const record = records.find((item) => item.key === key);
    if (!record?.file) { setError("Choose the original PDF again using + to retry its upload."); return; }
    updateRecord(scope, key, { retryDocumentId: record.id || record.retryDocumentId, id: undefined, status: "queued", processingError: "", progress: 0 });
  }, [records, scope, updateRecord]);

  const moveDraft = useCallback((targetId) => {
    setDrafts((current) => {
      if (!current.draft) return current;
      const next = { ...current, [targetId]: current.draft }; delete next.draft; return next;
    });
  }, []);

  return { records, ...readiness, error, addFiles, remove, retry, moveDraft, acceptConversation,
    refresh: () => setRefresh((value) => value + 1),
    documentIds: records.map((record) => record.id).filter(Boolean),
  };
}
