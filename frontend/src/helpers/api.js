import axios from "axios";

export const getSavedMemories = async (signal) => {
  try { return (await axios.get("/memories", { withCredentials: true, signal })).data; }
  catch (error) { throw toApiError(error, "Unable to load saved memories"); }
};

export const deleteSavedMemory = async (id, signal) => {
  try { return (await axios.delete(`/memories/${encodeURIComponent(id)}`, { withCredentials: true, signal })).data; }
  catch (error) { throw toApiError(error, "Unable to delete memory"); }
};

export const clearSavedMemories = async (signal) => {
  try { return (await axios.delete("/memories", { withCredentials: true, signal })).data; }
  catch (error) { throw toApiError(error, "Unable to clear saved memories"); }
};

export const updateMemorySettings = async (enabled, signal) => {
  try { return (await axios.patch("/memories/settings", { enabled }, { withCredentials: true, signal })).data; }
  catch (error) { throw toApiError(error, "Unable to update memory settings"); }
};

export const uploadPdfDocument = async (file, { signal, onUploadProgress, retryDocumentId } = {}) => {
  const form = new FormData();
  form.append("file", file);
  try {
    return (await axios.post("/documents/upload", form, {
      withCredentials: true, signal, onUploadProgress,
      params: retryDocumentId ? { retryDocumentId } : undefined,
      headers: { "Content-Type": undefined },
    })).data;
  } catch (error) { throw toApiError(error, "PDF upload failed"); }
};

export const listPdfDocuments = async (signal) => {
  try { return (await axios.get("/documents?limit=100", { withCredentials: true, signal })).data; }
  catch (error) { throw toApiError(error, "Unable to load PDFs"); }
};

export const getPdfDocumentStatus = async (id, signal) => {
  try { return (await axios.get(`/documents/${encodeURIComponent(id)}/status`, { withCredentials: true, signal })).data; }
  catch (error) { throw toApiError(error, "Unable to check PDF status"); }
};

export const deletePdfDocument = async (id, signal) => {
  try { return (await axios.delete(`/documents/${encodeURIComponent(id)}`, { withCredentials: true, signal })).data; }
  catch (error) { throw toApiError(error, "Unable to delete PDF"); }
};

const validIdentity = (data) => typeof data?.name === "string" && !!data.name.trim() && typeof data?.email === "string" && !!data.email.trim();

const authenticate = async (url, payload, expectedStatus) => {
  try {
    const response = await axios.post(url, payload, { withCredentials: true });
    if (response.status !== expectedStatus || !validIdentity(response.data)) throw new Error("Unable to confirm your session. Please try again.");
    return response.data;
  } catch (error) { throw toApiError(error, "Unable to sign in"); }
};

export const loginUser = (email, password) => authenticate("/user/login", { email, password }, 200);
export const signupUser = (name, email, password) => authenticate("/user/signup", { name, email, password }, 201);

export const checkAuthStatus = async () => {
  const response = await axios.get("/user/auth-status", { withCredentials: true });
  if (response.data?.message !== "OK" || !validIdentity(response.data)) throw new Error("No active session");
  return response.data;
};

export const userLogout = async () => {
  try { return (await axios.get("/user/logout", { withCredentials: true })).data; }
  catch (error) {
    // An expired session is already signed out.
    if (error.response?.status === 401) return { message: "OK" };
    throw toApiError(error, "Unable to log out. Please try again.");
  }
};

/* ---------------------------------------------------------------------------
 * Conversations API (new architecture)
 * ------------------------------------------------------------------------- */

/**
 * Normalises an axios/unknown error into a consistent shape that both
 * `error.message` and `error.response.data.message` can read.
 */
const toApiError = (error, fallback = "Request failed") => {
  const message =
    error?.response?.data?.message ||
    error?.response?.data?.errors?.[0]?.msg ||
    error?.message ||
    fallback;

  const wrapped = new Error(message);
  const errors = Array.isArray(error?.response?.data?.errors) ? error.response.data.errors.map(({ path, msg }) => ({ path, msg })) : [];
  wrapped.fields = Object.fromEntries(errors.filter(({ path }) => typeof path === "string").map(({ path, msg }) => [path, msg]));
  wrapped.response = { status: error?.response?.status, data: { message, errors } };
  return wrapped;
};

