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

export const loginUser = async (email, password) => {

   try{
      const res=await axios.post("/user/login", { email, password });
      return res.data;
   }
catch (error) {
    // axios error hamesha ye shape me throw kar
    throw {
      response: {
        data: {
          message: error.response?.data?.message || "Login Failed"
        }
      }
    };
  }
};




export const signupUser = async (name, email, password) => {
  try {
    const res = await axios.post("/user/signup", { name, email, password });
    return res.data;
  } catch (error) {
    // axios error hamesha ye shape me throw kar
    throw {
      response: {
        data: {
          message: error.response?.data?.message || "Signup Failed"
        }
      }
    };
  }
};

export const checkAuthStatus = async () => {

     const res=await axios.get("/user/auth-status");

     if(res.status !== 200){
        throw new Error("Unable to authenticate user");
     }

     const data =await res.data;
     return data;
};

export const sendChatRequest = async (message) => {

     const res=await axios.post("/chat/new" , {message});

     if(res.status !== 200){
        throw new Error("Unable to send chat");
     }

     const data =await res.data;
     return data;
};

export const getUserChats = async (limit = 10, skip = 0) => {

     const res=await axios.get(`/chat/all-chats?limit=${limit}&skip=${skip}`);

     if(res.status !== 200){
        throw new Error("Unable to get all chats");
     }

     const data =await res.data;
     return data;
};



export const deleteUserChats = async () => {

     const res=await axios.delete("/chat/delete");

     if(res.status !== 200){
        throw new Error("Unable to delete chat");
     }

     const data =await res.data;
     return data;
};


export const userLogout = async () => {

     const res=await axios.get("/user/logout");

     if(res.status !== 200){
        throw new Error("Unable to logout");
     }

     const data =await res.data;
     return data;
};

/* ---------------------------------------------------------------------------
 * Conversations API (new architecture)
 * ------------------------------------------------------------------------- */

/**
 * Normalises an axios/unknown error into a consistent shape that both
 * `error.message` and `error.response.data.message` can read.
 */
export const toApiError = (error, fallback = "Request failed") => {
  const message =
    error?.response?.data?.message ||
    error?.response?.data?.errors?.[0]?.msg ||
    error?.message ||
    fallback;

  const wrapped = new Error(message);
  wrapped.response = { data: { message } };
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

export const sendConversationMessage = async (conversationId, message, options = {}) => {
  try {
    const res = await axios.post(`/conversations/${conversationId}/messages`, { message, ...options });
    return res.data;
  } catch (error) {
    throw toApiError(error, "Unable to send message");
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