export const listConversations = async (limit = 30, skip = 0) => {
  try {
    const res = await axios.get(`/conversations?limit=${limit}&skip=${skip}`);
    return res.data;
  } catch (error) {
    throw toApiError(error, "Unable to load conversations");
  }
};

export const createConversation = async (title) => {
  try {
    const res = await axios.post("/conversations", title ? { title } : {});
    return res.data;
  } catch (error) {
    throw toApiError(error, "Unable to create conversation");
  }
};

export const getConversation = async (conversationId, signal) => {
  try {
    const res = await axios.get(`/conversations/${conversationId}`, { signal });
    return res.data;
  } catch (error) {
    throw toApiError(error, "Unable to load conversation");
  }
};

export const renameConversation = async (conversationId, title) => {
  try {
    const res = await axios.patch(`/conversations/${conversationId}`, { title });
    return res.data;
  } catch (error) {
    throw toApiError(error, "Unable to rename conversation");
  }
};

export const deleteConversation = async (conversationId) => {
  try {
    const res = await axios.delete(`/conversations/${conversationId}`);
    return res.data;
  } catch (error) {
    throw toApiError(error, "Unable to delete conversation");
  }
};

export const deleteAllConversations = async () => {
  try {
    const res = await axios.delete("/conversations");
    return res.data;
  } catch (error) {
    throw toApiError(error, "Unable to delete conversations");
  }
};

export const getConversationMessages = async (
  conversationId,
  { limit = 20, before, skip = 0 } = {}
) => {
  try {
    const params = new URLSearchParams({ limit: String(limit), skip: String(skip) });
    if (before) params.set("before", before);
    const res = await axios.get(`/conversations/${conversationId}/messages?${params}`);
    return res.data;
  } catch (error) {
    throw toApiError(error, "Unable to load messages");
  }
};

export const regenerateConversationMessage = async (conversationId, messageId) => {
  try {
    const res = await axios.post(
      `/conversations/${conversationId}/messages/${messageId}/regenerate`
    );
    return res.data;
  } catch (error) {
    throw toApiError(error, "Unable to regenerate the answer");
  }
};

export const deleteConversationMessage = async (conversationId, messageId) => {
  try {
    const res = await axios.delete(`/conversations/${conversationId}/messages/${messageId}`);
    return res.data;
  } catch (error) {
    throw toApiError(error, "Unable to delete message");
  }
};

/**
 * Sends a message and consumes the Server-Sent-Events stream.
 *
 * `onEvent` receives every parsed event: { type: "meta" | "delta" | "done" |
 * "stopped" | "error", ... }. Passing an `AbortSignal` stops the generation
 * (the server keeps the partial answer).
 */
export const streamConversationMessage = async (
  conversationId,
  message,
  { signal, onEvent, ...options } = {}
) => {
  const res = await fetch(
    `${import.meta.env.VITE_API_URL}/conversations/${conversationId}/messages/stream`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ message, ...options }),
      signal,
    }
  );

  if (!res.ok || !res.body) {
    let payload = {};
    try {
      payload = await res.json();
    } catch {
      /* ignore */
    }
    throw toApiError(
      { response: { data: payload } },
      "Unable to reach the AI provider"
    );
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const handleChunk = (raw) => {
    const line = raw
      .split("\n")
      .find((part) => part.startsWith("data:"));
    if (!line) return;

    const payload = line.slice(5).trim();
    if (!payload) return;
    if (payload === "[DONE]") {
      onEvent?.({ type: "stream-end" });
      return;
    }
    try {
      onEvent?.(JSON.parse(payload));
    } catch {
      /* ignore malformed frames */
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";

    for (const frame of frames) {
      handleChunk(frame);
    }
  }

  if (buffer.trim()) {
    handleChunk(buffer);
  }
};
