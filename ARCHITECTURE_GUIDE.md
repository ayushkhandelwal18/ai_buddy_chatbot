# AI-Buddy Technical Architecture Guide

Source review date: **2026-10-25**. Project root: **B:\AI_BUDDY**.

This guide describes the current working-tree implementation, including changes not yet committed. It is based on source, route registrations, models, configuration, package manifests/lockfiles, and maintained scripts—not feature claims in older documentation. **Implemented** means a code path exists; it does not mean a deployed service was tested. No credentials, private PDF contents, or user records are included. Only this guide was created for this documentation task.

## 1. Project Overview

AI-Buddy is a MERN application: MongoDB stores application records, Express/Node exposes the API, and React renders the browser interface. Gemini generates answers. Qdrant stores searchable PDF chunk vectors.

There are three separate kinds of context:

| Context | Scope and storage | How it reaches an answer |
|---|---|---|
| Conversation history | Messages from one owned conversation in MongoDB | Recent messages become Gemini chat history. |
| Persistent memory | A bounded MongoDB profile belonging to one authenticated user | Deterministic ranking selects relevant facts/preferences for system-instruction context, across conversations. |
| PDF evidence | Owned document metadata in MongoDB; original PDFs on disk; chunk text/vectors in Qdrant | A question embedding retrieves selected document passages for a grounded generation request. |

A new conversation does not inherit every old message. It can retrieve the same user's saved personal memories. A PDF-derived college name does not automatically become personal memory.

```mermaid
flowchart LR
    Browser["React browser client"] --> API["Express API /api/v1"]
    API --> Auth["Signed cookie and JWT verification"]
    Auth --> Conversations["Owned conversations and messages"]
    Conversations --> Mongo["MongoDB"]
    Conversations --> Memory["Personal memory service"]
    Memory --> Mongo
    Conversations --> Normal["Ordinary Gemini chat"]
    Conversations --> RAG["Document answering"]
    Auth --> Upload["PDF ingestion"]
    Upload --> Disk["Private local PDF storage"]
    Upload --> Embed["Gemini embedding client"]
    Embed --> Qdrant["Qdrant document index"]
    RAG --> Embed
    RAG --> Qdrant
    Normal --> Gemini["Gemini generation client"]
    RAG --> Gemini
    Gemini --> Output["Persisted answer and client output"]
    Output --> Browser
```

### 1.1 Implementation status

| Capability | Status | Actual boundary |
|---|---|---|
| Email/password signup, login, logout | Implemented | Signup also takes a display name. Confirmation is checked in the browser. |
| Cookie/JWT authentication and owner checks | Implemented | JWT validation is separate from querying the account; no session-revocation store. |
| Multiple conversations, history, rename/delete, regeneration | Implemented | Regeneration removes later messages before asking for a new answer. |
| Incremental ordinary chat streaming | Implemented | POST Fetch stream carrying SSE frames, not WebSockets or browser EventSource. |
| PDF upload, extraction, indexing, attachment inheritance | Implemented | Local files and an in-process job scheduler; not a durable distributed queue. |
| RAG responses over the streaming endpoint | Partially streamed | One validated answer delta after buffering, rather than incremental model tokens. |
| Source IDs and page metadata | Implemented with limits | Structural citation validation; no automated proof that every statement is semantically entailed. |
| Cross-conversation personal memory | Implemented with limits | Pattern-based extraction, bounded facts and vocabulary, no general LLM extraction. |
| OCR, document viewer/download API, hybrid retrieval, reranking | Not implemented | No public PDF URL is created. |
| OTP, Google OAuth, password reset | Not implemented | Current forms use the existing email/password flow. |

### 1.2 Source map and main responsibilities

| Source | Important functions/components and responsibility |
|---|---|
| [frontend/src/main.jsx](B:/AI_BUDDY/frontend/src/main.jsx), [App.jsx](B:/AI_BUDDY/frontend/src/App.jsx) | Set Axios defaults; mount AuthProvider, BrowserRouter, ThemeProvider; register public/chat routes. |
| [AuthForm.jsx](B:/AI_BUDDY/frontend/src/components/public/AuthForm.jsx), [AuthContent.jsx](B:/AI_BUDDY/frontend/src/context/AuthContent.jsx) | Validate forms, control password visibility/loading, call login/signup/logout, restore identity. |
| [Chat.jsx](B:/AI_BUDDY/frontend/src/Pages/Chat.jsx), [ChatContext.jsx](B:/AI_BUDDY/frontend/src/context/ChatContext.jsx) | Protected workspace and conversation actions; `sendMessage`, `runStream`, `stopStreaming`, `regenerate`. |
| [api.js](B:/AI_BUDDY/frontend/src/helpers/api.js) | Credentialed REST/upload helpers, error conversion, and `streamConversationMessage` SSE parsing. |
| [usePdfAttachments.js](B:/AI_BUDDY/frontend/src/context/usePdfAttachments.js) | Draft attachments, sequential uploads, status polling, retries, inherited document IDs. |
| [components/chat/](B:/AI_BUDDY/frontend/src/components/chat) | Composer, sidebar, message rendering, Markdown/code blocks, PDF and memory dialogs. |
| [backend/src/index.js](B:/AI_BUDDY/backend/src/index.js), [app.js](B:/AI_BUDDY/backend/src/app.js) | Connect MongoDB, listen, configure CORS/JSON/cookies, mount routers and error handlers. |
| [routes/index.route.js](B:/AI_BUDDY/backend/src/routes/index.route.js), [validators.js](B:/AI_BUDDY/backend/src/utils/validators.js) | API groups and request validation. |
| [user.controller.js](B:/AI_BUDDY/backend/src/controllers/user.controller.js), [token-manager.js](B:/AI_BUDDY/backend/src/utils/token-manager.js) | Account operations, bcrypt, session issuance, JWT verification. |
| [conversation.controller.js](B:/AI_BUDDY/backend/src/controllers/conversation.controller.js) | REST/stream message lifecycle, memory preparation, ordinary/RAG branching, regeneration. |
| [conversation.service.js](B:/AI_BUDDY/backend/src/services/conversation.service.js) | Owned lookup, history, message writes, attachment resolution, serialization, preview/title updates. |
| [gemini.service.js](B:/AI_BUDDY/backend/src/services/gemini.service.js) | `generateReply`, `streamReply`, `generateConversationTitle`, `fallbackTitle`. |
| [document.controller.js](B:/AI_BUDDY/backend/src/controllers/document.controller.js) | Upload hashing/reuse/retry, metadata creation, status/list, coordinated deletion. |
| [document-processing.service.js](B:/AI_BUDDY/backend/src/services/document-processing.service.js) | `reserveProcessing`, `processDocument`, deadline expiry and public metadata serialization. |
| [pdf.service.js](B:/AI_BUDDY/backend/src/services/pdf.service.js), [pdf-extraction.worker.js](B:/AI_BUDDY/backend/src/services/pdf-extraction.worker.js) | Isolated PDF.js text extraction and timeout/resource handling. |
| [chunking.service.js](B:/AI_BUDDY/backend/src/services/chunking.service.js), [embedding.service.js](B:/AI_BUDDY/backend/src/services/embedding.service.js) | Page-local chunks and normalized 768-dimensional embeddings. |
| [qdrant.config.js](B:/AI_BUDDY/backend/src/config/qdrant.config.js), [qdrant.service.js](B:/AI_BUDDY/backend/src/services/qdrant.service.js) | Lazy singleton, endpoint validation, collection inspection/explicit initialization. |
| [document-index.service.js](B:/AI_BUDDY/backend/src/services/document-index.service.js) | Payload indexes, deterministic point IDs, upsert/delete with ownership filters. |
| [retrieval.service.js](B:/AI_BUDDY/backend/src/services/retrieval.service.js), [rag.service.js](B:/AI_BUDDY/backend/src/services/rag.service.js) | Resolve ready documents, filtered vector query, bounded sources, grounded generation/citation validation. |
| [memory-extraction.service.js](B:/AI_BUDDY/backend/src/services/memory-extraction.service.js), [memory-policy.service.js](B:/AI_BUDDY/backend/src/services/memory-policy.service.js), [memory.service.js](B:/AI_BUDDY/backend/src/services/memory.service.js) | Extract explicit facts, merge/conflict/expiry rules, rank memory, manage owned profiles. |
| [models/](B:/AI_BUDDY/backend/src/models), [middleware/](B:/AI_BUDDY/backend/src/middleware) | Mongoose schemas/indexes, multipart handling, error handling. |
| [scripts/](B:/AI_BUDDY/backend/scripts) | Offline checks, live API tests, explicit Qdrant checks/init, legacy history migration. |

## 2. Technology Stack

Versions below are inspected lockfile versions, not claims about the latest public releases.

| Layer | Dependencies and purpose |
|---|---|
| Browser | React/React DOM 19.1.1; React Router 7.8.2 for URL-driven conversations. |
| UI/theme | Material UI 7.3.1, Emotion, react-icons, react-hot-toast; one existing dark theme. |
| Browser transport | Axios 1.11.0 for REST/multipart progress; native Fetch, TextDecoder and ReadableStream for POST SSE. |
| Text rendering | react-markdown 10.1.0, remark-gfm, react-syntax-highlighter; code copying/highlighting. |
| Frontend tooling | Vite 7.1.3, SWC React plugin, ESLint. Build produces ignored `frontend/dist/`. |
| Server | Node.js ES modules, Express 5.1.0, express-validator, cors, cookie-parser, dotenv. Nodemon is development tooling. |
| Authentication | bcrypt 6.0.0; jsonwebtoken 9.0.2; signed HTTP-only cookie. |
| Primary database | Mongoose 8.16.1 connecting to MongoDB through `MONGO_URL`. |
| Answer generation | `@google/generative-ai` 0.24.1; model `gemini-2.5-flash`. |
| Embeddings | `@google/genai` 2.31.0; model `gemini-embedding-001`; separate API key. |
| Vector index | `@qdrant/js-client-rest` 1.20.0; configured Qdrant REST cluster/collection. |
| PDF text | `pdfjs-dist` 6.4.299, legacy ESM build, inside a Node worker thread. |
| Runtime compatibility | Backend retains npm `node` 22.17.0. PDF.js requires Node `>=22.13.0 \|\| >=24`; Vite requires `^20.19.0 \|\| >=22.12.0`. Confirm the actual deployment executable separately. |

Sources: [backend/package.json](B:/AI_BUDDY/backend/package.json), [backend/package-lock.json](B:/AI_BUDDY/backend/package-lock.json), [frontend/package.json](B:/AI_BUDDY/frontend/package.json), [frontend/package-lock.json](B:/AI_BUDDY/frontend/package-lock.json).

### 2.1 Configuration and exact limits

`rag.config.js` loads `backend/.env` using a path relative to its own module; the terminal's working directory does not determine that path. Existing process environment values take precedence. Imports load configuration but do not initialize Qdrant or generate embeddings. Neither the configured cluster endpoint, collection name, nor secrets are reproduced here.

| Setting | Actual use/default |
|---|---|
| `PORT` | Backend listen port; fallback 3000. |
| `MONGO_URL` | MongoDB connection string; required for server startup. |
| `JWT_SECRET`, `COOKIE_SECRET` | JWT signing and cookie-signature secrets; separate roles. |
| `NODE_ENV` | `production` enables Secure cookies and SameSite=None; otherwise SameSite=Lax. |
| `FRONTEND_URL` | Allowed credentialed CORS origin. |
| `VITE_API_URL` | Public API base including `/api/v1`; used by Axios and SSE Fetch. Never place secrets in Vite variables. |
| `GEMINI_API_KEY` | Existing generation SDK key; not the embedding key. |
| `Gemini_API_KEY_for_embedding` | Exact case-sensitive embedding-key name. |
| `GEMINI_HISTORY_MESSAGES` | `Number(value) \|\| 20`; message count, not a token budget. No additional range validation here. |
| `CHAT_TITLE_MODE` | Lowercased; `local` default skips title-generation calls. A non-local value reaches the AI-title branch. |
| `QDRANT_URL`, `QDRANT_API_KEY`, `QDRANT_COLLECTION` | Cluster REST endpoint, access key, and existing collection. |
| `PDF_MAX_SIZE_MB` | Positive finite value; default 20, multiplied by 1024 squared: nominally 20 MiB. |
| `RAG_TOP_K` | Default 5; must be an integer from 1 to 10. |
| `TEST_BASE` | Optional live-test URL, not an application runtime dependency. |

Code constants: generation maximum output 2048 tokens, temperature 0.6; embedding dimensions 768; PDF chunks at most 2800 characters; nominal overlap 400 characters; PDF context at most 12000 characters; selected memory items at most 12 within 4500 serialized characters. More detailed limits appear in the pipelines below.

Sources: [rag.config.js](B:/AI_BUDDY/backend/src/config/rag.config.js), [upload.config.js](B:/AI_BUDDY/backend/src/config/upload.config.js), [gemini.service.js](B:/AI_BUDDY/backend/src/services/gemini.service.js), [main.jsx](B:/AI_BUDDY/frontend/src/main.jsx), and the retrieval/memory services cited above.

## 3. Simple Chat Architecture

### 3.1 Signup, login, and authorization

1. `/signup` and `/login` render the same `AuthForm`, in different modes. Signup asks for name, email, password, and password confirmation. Only name/email/password are posted; confirmation is a browser validation field.
2. `AuthForm.validate` checks a usable email, minimum six-character trimmed password, signup's 72-UTF-8-byte password bound, and matching confirmation. Password visibility, inline errors, loading, and duplicate-submit protection are local state.
3. `AuthProvider.signup/login` calls helpers in `api.js`. Axios includes credentials because `main.jsx` enables `withCredentials` globally; sensitive auth helpers also specify it explicitly.
4. `app.js` applies CORS, a 1 MiB JSON body limit, and signed-cookie parsing. The user router validates submitted fields before calling its controller.
5. `usersignup` lowercases new email addresses, checks existing accounts, hashes the password with bcrypt cost 10, creates a User, and immediately issues a session. Login uses bcrypt comparison; mixed-case historical email addresses have a case-insensitive fallback lookup. Existing password trimming is preserved.
6. `issueSession` signs a JWT containing account `id` and `email` for seven days. `res.cookie` puts it in `auth_token` as a signed, HTTP-only cookie with matching expiry. JSON responses contain the public name/email, not the JWT or password.
7. `AuthProvider` accepts that identity and the form navigates to `/chat`. On a later browser load, `/user/auth-status` restores the frontend identity. Logout clears the cookie and reloads the page.
8. `ChatWorkspace` waits until that initial check finishes, then redirects an unauthenticated browser to `/login`. This is UI routing only. Actual API protection is `verifyToken` on the server.
9. `verifyToken` reads the signed cookie, verifies the JWT using HS256, checks its identity shape, and puts the trusted identity in `res.locals.jwtData`. Controllers take the user ID from those locals, not frontend claims.
10. Authentication answers “who signed this request?” Authorization additionally answers “does this conversation/document/memory belong to that user?” `getConversationForUser`, document queries, and memory profile queries enforce that boundary.

```mermaid
sequenceDiagram
    participant U as User
    participant F as AuthForm and AuthProvider
    participant E as Express user router
    participant D as MongoDB User
    U->>F: Enter signup or login details
    F->>F: Validate fields and confirmation
    F->>E: Credentialed POST signup or login
    E->>E: Server validation
    alt Signup
        E->>D: Check email and create bcrypt hash record
    else Login
        E->>D: Read account and password hash
        E->>E: Compare supplied password with bcrypt
    end
    E-->>F: Set signed HttpOnly cookie and return public identity
    F->>F: Store identity in React state and navigate to chat
    F->>E: Later protected request with browser cookie
    E->>E: Verify JWT and derive authenticated user ID
    E-->>F: Owned resource or safe error
```

Sources: [AuthForm.jsx](B:/AI_BUDDY/frontend/src/components/public/AuthForm.jsx): `validate`, `submit`; [AuthContent.jsx](B:/AI_BUDDY/frontend/src/context/AuthContent.jsx): `AuthProvider`; [user.controller.js](B:/AI_BUDDY/backend/src/controllers/user.controller.js): `usersignup`, `userlogin`, `issueSession`; [token-manager.js](B:/AI_BUDDY/backend/src/utils/token-manager.js): `createToken`, `verifyToken`.

### 3.2 Conversation and message services

The current UI uses `/conversations`, not the older `/chat/new` API. A conversation stores title/preview/attachment references; separate Message documents store each turn. On `/chat` there may be no conversation yet. The first `sendMessage` creates one, moves its draft attachments, changes the URL to `/chat/:conversationId`, and starts the message request.

`getRecentMessages` selects newest IDs first, then reverses them into chronological order. Controllers read history **before** inserting the current user message, preventing the new question from appearing twice in the prompt. `getMessageForUser` guards regeneration targets. Low-level history/metadata operations frequently filter by the already-authorized conversation ID; they rely on the controller's prior owner check rather than independently accepting arbitrary frontend conversation IDs.

`syncConversationMeta` recomputes message count, latest timestamp, and a whitespace-normalized preview capped at 280 characters. Title generation is local by default. The optional AI title uses the same model, up to 256 output tokens and temperature 0.3, with a local fallback on failure.

Sources: [conversation.service.js](B:/AI_BUDDY/backend/src/services/conversation.service.js): `createConversation`, `getConversationForUser`, `getRecentMessages`, `appendMessage`, `syncConversationMeta`; [ChatContext.jsx](B:/AI_BUDDY/frontend/src/context/ChatContext.jsx): `sendMessage`.

### 3.3 Gemini prompt and ordinary context

`gemini.service.js` keeps one generation integration. `buildModel` combines the AI-Buddy persona, `memoryPrompt(memoryContext)`, and any additional per-request instruction. `toGeminiHistory` converts stored `assistant` roles to Gemini's `model` role and keeps only user/assistant messages whose status is not `failed`. Partial answers marked `stopped` or `error` can remain in future history.

`streamReply` uses `model.startChat({ history })` then `sendMessageStream(message, { signal })`. It yields each non-empty `chunk.text()` to its caller. These are SDK text chunks; the application does not receive or count one event per model token. `generateReply` uses `sendMessage` for non-streaming API/regeneration and RAG. Its explicit 60-second request option is used when a signal or additional system instruction is supplied; ordinary non-streaming calls without either do not set that timeout here.

Ordinary chat is not restricted to PDF evidence. It uses the model's general knowledge plus the supplied history and relevant personal memory. It does not call the embedding API or Qdrant merely because the user has uploaded files elsewhere.

Source: [gemini.service.js](B:/AI_BUDDY/backend/src/services/gemini.service.js): `buildModel`, `toGeminiHistory`, `streamReply`, `generateReply`, `generateConversationTitle`, `fallbackTitle`.

## 4. Simple Chat End-to-End Flow

### 4.1 Main flow diagram

```mermaid
flowchart TD
    Compose["Composer receives non-empty text"] --> Ready{"Attachments ready or absent?"}
    Ready -->|No| Block["Show processing or failure message"]
    Ready -->|Yes| Exists{"Conversation already exists?"}
    Exists -->|No| Create["POST conversations and navigate to its URL"]
    Exists -->|Yes| Send["POST messages/stream with credentials"]
    Create --> Send
    Send --> Check["Verify JWT, validate message, authorize conversation"]
    Check --> Docs{"Resolved document IDs present?"}
    Docs -->|Yes| RAGPath["Use RAG query pipeline in section 7"]
    Docs -->|No| History["Read recent history before current turn"]
    History --> SaveUser["Save user Message and emit meta"]
    SaveUser --> Title["Start title task"]
    SaveUser --> Memories["Extract, save, and select personal memory"]
    Memories --> Prompt["Persona plus memory plus history plus question"]
    Prompt --> Model["Gemini sendMessageStream"]
    Model --> Delta["SSE delta frames carry text chunks"]
    Delta --> Render["React appends text and renders Markdown"]
    Model --> Persist["Save assistant Message and update conversation metadata"]
    Title --> Persist
    Persist --> Done["Emit done with persisted answer and IDs"]
    Done --> Final["Replace live output with saved message and actions"]
```

### 4.2 Steps from click to persisted output

1. **Compose:** `Composer` trims text, blocks empty/disabled/busy sends, handles Enter versus Shift+Enter, and clears/restores a failed draft when appropriate. A Stop control replaces Send while streaming.
2. **Resolve the target:** `ChatContext.sendMessage` uses the URL conversation ID or calls `createConversation`. It snapshots ready attachment IDs. For ordinary chat that list is empty.
3. **Optimistic UI:** `runStream` adds a temporary user message, creates an AbortController, resets streaming text, and marks the UI busy.
4. **HTTP request:** the helper posts `{ message, documentIds: [] }` to `/api/v1/conversations/:id/messages/stream` using Fetch and `credentials: "include"`.
5. **Server gates:** router-wide authentication, Mongo ID/message validation, owned conversation lookup, and attachment resolution run before SSE headers. Messages are trimmed non-empty strings with an 8000-character limit on this API.
6. **Open SSE:** the controller sets `text/event-stream; charset=utf-8`, `no-cache, no-transform`, keep-alive, and `X-Accel-Buffering: no`, then flushes headers where supported.
7. **Prepare storage/context:** it loads recent history and saves the user message. A title task starts in parallel. The `meta` event returns the real user-message ID and conversation data, replacing the optimistic message.
8. **Prepare memory:** `prepareMemoryTurn` attempts deterministic fact extraction/storage and relevance selection. A separate `memory` event exposes only safe status/count/warnings. Memory failure does not block normal generation.
9. **Generate:** the existing Gemini SDK receives system instructions, converted history, and the current question. There is no second chat model or separate memory generation call.
10. **Transport chunks:** for each SDK text chunk, the backend appends to `fullText` and writes `data: {"type":"delta","text":"..."}` followed by a blank line. HTTP byte boundaries need not coincide with event or word boundaries.
11. **Parse and render:** `api.js` reads bytes, uses streaming TextDecoder, buffers incomplete frames, splits on blank lines, and parses JSON. `runStream` accumulates `assistantText`; React state drives `MessageList` and `MarkdownContent` while `TypingIndicator` is shown. Auto-scroll follows only when the user is near the bottom.
12. **Persist completion:** the controller creates the final assistant Message, awaits the title, updates conversation metadata, and sends `done` with the serialized saved message and conversation.
13. **Finalize UI:** the client appends that persisted message, clears temporary streaming text, updates the sidebar, and releases the busy state when Fetch finishes. Copy, source display, regenerate, and delete controls belong to the saved message UI.

```mermaid
sequenceDiagram
    participant F as React ChatContext
    participant E as Conversation controller
    participant D as MongoDB
    participant M as Memory service
    participant G as Gemini generation
    F->>E: POST messages/stream with cookie
    E->>D: Authorize conversation and read recent messages
    E->>D: Save current user message
    E-->>F: SSE meta with persisted user ID
    E->>M: Prepare memory for authenticated user
    M->>D: Read profile and conditionally merge explicit facts
    M-->>E: Relevant memory and safe save status
    E-->>F: SSE memory status
    E->>G: System instructions, memory, history, current message
    loop Each SDK text chunk
        G-->>E: Generated text chunk
        E-->>F: SSE delta
        F->>F: Append text and render Markdown
    end
    E->>D: Save assistant message and update preview/title
    E-->>F: SSE done with saved assistant message
    E-->>F: End HTTP response
    F->>F: Clear live output and refresh conversation list
```

Sources: [Composer.jsx](B:/AI_BUDDY/frontend/src/components/chat/Composer.jsx): `submit`; [ChatContext.jsx](B:/AI_BUDDY/frontend/src/context/ChatContext.jsx): `runStream`; [api.js](B:/AI_BUDDY/frontend/src/helpers/api.js): `streamConversationMessage`; [conversation.controller.js](B:/AI_BUDDY/backend/src/controllers/conversation.controller.js): `streamConversationMessage`; [MessageList.jsx](B:/AI_BUDDY/frontend/src/components/chat/MessageList.jsx), [MarkdownContent.jsx](B:/AI_BUDDY/frontend/src/components/chat/MarkdownContent.jsx).

### 4.3 Stop, failures, history, and regeneration

- **Stop/disconnect:** the browser aborts its Fetch. The server's response `close` listener aborts the upstream signal. Existing non-empty text is saved as `stopped`. The client can temporarily render a local stopped answer, then attempts a delayed history resync for real IDs. Provider cancellation effectiveness is not established by source inspection.
- **Provider failure:** after SSE opens, errors arrive as `error` events rather than a new HTTP status. Non-empty partial answers are stored as `error`; when no answer exists and the failure was not cancellation, the user turn is marked `failed`. A cancelled turn with no answer is not marked failed by that branch.
- **Pre-stream failure:** validation, missing ownership, or invalid attachment context can still return a regular error response before streaming begins.
- **Persistence limits:** user, assistant, and conversation updates are separate writes, not one transaction. A process/database failure between writes can leave a saved user turn without its final answer or stale preview metadata. The outer stream-error branch does not repair every such case.
- **History loading:** UI page sizes are 30 conversations and 20 messages. Older message loading uses a `before` ObjectId cursor; initial/other reads can use `skip`. History sent to Gemini is separately bounded by `GEMINI_HISTORY_MESSAGES`, not the UI's loaded message count.
- **Regenerate:** the browser calls the REST regeneration endpoint with the preceding user message's ID. The server verifies ownership/role, restores that turn's document selection, deletes later messages, reads history before the target, reads memory with `extract: false`, and produces a new non-streaming answer. If generation fails, the removed later messages are not restored.
- **SSE edge case:** the server calls `write("[DONE]")`, which JSON-encodes the string, while the helper's special sentinel branch checks the raw payload `[DONE]`. The primary `done` event and end-of-stream still drive normal completion; do not assume the helper's optional `stream-end` notification always fires.
- **Unmount scope:** attachment requests/polling have effect cleanup. The main ChatProvider's active generation Fetch has a Stop action but no dedicated provider-unmount abort effect in the inspected code; do not assume every route transition cancels generation.

Sources: the controller/context/helper above; [conversation.service.js](B:/AI_BUDDY/backend/src/services/conversation.service.js): `listMessages`, `getRecentMessages`, `deleteMessagesAfter`, `markMessageStatus`.

## 5. RAG Architecture

RAG means retrieving relevant evidence before generation. AI-Buddy implements **two different workloads**:

1. **Ingestion, on upload:** validate and retain a PDF, extract page text, build chunks, embed those chunks, and index them in Qdrant. No chat answer is generated by uploading alone.
2. **Question processing, on each attached-document turn:** validate selected documents, embed the question, query their chunks, combine bounded evidence and eligible personal memories, ask Gemini for structured statements, and validate their source IDs before display.

The UI does not require a RAG checkbox. `resolveConversationAttachments` decides the mode inside the existing conversation service:

| Request/context | Result |
|---|---|
| Explicit non-empty `documentIds` | Those IDs activate RAG, even without `rag: true`; all must be available and owned. |
| Explicit `documentIds: []` | Ordinary chat and explicit clearing of persisted attachment context. |
| No IDs, no explicit override | Use the conversation's persisted attachment IDs. |
| `rag: false` without IDs | Ordinary chat; persist an empty attachment set. |
| `rag: true` with no explicit IDs and no inherited IDs | Backend compatibility behavior: resolve up to 100 newest ready documents belonging to this user. The current composer normally sends explicit IDs instead. |

Explicit IDs take precedence over the flag. This is an attachment-aware extension of the same message APIs, model service, authentication, and storage architecture.

`usePdfAttachments.addFiles` replaces inherited context when a new unsent attachment set starts, then accumulates further PDFs in that set. After the server accepts a turn, references returned in `meta` become the conversation's inherited context. Removing a chip affects the selected question context; it does not delete the stored PDF. Uploading without sending a question does not itself persist that attachment association on a Conversation.

Sources: [conversation.service.js](B:/AI_BUDDY/backend/src/services/conversation.service.js): `resolveConversationAttachments`, `getConversationForUser`; [usePdfAttachments.js](B:/AI_BUDDY/frontend/src/context/usePdfAttachments.js): `addFiles`, `acceptConversation`, `remove`, `moveDraft`.

## 6. PDF Ingestion Pipeline

### 6.1 Ingestion flow diagram

```mermaid
flowchart TD
    Pick["Composer plus menu selects PDFs"] --> Queue["Browser queues uploads one at a time"]
    Queue --> Post["Credentialed multipart POST documents/upload"]
    Post --> AuthPDF["JWT authentication before upload middleware"]
    AuthPDF --> ValidatePDF["Check extension, MIME, multipart limits and size"]
    ValidatePDF --> File["Save random server filename in private PDF directory"]
    File --> Hash["Read signature and compute SHA-256 of bytes"]
    Hash --> Find["Find owned content hash or explicit retry record"]
    Find --> Preflight["Inspect existing Qdrant collection"]
    Preflight --> Duplicate{"Existing ready or in-flight record?"}
    Duplicate -->|Yes| Reuse["Remove incoming duplicate file and reuse metadata"]
    Duplicate -->|No| Reserve["Reserve one processing slot for this user"]
    Reserve --> Metadata["Create or reclaim uploaded metadata record"]
    Metadata --> Accepted["Return 202 with document ID and status"]
    Metadata --> Schedule["setImmediate schedules in-process processing"]
    Schedule --> Processing["Claim processing status and deadline"]
    Processing --> Worker["PDF.js worker extracts numbered page text"]
    Worker --> Chunks["Page-local chunks with overlap and indexes"]
    Chunks --> IndexSetup["Recheck collection and ensure owner/document indexes"]
    IndexSetup --> Batch["Embed two chunks per request"]
    Batch --> Upsert["Upsert stable point IDs and metadata payloads"]
    Upsert --> More{"More chunks?"}
    More -->|Yes| Batch
    More -->|No| Complete["Mark ready after all expected chunks succeed"]
    Worker -->|Extraction failure| Failed["Mark failed with safe processing error"]
    Batch -->|Embedding failure| Cleanup["Delete partial points where possible"]
    Upsert -->|Indexing failure| Cleanup
    Cleanup --> Failed
    Accepted --> Poll["Poll exact document IDs every five seconds while pending"]
    Reuse --> Poll
    Poll --> Chip["Show Ready or Failed and stop pending polls"]
    Complete --> Chip
    Failed --> Chip
```

### 6.2 File picker, progress, and validation

- `Composer` uses a hidden multiple file input accepting `.pdf,application/pdf`, opened through `+ → Upload PDF`. Each actual HTTP request contains one `file` part.
- The hook accepts PDF extensions and compatible/empty browser MIME values, caps the active unsent set at ten files, shows queued/uploading/progress/backend states, and prevents PDF question submission until IDs and Ready statuses are confirmed.
- Upload percentage measures bytes sent, not extraction/indexing. Reaching 100% can legitimately be followed by Processing or Failed.
- The hook queues uploads because the backend permits only one active ingestion per user. It also watches exact selected document IDs, avoiding reliance on a paginated list's contents for readiness.
- `documentRoutes.use(verifyToken)` runs before Multer. The backend requires `.pdf` and exactly `application/pdf`, limits file size, one file, no ordinary multipart fields, and one total part. The controller separately requires the first five bytes `%PDF-`.
- MIME/extension/signature checks reject obvious wrong inputs; PDF.js parsing is still required to identify malformed/encrypted/unsupported content. No antivirus/sandbox service is integrated.

Sources: [Composer.jsx](B:/AI_BUDDY/frontend/src/components/chat/Composer.jsx), [document-attachments.js](B:/AI_BUDDY/frontend/src/helpers/document-attachments.js): `attachmentReadiness`; [usePdfAttachments.js](B:/AI_BUDDY/frontend/src/context/usePdfAttachments.js); [pdf-upload.middleware.js](B:/AI_BUDDY/backend/src/middleware/pdf-upload.middleware.js): `uploadPdf`; [document.route.js](B:/AI_BUDDY/backend/src/routes/document.route.js).

### 6.3 Local storage, hashing, reuse, and retries

`PDF_DIRECTORY` resolves to `backend/uploads/pdfs/` relative to the backend module, not the launch directory. Multer creates it and uses `crypto.randomUUID() + ".pdf"` as the physical filename. `pdfPath` accepts only the generated UUID-shaped basename. The original filename is separately stripped of path components/control characters and capped at 255 characters.

**These original files are retained private storage, not automatically expiring temporary files.** There is no Express static mount or download/view route for them. MongoDB stores a generated filename, not PDF bytes or an absolute filesystem path; `publicDocument` omits private storage fields. `backend/.gitignore` excludes uploads. Local storage needs a persistent volume or an eventual object-storage design in production; an ephemeral instance can lose PDFs across redeployments.

`uploadDocument` hashes the entire incoming file with SHA-256 and looks up `(authenticated userId, contentHash)`. A unique partial index enforces this pair for documents that have a string hash. Ready duplicates reuse their metadata and Qdrant points; pending duplicates reuse their in-progress record. Their newly received duplicate local file is removed. The request still performs file transfer/read/hash, Mongo lookup/index initialization, and Qdrant preflight before reuse. Thus an already-indexed duplicate is not an offline path if Qdrant is unavailable.

A failed same-content record can be reclaimed. Explicit retries send `retryDocumentId` in the query string and must belong to the owner and match the original bytes. The backend claims the failed record, resets counts/errors/deadline, clears its old points, and reprocesses it. It can use the new incoming physical file if the old file is missing. A unique-index race is handled by re-reading the existing owned record. Different users remain isolated and can incur separate embeddings for identical bytes. Re-exporting a PDF may change its byte hash even when it looks the same.

Sources: [upload.config.js](B:/AI_BUDDY/backend/src/config/upload.config.js): `PDF_DIRECTORY`, `pdfPath`; [document.controller.js](B:/AI_BUDDY/backend/src/controllers/document.controller.js): `uploadDocument`; [document.model.js](B:/AI_BUDDY/backend/src/models/document.model.js).

### 6.4 Processing lifecycle and text extraction

`reserveProcessing` maintains an in-memory Set: one processing job per user and at most two users/jobs per server process. `setImmediate` starts work after scheduling; it is not an external job queue. New processing metadata has a 20-minute reservation deadline. The worker's overall processing AbortController fires after 15 minutes; the PDF extraction wrapper has a separate 60-second timeout.

`processDocument` conditionally claims `uploaded → processing`, then `extractPdf` starts `pdf-extraction.worker.js` with a 256 MiB old-generation heap limit. The worker dynamically imports `pdfjs-dist/legacy/build/pdf.mjs`, reads the local file as bytes, opens it, and iterates pages from 1 through `numPages`. `getTextContent` string items become text; `hasEOL` contributes line breaks. Page cleanup and PDF task destruction release resources. Worker diagnostics are consumed rather than forwarded to avoid leaking document contents into logs.

Limits are 500 pages, 2,000,000 extracted text characters, and later 500 chunks. Fewer than 20 letters/numbers over the whole document is treated as no meaningful extractable text. The useful error mentions scanned/image-only PDFs and missing OCR. This is a text-availability heuristic, not a sophisticated scanned-page classifier. Some short text PDFs can also fail it. Empty pages retain their extraction position but produce no chunks.

Only all-success processing updates `processing → ready`; exceptions record `failed` and a concise error, capped at 500 characters. `expireInterruptedDocuments` marks expired uploaded/processing jobs failed on later owner-scoped upload/list/status/delete activity. It does not resume jobs, generate embeddings, or run a periodic recovery worker on startup. A server restart loses the in-memory reservation/queue.

Sources: [document-processing.service.js](B:/AI_BUDDY/backend/src/services/document-processing.service.js): `reserveProcessing`, `processDocument`, `expireInterruptedDocuments`; [pdf.service.js](B:/AI_BUDDY/backend/src/services/pdf.service.js): `extractPdf`; [pdf-extraction.worker.js](B:/AI_BUDDY/backend/src/services/pdf-extraction.worker.js).

### 6.5 Exact chunking strategy

`chunkPages` uses **characters as an approximation**, not a tokenizer:

1. Process each page separately; normalize horizontal whitespace but retain line breaks.
2. Take a window of at most 2800 characters. For a non-final window, look for the last newline or sentence punctuation boundary in the portion after character 2000. Otherwise use a suitable word boundary.
3. Trim the window; omit empty text and exact duplicate normalized chunk text using one document-wide Set.
4. Emit `{ text, pageStart, pageEnd, chunkIndex }`, with zero-based consecutive chunk indexes and `pageStart === pageEnd` for current ingestion.
5. Start the next window approximately 400 characters before the end, adjusted to a word boundary. Reset the window at each new page.

At the documented rough four-characters-per-token approximation, a usual full chunk is about 500–700 tokens with about 100 tokens of overlap; final/short page chunks can be much smaller. This is not an exact token guarantee. Current chunks never span multiple pages, although the metadata schema supports a page range. Repeated identical chunk text on later pages is deduplicated, so its retained citation identifies the first retained occurrence, not every occurrence.

Source: [chunking.service.js](B:/AI_BUDDY/backend/src/services/chunking.service.js): `chunkPages`.

### 6.6 Embedding and Qdrant indexing

`generateEmbeddings` accepts 1–8 non-empty texts, but ingestion passes batches of **two**. A lazy GoogleGenAI client uses only `Gemini_API_KEY_for_embedding`. `embedContent` requests `gemini-embedding-001` with `outputDimensionality: 768`, an abort signal, 60-second HTTP timeout, and retry attempts set to one. The function validates count, 768 finite values per vector, and nonzero finite magnitude, then L2-normalizes each vector. `generateEmbedding` wraps the same function for one question.

`getQdrantClient` lazily creates one REST client, validates HTTP(S)/no embedded credentials, rejects obvious dashboard hostnames, uses the URL's port/path correctly, and sets a 10-second timeout with compatibility checking disabled. `inspectQdrantCollection` requires one unnamed, non-multivector, 768-dimensional `Cosine` vector configuration. Named-vector/multivector configurations are not supported by this implementation.

The collection is initialized only by the explicit `qdrant:init` script: create if absent, inspect if present, and reject incompatibility without deleting/recreating existing data. Upload/processing require it to exist. `ensureDocumentPayloadIndexes` additionally creates missing keyword indexes for `userId` and `documentId`; incompatible types are rejected.

Each upsert point contains:

```text
id: deterministic UUID-shaped ID derived from SHA-256(documentId + ':' + chunkIndex)
vector: normalized array of 768 numbers
payload:
  userId: authenticated owner converted to string
  documentId: Mongo document ID converted to string
  originalFilename: sanitized metadata filename
  text: chunk text
  pageStart, pageEnd: one-based source page numbers
  chunkIndex: zero-based chunk index
```

The ID helper sets UUID version/variant bits but is a custom SHA-256-derived scheme, not a standard SHA-1 UUIDv5 generator. Reusing the same document/chunk ID replaces the same point on upsert. Upserts use `wait: true` and require `completed` before proceeding. A document becomes Ready only after every expected batch succeeds. If indexing has started and a later stage fails, cleanup deletes that owner's document points; cleanup failure is recorded and the document remains Failed.

Sources: [embedding.service.js](B:/AI_BUDDY/backend/src/services/embedding.service.js): `generateEmbeddings`, `generateEmbedding`; [qdrant.config.js](B:/AI_BUDDY/backend/src/config/qdrant.config.js): `getQdrantClient`; [qdrant.service.js](B:/AI_BUDDY/backend/src/services/qdrant.service.js): `inspectQdrantCollection`, `initializeQdrantCollection`; [document-index.service.js](B:/AI_BUDDY/backend/src/services/document-index.service.js): `ensureDocumentPayloadIndexes`, `indexChunks`.

### 6.7 Status polling, removal, and actual deletion

Pending records are polled approximately every five seconds by exact ID. Ready/Failed records leave the pending poll set; a status request failure becomes `status-error`, blocking submission until refresh/retry/removal. Timers and attachment requests are aborted on effect cleanup/unmount. After a full reload, inherited IDs are read from the conversation and their statuses are checked again. Draft File objects are not durable browser storage.

`+ → Manage PDFs` is a dialog with refresh/delete; it is not a separate document page or viewer. Deletion is allowed for Ready/Failed records, not active processing. `deleteDocument` claims a two-minute deletion deadline, then:

1. Deletes Qdrant points with both owner and document payload filters; an absent collection means no points can remain there.
2. Removes the original local file; missing files are tolerated by `removePdf`.
3. Deletes owned MongoDB metadata only after those steps succeed.

On partial failure, it keeps metadata, marks Failed with a deletion-incomplete message, and clears the deletion lock where that update succeeds, allowing retry. These stores do not share a transaction. Deleting a PDF does not automatically erase source labels already saved on assistant messages or cascade away conversation attachment references; subsequent questions recheck availability.

Sources: [usePdfAttachments.js](B:/AI_BUDDY/frontend/src/context/usePdfAttachments.js), [DocumentManager.jsx](B:/AI_BUDDY/frontend/src/components/chat/DocumentManager.jsx), [document.controller.js](B:/AI_BUDDY/backend/src/controllers/document.controller.js): `deleteDocument`; [document-index.service.js](B:/AI_BUDDY/backend/src/services/document-index.service.js): `deleteDocumentPoints`.

## 7. RAG Query Pipeline

### 7.1 Query flow diagram

```mermaid
flowchart TD
    Question["Question and selected or inherited PDF IDs"] --> Gate["Authenticate and authorize owned conversation"]
    Gate --> Select["Resolve owned Ready documents and persist attachment IDs"]
    Select --> Shared["Read history, save user turn, prepare personal memory"]
    Shared --> QEmbed["Generate 768-dimensional question embedding"]
    QEmbed --> Search["Qdrant query with owner and document filters"]
    Search --> Recheck["Recheck readiness and validate returned payloads"]
    Recheck --> Context["Bound PDF text and add S source IDs"]
    Shared --> MemorySources["Add eligible confirmed M memory sources"]
    MemorySources --> Context
    Context --> Any{"Any allowed sources?"}
    Any -->|No| NoContext["Return no relevant information without generation"]
    Any -->|Yes| Generate["Gemini JSON generation with grounding rules"]
    Generate --> Parse["Parse JSON and inspect insufficient flag"]
    Parse --> Enough{"Source-supported answer claimed?"}
    Enough -->|No| Insufficient["Return documents do not provide enough information"]
    Enough -->|Yes| Validate["Validate statements and allowed source IDs"]
    Validate -->|Invalid| Error["Return explicit document-answering failure"]
    Validate -->|Valid| Cite["Server appends source references and filters metadata"]
    Cite --> Delta["One answer delta on existing SSE endpoint"]
    NoContext --> Delta
    Insufficient --> Delta
    Delta --> Store["Persist assistant content and sources in MongoDB"]
    Store --> UI["Final message renders source filenames and pages"]
```

### 7.2 Retrieval and owner filtering

`retrieveChunks` accepts a non-empty question of at most 8000 characters. `resolveRagDocuments` accepts at most 100 valid Mongo-style document IDs, deduplicates/lowercases them, and queries MongoDB for this authenticated user's Ready documents that are not being deleted. Explicit selection must fully resolve; a missing, other-user, or non-ready ID causes an error, not silent broadening to other documents. A fallback selection is sorted newest first and limited to 100.

After resolving documents, the service generates one question embedding through the ingestion embedding service. It calls `client.query` with `limit: RAG_TOP_K`, `with_vector: false`, a payload allowlist, and these simultaneous conditions:

```json
{
  "must": [
    { "key": "userId", "match": { "value": "<authenticated-user-id>" } },
    { "key": "documentId", "match": { "any": ["<authorized-document-id>"] } }
  ]
}
```

Both fields are indexed/stored as keyword strings during ingestion. After Qdrant returns, MongoDB availability is checked again. Each point is accepted only if its payload owner/document match, text is non-empty, the chunk index falls within the document's chunk count, and its integer page range is within `pageCount`. The result adds the original filename from Mongo metadata, a string `chunkReference` from the point ID, and a finite score when available. Text is capped at 3200 characters per returned point.

**No relevance score threshold is configured.** Top-K means nearest permitted candidates, not proof they answer the question. Invalid payloads can reduce the final count below K. No keyword/BM25 hybrid, reranker, document-wide summary retrieval, or query-vector cache is implemented. A Qdrant failure raises an explicit document-answering error; it does not fall back to ordinary chat.

Source: [retrieval.service.js](B:/AI_BUDDY/backend/src/services/retrieval.service.js): `resolveRagDocuments`, `retrieveChunks`.

### 7.3 Bounded context and generation

`answerRagQuestion` builds `S1`, `S2`, and later source IDs from retrieved passages, with at most **12000 PDF text characters** total. It stops adding passages if less than 200 characters remain. It also adds `M1`, `M2`, etc. for relevant confirmed personal memories, excluding preference entries as factual source evidence. Preference context can still influence style through `memoryPrompt`.

The RAG history is capped again: last ten messages, no more than 2000 characters each and 8000 characters total, keeping more recent content first when allocating the budget, then restoring chronological order. These are character budgets; they do not include all JSON/instruction overhead and are not tokenizer-accurate model context accounting.

The **actual current user turn sent to Gemini** is JSON containing the question and each source's `sourceId`, `sourceType`, and `text`. Additional RAG system instructions tell it to:

- Treat PDF text, filenames, the question, and history as untrusted data rather than instructions.
- Ground factual statements in the supplied sources, with source IDs on every statement.
- Use S sources for what a PDF says; never present an M memory as PDF evidence.
- Use history only to interpret follow-ups, not as independent evidence.
- Return JSON with `insufficient` and `statements`, rather than invent missing facts or write its own page/filename references.

The existing `generateReply` uses the usual persona and memory rules plus these RAG instructions, requesting `application/json`. Entire PDFs and all chunks are not placed into the chat request.

If there are no S or eligible M sources, generation is skipped and a fixed no-relevant-information reply is returned. If there are M sources but no S passages, generation can still occur, with rules limiting PDF claims to S evidence. If Gemini returns `insufficient: true`, the server returns its fixed insufficient-documents reply with no citations.

Source: [rag.service.js](B:/AI_BUDDY/backend/src/services/rag.service.js): `answerRagQuestion`, `RAG_INSTRUCTIONS`; [gemini.service.js](B:/AI_BUDDY/backend/src/services/gemini.service.js): `generateReply`.

### 7.4 Citation validation and final output

For a supported response, the server requires `insufficient: false`, 1–12 statements, non-empty statement text no longer than 4000 characters each, and non-empty `sourceIds` arrays referring only to allowed S/M IDs. It rejects statement text containing bracketed citations, S/M labels, page-number patterns, PDF filenames, or URLs. This prevents the model from supplying its own fabricated citation formatting/page references, although the broad pattern can also reject an otherwise useful statement mentioning such text.

The server deduplicates a statement's IDs, appends validated references such as `[S1]`, and returns only metadata for sources actually cited. It strips source passage text from the public metadata. Source metadata includes document ID, original filename, page start/end, chunk index, point reference, and optional score. Memory sources instead carry source type, memory ID, category, and key.

`streamConversationMessage` buffers the RAG answer until all validation completes, then sends **one** `delta` with the full answer. The same assistant-message persistence and `done` event used by ordinary chat follow. `MessageBubble` displays a Sources block underneath: filename, page/range, and one-based display chunk number; M sources are labeled saved memory. There is no clickable PDF viewer/download link in the current source UI.

Validation checks source identity and response structure. It does not compare the meaning of each statement against a passage or guarantee factual accuracy. Retrieved PDF text must still be reviewed for important claims.

Sources: [rag.service.js](B:/AI_BUDDY/backend/src/services/rag.service.js): `answerRagQuestion`; [conversation.controller.js](B:/AI_BUDDY/backend/src/controllers/conversation.controller.js): `streamConversationMessage`; [MessageBubble.jsx](B:/AI_BUDDY/frontend/src/components/chat/MessageBubble.jsx).

### 7.5 Persistent memory alongside either chat mode

`prepareMemoryTurn` runs for new messages on ordinary, RAG, and legacy chat paths. It receives the **typed user message**, not PDF text or the assistant response. Regeneration sets `extract: false`. A new conversation retrieves the same owner profile regardless of PDF state.

Extraction recognizes explicit patterns: name/nickname, college/degree/year, skills, named projects and their technologies, learning/goals, and selected preferences. For example, `bro my name is ayush you can call me ayu as nickname` becomes separate Name and Nickname facts. Quoted/hypothetical/opt-out/uncertain text and messages matching sensitive-content or instruction-override patterns are excluded; these are deterministic heuristics, not universal secret detection or language understanding.

`mergeMemoryFacts` normalizes values, prevents duplicates, applies explicit corrections, and keeps uncertain changes as conflicts with up to three alternatives. Nicknames/preferences/current topics have explicit replacement policies. The model is told to ask for confirmation on conflicts. The profile holds at most 128 entries; extraction accepts at most 16 candidates per message. Current learning/goals expire after 30 days, recently learned topics after 90 days; stable facts have no expiry. Expired entries are excluded from use and pruned during merge/list operations, not by deleting the whole profile with a Mongo TTL index.

`selectRelevantMemories` uses category triggers, overlapping words, preferences, and recency. It takes at most 12 items within a 4500-character serialized budget. This is local deterministic ranking, not Qdrant or another embedding/model call. `memoryPrompt` tells Gemini to use available relevant facts, avoid invented personal details, distinguish user identity from the creator, and acknowledge uncertainty/availability honestly.

Updates use a profile `revision` predicate with up to two attempts. `manualChangeAt` fences out turns accepted before a manual delete/clear/pause so they cannot restore deleted facts. Memory operations use `timeoutMS: 1200` and `maxTimeMS: 1000`; the schema disables query buffering. Chat preparation fails open with safe warnings, while management APIs return errors on unavailable storage. These are per-operation timeouts, not a single total turn timeout.

`MemoryDialog`, opened from the chat header, supports view/refresh, pause/resume, delete-entry, and confirmed clear-all. Corrections occur through normal conversation, not a dedicated edit endpoint. Deleting saved memory does not remove its original chat message; that same conversation's history may still contain the fact.

Sources: [memory-extraction.service.js](B:/AI_BUDDY/backend/src/services/memory-extraction.service.js): `extractMemories`; [memory-policy.service.js](B:/AI_BUDDY/backend/src/services/memory-policy.service.js): `mergeMemoryFacts`, `selectRelevantMemories`, `memoryPrompt`; [memory.service.js](B:/AI_BUDDY/backend/src/services/memory.service.js): `prepareMemoryTurn`, management functions; [MemoryDialog.jsx](B:/AI_BUDDY/frontend/src/components/chat/MemoryDialog.jsx).

## 8. API Routes and Data Flow

All routes below are relative to **`/api/v1`**. IDs are validated where shown in their routers/controllers. All conversation, document, and memory routes require `verifyToken`; account signup/login are public. Errors may occur before the normal success statuses shown here.

### 8.1 Account routes

Source: [user.route.js](B:/AI_BUDDY/backend/src/routes/user.route.js), [user.controller.js](B:/AI_BUDDY/backend/src/controllers/user.controller.js).

| Method and route | Input/authentication | Responsibility and success response |
|---|---|---|
| `POST /user/signup` | Public JSON `{ name, email, password }` | Validate, hash/store account, issue cookie; 201 plus public name/email/message. |
| `POST /user/login` | Public JSON `{ email, password }` | Compare password, issue cookie; 200 plus public name/email/message. |
| `GET /user/auth-status` | Signed cookie/JWT | Look up current account; 200 `{ message: "OK", name, email }`. |
| `GET /user/logout` | Signed cookie/JWT | Clear matching cookie; 200 OK. This mutation uses GET in current code. |
| `GET /user` | Signed cookie/JWT | Despite `getAllUsers` naming, return only the caller's public account in a `data` array. |

### 8.2 Conversation/message routes

Source: [conversation.route.js](B:/AI_BUDDY/backend/src/routes/conversation.route.js), [conversation.controller.js](B:/AI_BUDDY/backend/src/controllers/conversation.controller.js).

| Method and route | Input | Responsibility and success response |
|---|---|---|
| `GET /conversations` | `limit`, `skip` | Owner list; 200 `{ message, conversations, total, hasMore }`. Limit 1–100; service default 30. |
| `POST /conversations` | Optional `{ title }` | Create owner thread; 201 `{ message, conversation }`. Defaults to New chat. |
| `GET /conversations/:id` | Mongo conversation ID | Owned serialized conversation; 200. Older attachment context may be recovered from the last RAG user turn. |
| `PATCH /conversations/:id` | `{ title }`, 1–120 characters | Owned rename; 200 `{ message, conversation }`. |
| `DELETE /conversations/:id` | Conversation ID | Delete owned thread and messages; 200. Does not delete PDFs or saved memory. |
| `DELETE /conversations` | None | Delete all owned conversations/messages; 200 `{ message, deleted }`. |
| `GET /conversations/:id/messages` | `limit`, `skip`, optional `before` | Chronological message page; 200 `{ message, messages, hasMore }`; service default 20. |
| `POST /conversations/:id/messages` | `{ message, documentIds?, rag? }` | Existing non-streaming ordinary/RAG API; 201 with user/assistant messages, conversation, memory status. |
| `POST /conversations/:id/messages/stream` | Same JSON fields | Current UI send path; HTTP SSE with `meta`, `memory`, `delta`, `done`, `stopped`/`error` events where applicable. |
| `POST /conversations/:id/messages/:messageId/regenerate` | Target owned user-message ID | Remove subsequent turns, regenerate using original mode/context; 201 with assistant, conversation, memory status. |
| `DELETE /conversations/:id/messages/:messageId` | Owned message ID | Delete single message and recompute preview; 200 `{ message, conversation }`. |

`message` must be a trimmed non-empty string no longer than 8000 characters. `rag`, if supplied, must be boolean; `documentIds` allows up to 100 Mongo IDs. The current UI attaches at most ten PDFs. The create-conversation route does not run `titleValidator`; the service assumes an optional title is string-like and trims/caps it. This differs from the validated rename route.

### 8.3 Document routes

Source: [document.route.js](B:/AI_BUDDY/backend/src/routes/document.route.js), [document.controller.js](B:/AI_BUDDY/backend/src/controllers/document.controller.js).

| Method and route | Input | Responsibility and success response |
|---|---|---|
| `POST /documents/upload` | One multipart `file`; optional query `retryDocumentId` | Store/reuse/retry ingestion. New/in-flight work: 202 `{ document }`; reused Ready document: 200. Reuse branches include `reused: true`. |
| `GET /documents` | Optional `limit`, `skip` | Owned metadata list `{ documents }`; default 30, clamped to 1–100. UI manager requests 100 and has no pagination control. |
| `GET /documents/:id/status` | Owned document ID | Expire stale job if applicable, return `{ document }`. |
| `DELETE /documents/:id` | Owned Ready/Failed ID | Qdrant → local-file → Mongo cleanup; 200 `{ message, id }` only after required steps succeed. |

There is no standalone public vector-search, document-question, PDF download, or file-serving endpoint. RAG questions go through the conversation/message routes.

### 8.4 Memory routes

Source: [memory.route.js](B:/AI_BUDDY/backend/src/routes/memory.route.js), [memory.controller.js](B:/AI_BUDDY/backend/src/controllers/memory.controller.js).

| Method and route | Input | Responsibility and success response |
|---|---|---|
| `GET /memories` | Authenticated identity | 200 `{ message, enabled, memories }` for this user, with active entries/conflicts. |
| `PATCH /memories/settings` | `{ enabled: boolean }` | Pause/resume save and use; retain entries; 200 `{ message, enabled }`. |
| `DELETE /memories/:id` | Entry ObjectId | Remove only caller's matching embedded entry; 200 message. |
| `DELETE /memories` | None | Clear caller's entries, retain profile/settings; 200 message. |

### 8.5 Retained legacy chat routes

Source: [chat.route.js](B:/AI_BUDDY/backend/src/routes/chat.route.js), [chat-controller.js](B:/AI_BUDDY/backend/src/controllers/chat-controller.js).

| Method and route | Actual behavior |
|---|---|
| `POST /chat/new` | Authenticated `{ message }`; resolve/create one `isLegacy` conversation per user, prepare memory, generate a non-streaming ordinary reply, save both turns, return last ten legacy-shaped chats and memory status. |
| `GET /chat/all-chats` | Authenticated `limit`/`skip`, default ten and maximum 100; backward pagination over that legacy conversation; `{ message, chats, hasMore }`. |
| `DELETE /chat/delete` | Authenticated; clear that legacy conversation's messages and recompute metadata; OK response. |

These three routes remain public compatibility contracts, although the current React workspace no longer calls them. They reuse the active conversation/message collections. Their validation/error handling differs from the newer routes; they do not implement PDF RAG.

### 8.6 What crosses each boundary

| Boundary | Data sent | Data deliberately not sent through that path |
|---|---|---|
| Browser → Express | Form values, cookies, message text, selected document IDs, PDF multipart bytes, management actions | Frontend user IDs are not accepted as ownership authority. |
| Express → MongoDB | Hashes/accounts, owned metadata, messages, attachment references, memory facts | PDF binary and Qdrant vectors are not stored in the document model. |
| Express → private disk | Original PDF under generated basename | No client-controlled physical path, no public URL. |
| Express → embedding Gemini | Chunk text on ingestion; question text on RAG requests | No embedding request for an ordinary un-attached chat. |
| Express → Qdrant | Chunk vectors/text/metadata, query vector, mandatory payload filters | No cross-user broad query from this retrieval implementation. |
| Express → generation Gemini | Persona/rules, selected memory/history, question; selected passages for RAG | No original PDF binary or whole corpus dump. |
| Express → browser | Safe auth identity, serialized records, SSE text/status, cited source metadata | No JWT in JSON, provider keys, storage filenames/absolute PDF paths, or source text in the returned RAG metadata. |

The final row describes intentional serializers. Section 12 notes generic/legacy error paths that are not uniformly sanitized.

## 9. Database Models and Storage

### 9.1 MongoDB schemas and relationships

Mongo `_id` values are ObjectIds. API serializers generally expose them as `id` strings. Qdrant owner/document payload fields are also strings, with explicit selection IDs lowercased before Mongo lookup. Mongoose `ref` fields describe relationships; they are not database-enforced foreign keys or automatic cascades.

```mermaid
flowchart LR
    UserModel["User"] --> ConvModel["Conversation userId"]
    UserModel --> MsgModel["Message userId"]
    UserModel --> DocModel["Document userId"]
    UserModel --> ProfileModel["MemoryProfile unique userId"]
    ConvModel --> MsgModel
    ConvModel -->|documentIds| DocModel
    MsgModel -->|documentIds and citation snapshots| DocModel
    ProfileModel --> EntryModel["Embedded memory entries and source references"]
    EntryModel --> ConvModel
    EntryModel --> MsgModel
    DocModel -->|storageFilename| PrivateFile["Private PDF file"]
    DocModel -->|documentId string| Points["Qdrant chunk points"]
```

| Model | Important stored fields | Indexes and notes |
|---|---|---|
| `User` | `name`, unique `email`, `password` hash with `select: false`, legacy `chats[]` containing `id`, `role`, `content` | Email unique index; no timestamps option on this schema. Legacy embedded history is retained for migration compatibility. |
| `Conversation` | `userId`, `title` (default New chat, max 120), `documentIds[]`, `lastMessage` (max 280), `lastMessageAt`, `messageCount`, `isLegacy`, timestamps | Field indexes on owner/time; compound `{ userId: 1, lastMessageAt: -1, _id: -1 }` for sidebar ordering. |
| `Message` | `conversationId`, `userId`, `role` user/assistant, required `content`, `status`, `legacyId`, `rag`, `documentIds[]`, embedded `sources[]`, timestamps | Indexes on conversation/owner; compound `{ conversationId: 1, _id: -1 }` for history. Status is complete/stopped/error/failed. |
| `Document` | `userId`, `originalFilename`, hidden `storageFilename`, hidden `contentHash`, `fileSize`, `mimeType`, `pageCount`, `chunkCount`, `status`, `processingError`, hidden processing/deletion deadlines, timestamps | `{ userId: 1, createdAt: -1 }`; unique partial `{ userId: 1, contentHash: 1 }` for string hashes. Status uploaded/processing/ready/failed. |
| `MemoryProfile` | Unique `userId`, `enabled`, `revision`, `manualChangeAt`, bounded `entries[]`, timestamps | Unique owner; no versionKey; bufferCommands=false. One profile per user rather than one collection document per fact. |

An embedded memory entry has its own `_id`, `category`, `key`, `value` (max 240), status confirmed/conflict, up to three alternatives, source conversation/message ObjectIds, `createdAt`, `updatedAt`, and optional `expiresAt`. Categories are personal, education, skills, projects, preferences, learning, and goals. Keys can be fixed names or a prefix plus a hash of the normalized subject, for example a project key. A profile has at most 128 entries.

Embedded Message sources preserve source ID, document/filename, page range, chunk index/reference, score, source type, and memory-specific metadata. They are citation snapshots, not automatically joined current PDF pages. The current send path stores selected `documentIds` on the conversation and user message; assistant creation passes `rag` and `sources` but normally leaves its own `documentIds` at the schema/default empty array. `serializeMessage` exposes sources and document IDs but not the owner ID.

Sources: [user.model.js](B:/AI_BUDDY/backend/src/models/user.model.js), [conversation.model.js](B:/AI_BUDDY/backend/src/models/conversation.model.js), [message.model.js](B:/AI_BUDDY/backend/src/models/message.model.js), [document.model.js](B:/AI_BUDDY/backend/src/models/document.model.js), [memory.model.js](B:/AI_BUDDY/backend/src/models/memory.model.js).

### 9.2 Storage and lifecycle boundaries

| Store | Lifespan and deletion behavior |
|---|---|
| React state | Optimistic messages, live accumulated output, draft File objects, attachment status cache; not a durable store. |
| Browser cookie | Signed HTTP-only JWT, seven-day expiry; cleared by logout. There is no server-side session table. |
| MongoDB conversations/messages | Survive browser reloads. Conversation deletion explicitly removes messages; no global transaction/cascade is supplied by the schemas. |
| MongoDB personal memory | Cross-conversation until deletion, pause rules, or entry expiry. Clearing a conversation does not clear memory; clearing memory does not clear history. |
| Local PDF directory | Original files retained until explicit document deletion or upload/duplicate cleanup. Filesystem durability is a deployment responsibility. |
| Qdrant collection | Chunk text/vectors persist independently from MongoDB. Document deletion/failure cleanup uses filtered operations; no shared-store atomic transaction. |

The legacy migration script reads `User.chats`, creates a marked conversation and Message records, then clears the old array after insertion. It has a dry-run mode and skips accounts with an existing legacy conversation. That is useful migration tooling, but separate writes mean it is not a crash-safe multi-store transaction or proof that every deployment has completed migration. It was inspected, not executed for this guide.

Source: [migrate-chats.js](B:/AI_BUDDY/backend/scripts/migrate-chats.js).

## 10. Technical Concepts Glossary

Each row explains a term, why AI-Buddy uses it, and the concrete implementation or example. The source references identify where the category appears in this project.

### 10.1 Authentication and security

| Concept | Meaning | Why used here | Actual mechanism/example |
|---|---|---|---|
| Authentication | Establishing the caller's identity. | Conversations and private data need an identified owner. | Email/password login issues a cookie; `verifyToken` verifies its JWT on protected APIs. |
| Authorization/ownership | Checking whether an identified caller may access a resource. | Knowing an ID must not grant access to someone else's resume. | `getConversationForUser` queries both conversation ID and authenticated user ID; retrieval resolves owned documents first. |
| Password hashing | A one-way password representation suitable for comparison, not decryption. | MongoDB need not contain the submitted plaintext password. | `hash(password, 10)` on signup; `compare` on login. Bcrypt creates its salt as part of hashing. |
| JWT | Signed identity claims with an expiration time; not encrypted secret storage. | The server can verify a session without a session database lookup for every request. | Claims contain account ID/email; seven-day expiry; verify is restricted to HS256. |
| Signed HTTP-only cookie | A browser cookie protected from JavaScript reads, with a signature detecting tampering. | Carries the JWT automatically without returning it as JSON/localStorage data. | `auth_token`, signed through cookie-parser's secret; the JWT has its own separate signature. |
| Secure/SameSite attributes | Browser rules limiting cookie transport and cross-site sending. | Support the configured development or HTTPS deployment origins. | Production uses Secure and SameSite=None; other modes use SameSite=Lax. These do not replace a CSRF design. |
| Secret separation | Distinct credentials for distinct services/operations. | Embedding quota/configuration stays separate from generation. | Only the embedding service reads `Gemini_API_KEY_for_embedding`; neither key belongs in Vite code. |

Sources: [user.controller.js](B:/AI_BUDDY/backend/src/controllers/user.controller.js), [token-manager.js](B:/AI_BUDDY/backend/src/utils/token-manager.js), [retrieval.service.js](B:/AI_BUDDY/backend/src/services/retrieval.service.js).

### 10.2 REST APIs and HTTP

| Concept | Meaning | Why used here | Actual mechanism/example |
|---|---|---|---|
| Resource route and HTTP method | A URL identifies a resource; the method identifies an operation. | Separate list/create/update/delete responsibilities. | GET lists conversations, POST creates, PATCH renames, DELETE removes. All API groups are under `/api/v1`. |
| JSON request/response | A structured text representation of values and objects. | Shares messages, metadata, settings, and errors between React and Express. | `{ "message": "Explain closures", "documentIds": [] }` is an ordinary conversation turn. |
| Multipart upload | A request body containing a file part and framing metadata. | PDF bytes cannot be treated as a small JSON message. | FormData contains one `file`; Multer validates/stores it. Axios leaves Content-Type boundary handling to the browser. |
| Status code | A protocol-level result indicator. | Distinguishes invalid data, auth failure, accepted jobs, conflicts, and unavailable services. | 201 creates records; 202 accepts ingestion without claiming readiness; 401 means unauthenticated; 413 means oversized PDF. |
| Credentials and CORS | Cookies identify the user; CORS controls which browser origin can read credentialed responses. | Frontend/backend can run on different configured origins. | Axios `withCredentials`, Fetch `credentials: include`, Express `origin: FRONTEND_URL` and `credentials: true`. |
| Pagination/cursor | Returning a bounded page instead of an entire collection. | Limits UI loading and database work. | Conversation `limit/skip`; older messages use a validated `before` ObjectId. |

Sources: [app.js](B:/AI_BUDDY/backend/src/app.js), [api.js](B:/AI_BUDDY/frontend/src/helpers/api.js), [validators.js](B:/AI_BUDDY/backend/src/utils/validators.js), and the route tables in section 8.

### 10.3 Frontend and React

| Concept | Meaning | Why used here | Actual mechanism/example |
|---|---|---|---|
| Component and props | A UI unit and its supplied data/callbacks. | Keep composer, messages, sidebar, and management dialogs separate. | `Composer` receives `onSend`, `onStop`, busy flags, and the attachment controller. |
| State/controlled input | React-managed values determine rendered UI and field contents. | Form validation, upload statuses, and live answer text must update predictably. | Auth input `value/onChange`; `streamingText` changes on each delta. |
| Context provider | Shared state/actions supplied to a component subtree. | Avoid passing auth/chat actions through every component. | AuthProvider owns identity; ChatProvider owns conversation state. Neither is the backend authorization boundary. |
| Effect and cleanup | Work synchronized with lifecycle/dependency changes, with a cleanup callback. | Fetch context/status and stop obsolete attachment polling. | `usePdfAttachments` clears its timer and aborts its request when watched IDs or lifecycle change. |
| Ref and memoization | A ref holds mutable values without rerender; memoization caches derived calculations. | Hold AbortControllers and reduce repeat derivation. | `abortRef` stores the current stream controller; `useMemo` builds attachment records/context values. This is not persistent memory. |
| Router/protected workspace | URL-based UI selection plus an authentication-aware redirect. | Reload/link the same conversation and avoid showing an unauthorized workspace. | `/chat/:conversationId` selects a thread; actual resource ownership remains server-enforced. |
| Optimistic rendering | Display an anticipated local result before receiving authoritative IDs. | Show the user's message immediately. | A temporary user ID is replaced by the persisted message in SSE `meta`. |
| Theme and Markdown rendering | Shared visual tokens and structured text presentation. | Keep all pages consistent and make answers/code readable. | MUI dark theme feeds public CSS variables; ReactMarkdown/GFM and CodeBlock render answers without a raw-HTML parser plugin. |

Sources: [ChatContext.jsx](B:/AI_BUDDY/frontend/src/context/ChatContext.jsx), [usePdfAttachments.js](B:/AI_BUDDY/frontend/src/context/usePdfAttachments.js), [theme.js](B:/AI_BUDDY/frontend/src/theme.js), [MarkdownContent.jsx](B:/AI_BUDDY/frontend/src/components/chat/MarkdownContent.jsx).

### 10.4 Backend and Express.js

| Concept | Meaning | Why used here | Actual mechanism/example |
|---|---|---|---|
| ES module | A JavaScript module using import/export. | Share services/configuration without duplicating integrations. | Both packages declare `type: module`; server relative imports use `.js`. |
| Middleware/router | Ordered request handling functions and grouped route handlers. | Apply CORS, body parsing, cookies, authentication, and validation before business logic. | Document router runs `verifyToken` before multipart middleware. Error middleware is mounted last. |
| Controller/service separation | HTTP orchestration versus reusable business/data operations. | Keep request/response details out of indexing or memory policies. | Controller selects ordinary/RAG mode; services retrieve chunks or generate replies. |
| Async error propagation | Forwarding rejected operations into the HTTP error layer. | Avoid treating provider/database failures as success. | Express 5 forwards async handler rejection; stream handlers instead emit errors once headers are sent. |
| Worker thread | An isolated JavaScript worker within the Node process environment. | Bound and separate PDF parsing work from ordinary request handling. | `extractPdf` launches a worker with a PDF filename, listens for results, and terminates it after completion/timeout. |
| Lazy singleton | Construct one reusable client on first use. | Importing/startup should not require Qdrant or spend embedding quota. | Qdrant and embedding service clients are created once when their operations first run. |
| In-process scheduled job | Work scheduled to run after the current event-loop turn, without a persistent queue. | Return accepted upload metadata promptly. | `setImmediate(processDocument)` plus an in-memory Set. A restart loses the job. |

Sources: [app.js](B:/AI_BUDDY/backend/src/app.js), [document-processing.service.js](B:/AI_BUDDY/backend/src/services/document-processing.service.js), [pdf.service.js](B:/AI_BUDDY/backend/src/services/pdf.service.js), [qdrant.config.js](B:/AI_BUDDY/backend/src/config/qdrant.config.js).

### 10.5 Database and MongoDB

| Concept | Meaning | Why used here | Actual mechanism/example |
|---|---|---|---|
| Document/schema/model | A stored record, its field constraints, and the interface used to query it. | Structure accounts, threads, messages, uploads, and memory. | Mongoose Document schema defines processing status/counts while original PDF bytes remain on disk. |
| ObjectId/reference | MongoDB identifier and a stored link to another model's identifier. | Associate messages/documents with authenticated accounts. | `Message.conversationId` references Conversation; API serialization converts it to a string. |
| Index/compound index | A database lookup/order structure over one or several fields. | Efficient owner-scoped sidebar/history lookup and uniqueness. | Conversation `{userId,lastMessageAt,_id}` index; message `{conversationId,_id}` index. |
| Unique partial index | Uniqueness enforced only for records matching a condition. | Deduplicate new fingerprinted PDFs without excluding older hash-less records. | `{userId,contentHash}` is unique when contentHash is a string. |
| Embedded subdocument | Structured data stored inside another Mongo record. | A bounded memory profile can be atomically updated as one document. | `MemoryProfile.entries[]` contains facts and conflict alternatives; Message embeds citation metadata. |
| Lean query/serialization | Read a plain object, then explicitly select the public output shape. | Reduce model overhead and avoid returning internal fields. | `.lean()` in history/retrieval; `serializeMessage`/`publicDocument` omit owner/storage internals. |
| Atomic conditional update | One database update succeeds only if its predicate still matches. | Avoid lost concurrent facts or claiming a job twice. | Memory update requires the expected `revision`; processing claim requires `status: uploaded` and a live deadline. |

Sources: [models/](B:/AI_BUDDY/backend/src/models), [conversation.service.js](B:/AI_BUDDY/backend/src/services/conversation.service.js), [memory.service.js](B:/AI_BUDDY/backend/src/services/memory.service.js).

### 10.6 LLMs and Gemini API

| Concept | Meaning | Why used here | Actual mechanism/example |
|---|---|---|---|
| Language model/generation | A model produces text conditioned on supplied input/context. | Answer user questions and explain retrieved passages. | Existing Gemini generation SDK requests `gemini-2.5-flash`. It is not retrained with each uploaded PDF. |
| Token | A model's unit of processed text, not necessarily a word or character. | Provider input/output budgets and quota differ from simple string lengths. | `maxOutputTokens: 2048`; PDF chunk token counts are only estimated from characters. |
| Temperature | A sampling variability setting. | Tune ordinary answer generation without changing the route architecture. | Temperature 0.6 for replies, 0.3 for optional AI titles; neither guarantees factual accuracy. |
| Chat history/roles | Earlier turns represented in the provider's required format. | Interpret follow-up questions. | Stored assistant messages become Gemini `model` parts in `toGeminiHistory`. |
| Structured output | Asking for a machine-parseable format. | Validate statement/source relationships before displaying PDF answers. | RAG requests `application/json` with `insufficient` and `statements`, then parses/checks the result locally. |
| Quota/provider error | The external API can reject/limit requests. | Show explicit failures without repeated quota-consuming automatic attempts. | Embedding 429 becomes a quota message; RAG generation 429 is surfaced; ordinary chat uses provider-unavailable messages. |

Source: [gemini.service.js](B:/AI_BUDDY/backend/src/services/gemini.service.js), [embedding.service.js](B:/AI_BUDDY/backend/src/services/embedding.service.js), [rag.service.js](B:/AI_BUDDY/backend/src/services/rag.service.js).

### 10.7 Streaming responses

| Concept | Meaning | Why used here | Actual mechanism/example |
|---|---|---|---|
| SSE | Server-sent text events over an HTTP response. | Deliver ordinary answers incrementally over the existing message API. | Frames are `data: JSON` plus a blank line; JSON `type` identifies meta/delta/done. No WebSocket connection is used. |
| Fetch stream | A response body consumed in byte segments rather than waiting for all content. | POST can include the question body and credentials. | `res.body.getReader()` drives a read loop; this is not native EventSource auto-reconnect. |
| Decoder/frame buffer | Convert incomplete UTF-8 byte segments and preserve incomplete event text. | Network boundaries do not match words or events. | TextDecoder streaming mode and a buffer split on `\n\n` prevent treating each byte read as a whole event. |
| Delta/finalization | An incremental text addition versus authoritative saved completion. | Show live text while retaining final database IDs/citations. | Each ordinary chunk adds to streamingText; `done` supplies the saved assistant message. RAG sends one buffered delta. |
| AbortSignal | A cancellation notification shared with asynchronous work. | Stop a user-requested generation or obsolete attachment request. | Stop aborts Fetch; response close aborts Gemini's signal. Qdrant retrieval only checks the signal around its query. |

Sources: [api.js](B:/AI_BUDDY/frontend/src/helpers/api.js): `streamConversationMessage`; [conversation.controller.js](B:/AI_BUDDY/backend/src/controllers/conversation.controller.js): streaming handler.

### 10.8 RAG architecture

| Concept | Meaning | Why used here | Actual mechanism/example |
|---|---|---|---|
| Retrieval-Augmented Generation | Find relevant stored evidence and supply it to generation. | Answer from private PDFs unavailable to the base model request. | Question embedding → filtered Qdrant query → selected source JSON → Gemini statements. |
| Ingestion/indexing | Transform a new document into searchable representations. | Avoid reparsing/re-embedding the whole PDF for every question. | Upload processing stores chunks and embeddings once for each new owned byte-content document. |
| Query-time pipeline | Work performed when a user asks about attached documents. | Retrieve only evidence pertinent to the current question. | One fresh query embedding and search; no automatic full reingestion. |
| Grounding/evidence | Tie an answer to supplied sources rather than unsupported outside assertions. | Reduce invented resume/document facts. | RAG instructions restrict claims to allowed S/M evidence; history is only for interpreting follow-ups. |
| Attachment inheritance | A conversation retains document references for later turns. | Follow-ups do not need another upload. | Conversation.documentIds becomes the inherited set; a new unsent attachment set takes priority. |

Sources: [document-processing.service.js](B:/AI_BUDDY/backend/src/services/document-processing.service.js), [retrieval.service.js](B:/AI_BUDDY/backend/src/services/retrieval.service.js), [rag.service.js](B:/AI_BUDDY/backend/src/services/rag.service.js).

### 10.9 Semantic search and vector embeddings

| Concept | Meaning | Why used here | Actual mechanism/example |
|---|---|---|---|
| Embedding/vector | A numeric representation used to compare text meaning. | Search related passages despite different wording. | The separate embedding client maps chunk/question text into 768-number arrays. |
| Dimensions | The number of numbers in each vector. | Query and stored vectors must share the collection schema. | Every generated vector is checked for exactly 768 finite components. |
| Semantic similarity | Numerical closeness intended to reflect related meaning. | Match “education details” with a passage naming a university/degree. | Qdrant compares question and chunk vectors; the match is a candidate, not a fact proof. |
| L2 normalization | Divide each component by the vector's Euclidean magnitude. | Keep reduced-dimension embedding handling consistent. | `Math.hypot(...vector)` must be nonzero/finite; each value is divided by that norm. |
| Shared embedding space | Use the same embedding model/configuration for indexed text and questions. | Otherwise query closeness may not be meaningful or dimension-compatible. | Both ingestion and retrieval call the same embedding service with `gemini-embedding-001`. |

Source: [embedding.service.js](B:/AI_BUDDY/backend/src/services/embedding.service.js): `generateEmbeddings`, `generateEmbedding`; [rag.config.js](B:/AI_BUDDY/backend/src/config/rag.config.js).

### 10.10 Chunking and retrieval

| Concept | Meaning | Why used here | Actual mechanism/example |
|---|---|---|---|
| Chunk/window | A bounded piece of document text. | Retrieve a relevant section instead of sending the whole PDF. | Per-page windows at most 2800 characters, preferably ending at a sentence/newline/word boundary. |
| Overlap | Repeated neighboring text around a split. | Preserve local context near a window edge. | Nominal 400 characters, adjusted to a word boundary; no overlap across different pages. |
| Top-K | Maximum nearest candidates requested. | Bound retrieval and prompt size. | RAG_TOP_K defaults to five, permits one through ten. Metadata validation can reduce the returned count. |
| Metadata filter | Conditions restricting which indexed points can match. | Enforce account and selected-document isolation. | Both `userId` exact match and `documentId` allowed-set match are mandatory. |
| Relevance threshold | A minimum acceptable similarity score. | Would help distinguish weak matches before generation. | **Not implemented:** the current query has no score threshold; insufficiency relies on context/answer rules. |
| Exact deduplication | Omit byte-identical files or identical normalized chunk strings. | Avoid needless work and repeated text where explicitly implemented. | File SHA-256 reuse is per user; chunk Set deduplication is within one ingestion, not a global embedding cache. |

Sources: [chunking.service.js](B:/AI_BUDDY/backend/src/services/chunking.service.js), [retrieval.service.js](B:/AI_BUDDY/backend/src/services/retrieval.service.js), [document.controller.js](B:/AI_BUDDY/backend/src/controllers/document.controller.js).

### 10.11 Qdrant and vector similarity

| Concept | Meaning | Why used here | Actual mechanism/example |
|---|---|---|---|
| Collection | Qdrant's named container with vector configuration and points. | Keep all PDF chunks in the configured searchable index. | QDRANT_COLLECTION must exist or be explicitly initialized; it is never reset automatically. |
| Point/payload | One vector with an ID and associated metadata/text. | Retrieve a chunk and know its owner/page/document. | Payload stores text, string owner/document IDs, original filename, page bounds, and chunkIndex. |
| Cosine similarity | Compare vector direction: dot product divided by both vector magnitudes. | Rank meaning-oriented embeddings in the chosen collection. | The collection is configured with Qdrant's `Cosine` metric. The app does not manually compute search scores. |
| Score | A numerical match value returned with a result. | Retain useful search metadata. | Finite scores are returned with chunk metadata; no application score cutoff is applied. Do not reinterpret them as answer confidence. |
| Keyword payload index | An index optimized for exact string/set filters. | Support reliable owner/document filtering, including strict clusters. | Ingestion ensures keyword indexes for `userId` and `documentId`. |
| Upsert/stable ID | Insert or replace a point under the same identifier. | Retries should not append uncontrolled duplicate points. | Custom deterministic document/chunk ID plus `wait: true`; document cleanup uses owner/document filters. |

Sources: [qdrant.service.js](B:/AI_BUDDY/backend/src/services/qdrant.service.js), [document-index.service.js](B:/AI_BUDDY/backend/src/services/document-index.service.js), [retrieval.service.js](B:/AI_BUDDY/backend/src/services/retrieval.service.js).

### 10.12 Prompt engineering and context windows

| Concept | Meaning | Why used here | Actual mechanism/example |
|---|---|---|---|
| System instruction | Higher-level model behavior guidance separate from ordinary user text. | Establish persona, memory rules, and RAG grounding. | `buildModel` joins the existing persona, memoryPrompt, and optional RAG instructions. |
| Context window/budget | The input a model can consider, constrained by model/request limits. | Avoid unbounded history/document prompts. | History count is limited; RAG adds PDF/history/memory character budgets. No tokenizer-aware global budget or summarizer exists. |
| Context injection | Include selected stored information in the actual generation request. | Make external evidence/personal facts available when answering. | RAG serializes question/source text into the new message; personal memory is also in system context. |
| Prompt injection | Untrusted content attempts to redirect the model's instructions. | PDFs and saved fact values could contain hostile instructions. | Prompts explicitly treat sources as data; deterministic memory filters reject some patterns. This reduces risk but is not a formal security guarantee. |
| Local fallback | Produce a useful result without another model call when possible. | Avoid extra quota and keep titles available on provider failure. | `fallbackTitle` derives a title locally; CHAT_TITLE_MODE=local avoids title API calls entirely. |

Sources: [gemini.service.js](B:/AI_BUDDY/backend/src/services/gemini.service.js), [rag.service.js](B:/AI_BUDDY/backend/src/services/rag.service.js), [memory-policy.service.js](B:/AI_BUDDY/backend/src/services/memory-policy.service.js).

### 10.13 Citations and hallucination control

| Concept | Meaning | Why used here | Actual mechanism/example |
|---|---|---|---|
| Source identifier | A server-assigned label naming one allowed evidence item. | Prevent arbitrary model-created source references. | S1 is a retrieved PDF chunk; M1 is a confirmed personal memory source. |
| Citation validation | Check source IDs/format against the retrieved source set. | Avoid fabricated page labels or references to unseen chunks. | Server checks statement/source arrays, rejects inline page/citation text, and appends allowed IDs itself. |
| Provenance/page metadata | Information about where evidence originated. | Let users check a claim in the original document. | One-based pageStart/pageEnd and stable point reference survive retrieval and message persistence. |
| Hallucination | A generated assertion not supported by the relevant evidence. | A resume answer should not invent a degree or employer. | Grounding rules and insufficient replies help; structural citation checks alone do not prove factual support. |
| Insufficient evidence | Sources do not answer the question. | Avoid silently answering with unsupported general information. | No-source and `insufficient: true` branches return fixed messages without fabricated citations. |

Sources: [rag.service.js](B:/AI_BUDDY/backend/src/services/rag.service.js), [MessageBubble.jsx](B:/AI_BUDDY/frontend/src/components/chat/MessageBubble.jsx).

### 10.14 Conversation history and persistent memory

| Concept | Meaning | Why used here | Actual mechanism/example |
|---|---|---|---|
| Transcript/history | Stored sequence of messages in one conversation. | Show earlier discussion and interpret follow-ups. | Mongo Message records are paginated for UI and independently selected for Gemini history. |
| Personal memory | Concise facts/preferences reused across the same user's conversations. | Answer a new chat's name/nickname question without a PDF. | One owned MemoryProfile holds structured category/key/value entries, not copied conversation transcripts. |
| Deterministic extraction | Rules recognize explicit forms rather than asking an LLM. | Save quota and avoid treating arbitrary content as facts. | Name/nickname and “I study at …” patterns; quoted/hypothetical/sensitive messages are excluded heuristically. |
| Conflict/correction | Distinguish ambiguous changes from intentional replacements. | Avoid silently replacing an important college/name with uncertain text. | Conflicts retain up to three alternatives; explicit correction wording can confirm a new value. |
| Entry expiry | Stop using temporary facts after a defined time. | Current learning/goals should not be treated as permanent. | 30-day current topic/goal; 90-day recently learned topic; retrieval filters expired entries. No profile TTL deletion. |
| Revision/manual-change fence | Conditional versioning plus a timestamp boundary for old turns. | Concurrent writes should not lose facts or resurrect deleted ones. | Update checks revision; deletion/clear/pause sets manualChangeAt and increments revision. |
| Memory relevance | Select only useful saved items for the question. | Avoid dumping the whole profile into every prompt. | Category/keyword scoring, preference inclusion, recency tie-break, 12-item/4500-character bound. |

Sources: [memory.service.js](B:/AI_BUDDY/backend/src/services/memory.service.js), [memory-policy.service.js](B:/AI_BUDDY/backend/src/services/memory-policy.service.js), [memory-extraction.service.js](B:/AI_BUDDY/backend/src/services/memory-extraction.service.js).

### 10.15 Error handling and performance

| Concept | Meaning | Why used here | Actual mechanism/example |
|---|---|---|---|
| Fail open/fail closed | Continue with a nonessential feature unavailable versus reject an unsafe/incomplete operation. | Memory failure should not disable normal chat; ownership failure must not broaden retrieval. | Memory preparation returns warnings; unavailable selected documents cause an explicit error. |
| Timeout/deadline | A bound on an operation or a persisted reservation's validity. | Avoid indefinite jobs and misleading Processing status. | Qdrant 10 seconds; embeddings 60 seconds; extraction 60 seconds; job abort 15 minutes; metadata deadline 20 minutes. |
| Batching/concurrency bound | Process a small group or bounded number of jobs. | Limit provider request sizes and simultaneous PDF work. | Two chunk texts per embedding call; at most two active ingestion users per server process. |
| Idempotent reuse | Repeat selected operations without adding another logical copy. | Upload retries should not multiply records/points. | Per-user content hash uniqueness and deterministic point upserts; not a guarantee of atomic/idempotent whole multi-store uploads. |
| Partial failure/compensation | Some external writes succeeded before a later step failed; attempt cleanup. | MongoDB, disk, and Qdrant do not share a transaction. | Failed indexing attempts filtered deletion; failed document deletion retains metadata for retry. |
| Safe diagnostics | Preserve useful failure context without leaking secrets/private contents. | Distinguish DNS/auth/config errors while keeping responses concise. | `logServiceError` redacts credentials/endpoints and retains cause chains; generic/legacy paths are less uniform. |
| Cache versus persistent index | A cache avoids repeated computation; an index stores searchable derived data. | Understand actual quota savings. | Ready file duplicates reuse stored points. Repeated questions still generate new embeddings; no general query cache exists. |
| Backpressure | A slow consumer signals the producer to pause. | Important when scaling long HTTP streams. | The controller writes SSE but does not await drain after `res.write` returns false; explicit flow control is not implemented. |

Sources: [service-error.js](B:/AI_BUDDY/backend/src/utils/service-error.js), [document-processing.service.js](B:/AI_BUDDY/backend/src/services/document-processing.service.js), [conversation.controller.js](B:/AI_BUDDY/backend/src/controllers/conversation.controller.js).

## 11. Simple Chat vs RAG Comparison

| Aspect | Simple Chat | PDF RAG Chat |
|---|---|---|
| Input | Typed question with no selected/inherited documents. | Typed question plus explicit or inherited owned document references. |
| Processing pipeline | Auth → owned thread → history/save user → memory → Gemini → save/display. | Same shared stages, then question embedding → filtered search → bounded sources → JSON generation → citation validation → save/display. |
| Context source | General model knowledge, current recent history, relevant personal memory. | Selected PDF passages plus eligible personal memory; history only for interpreting follow-ups under RAG rules. |
| MongoDB use | Accounts, conversations/messages, memory. | Same plus document metadata/readiness and source snapshots. |
| Disk use | None for a normal message. | Original PDF retained from ingestion; a normal question searches the index rather than reopening the file. |
| Gemini generation | Usually one generation request per message; optional AI title can add one. | Usually one JSON answer request if usable S/M sources exist; fixed reply if no sources. Optional title is separate. |
| Embeddings | None. | Ingestion embeds chunk batches; each question embeds the query once. Same model/dimensions. |
| Retrieval | Recent Mongo history and deterministic personal-memory selection. | Those shared mechanisms plus Qdrant search restricted by owner and permitted documents. |
| Streaming | Ordinary text chunks arrive incrementally through SSE. Regeneration/REST remain non-streaming. | Same SSE API but full answer buffered for validation and sent as one delta; REST/regeneration also supported. |
| Citations | No automatic PDF source citations in ordinary answers. | Validated S/M IDs; structured filename/page/chunk or saved-memory metadata. |
| Final response | Saved free-form Markdown-capable assistant message. | Saved statement text with server-added citations and public source metadata, or a fixed insufficiency message. |
| Failure behavior | Safe provider-unavailable event/response, possible persisted partial reply. | Explicit retrieval/generation/validation error; no silent switch to ordinary chat. |

### 11.1 Shared authentication, history, and memory

```mermaid
flowchart TD
    InputShared["React question and optional attachment IDs"] --> AuthShared["Shared signed-cookie JWT middleware"]
    AuthShared --> OwnerShared["Owned conversation lookup"]
    OwnerShared --> HistoryShared["Load recent history and save current user turn"]
    HistoryShared --> MemoryShared["Prepare this user's persistent memory"]
    MemoryShared --> ModeShared{"Resolved attachment context?"}
    ModeShared -->|None| NormalShared["Ordinary prompt and Gemini streaming"]
    ModeShared -->|Owned Ready PDFs| RAGShared["Question embedding and filtered Qdrant retrieval"]
    RAGShared --> GroundShared["Bound PDF and memory sources, generate JSON, validate citations"]
    NormalShared --> SaveShared["Shared assistant Message persistence"]
    GroundShared --> SaveShared
    SaveShared --> MetaShared["Shared title, preview, history APIs and rendering"]
    MemoryShared --> ProfileShared["MongoDB MemoryProfile scoped by userId"]
    HistoryShared --> DataShared["MongoDB Conversation and Message"]
    SaveShared --> DataShared
```

The selected PDF is not the source of permanent memory. Only supported explicit statements in the typed user turn enter extraction. Conversely, memory retrieval does not require any attachment or Qdrant connection.

Sources: [conversation.controller.js](B:/AI_BUDDY/backend/src/controllers/conversation.controller.js), [conversation.service.js](B:/AI_BUDDY/backend/src/services/conversation.service.js), [memory.service.js](B:/AI_BUDDY/backend/src/services/memory.service.js).

## 12. Security and Error Handling

### 12.1 Implemented boundaries

- Passwords are bcrypt hashes and excluded from ordinary model selection. Account responses use explicit public fields. JWTs stay in signed HTTP-only cookies.
- Protected routers derive the account ID from verified server locals. Conversation ownership is checked before message/history actions; document metadata, memory, and Qdrant retrieval use owner scoping. Return payloads are validated again after retrieval.
- PDF physical filenames are generated; path resolution accepts only their safe format. Uploaded files are not public static assets. Public metadata serialization excludes storage names, hashes, and lock/deadline fields.
- Server-side multipart/signature/size/parser limits remain authoritative regardless of browser checks. JSON messages have their own body/message limits.
- RAG content and memory are explicitly labeled untrusted model input. Statements may cite only backend-supplied source IDs. No tool-executing agent is implemented.
- Embedding/Qdrant failures retain causes through `causedError` and redacted `logServiceError`; document/auth/memory flows use specific safe response messages. Provider keys are not frontend variables.

Sources: [token-manager.js](B:/AI_BUDDY/backend/src/utils/token-manager.js), [pdf-upload.middleware.js](B:/AI_BUDDY/backend/src/middleware/pdf-upload.middleware.js), [document.controller.js](B:/AI_BUDDY/backend/src/controllers/document.controller.js), [service-error.js](B:/AI_BUDDY/backend/src/utils/service-error.js).

### 12.2 Error transport and state handling

| Failure | Current response/state behavior |
|---|---|
| Invalid signup/message parameters | Usually 422 with field errors that omit submitted values. Controller-level bad requests can be 400. |
| Missing/expired/invalid cookie/JWT | 401; workspace redirects only after frontend identity checking finishes. |
| Other user's/missing conversation or memory entry | Owned lookup fails, generally 404 rather than returning another user's data. |
| Missing/unready selected PDF | Explicit bad request; Ready-document checks must succeed before retrieval. |
| Wrong PDF MIME/signature or malformed multipart | 400; oversized upload 413; parser/processing failures become safe Failed metadata. |
| Qdrant DNS/network/auth/resource/collection errors | `qdrantError` distinguishes causes and emits actionable 503 or configuration-conflict 409 messages. A collection is never reset as recovery. |
| Embedding quota failure | 429 safe quota/rate message; other provider/vector failures use 502. No application retry loop for embedding generation. |
| RAG generation/JSON/citation failure | Safe 429/503/502 error, depending on cause. No ordinary-chat fallback. |
| Ordinary generation failure | REST typically 503; open SSE sends an error event and persists partial status where possible. |
| Memory unavailable/capacity/race | Preparation fails open or reports partial/not-saved; UI receives a warning. Management failures return 503. |
| Partial index/file/database cleanup | Preserve Failed metadata/error when possible so deletion/retry can finish later. The operations are not atomic across stores. |

`errorHandler` normalizes Mongoose validation, casts, and duplicate-key errors, and returns `{ message, errors? }`. If streaming headers are already sent, it can only end the response. The Fetch/REST helpers normalize ordinary API failures for UI toasts/alerts. A stream's HTTP success status alone does not prove answer success.

Sources: [error.middleware.js](B:/AI_BUDDY/backend/src/middleware/error.middleware.js), [service-error.js](B:/AI_BUDDY/backend/src/utils/service-error.js), [api.js](B:/AI_BUDDY/frontend/src/helpers/api.js), [conversation.controller.js](B:/AI_BUDDY/backend/src/controllers/conversation.controller.js).

### 12.3 Security concerns present in the inspected design

These are source-level findings and recommendations, not changes made by this guide:

1. **CSRF and throttling:** no explicit CSRF token/origin-validation middleware, rate-limit middleware, account lockout, or upload quota accounting is implemented. Credentialed CORS is not a complete CSRF defense, particularly with production SameSite=None; logout is a GET mutation.
2. **Session revocation:** there is no server session store, refresh flow, or token revocation list. `verifyToken` validates claims without checking User existence on every protected request. Logout clears this browser cookie rather than invalidating all copies of a signed JWT.
3. **Uneven sanitization:** the central handler returns `err.message` by default; normal chat can log raw provider errors, legacy list/delete handlers include `cause: error.message`, and database startup logs raw failures. Do not infer uniform secret-safe responses/logs from the dedicated document/auth/memory sanitizers.
4. **Input inconsistency:** the create-conversation route does not apply the rename title validator. The older chat API validates only non-empty message content rather than the newer string/length contract. Tightening either should be a separate compatibility-aware code change.
5. **Prompt boundaries are model instructions:** source labels/JSON/citation checks help, but prompt injection and unsupported claims are not formally eliminated. No semantic entailment verifier is present.
6. **Deployment/data protection:** code does not configure TLS termination, filesystem encryption, backup/restore, malware scanning, or durable job infrastructure. Cloud database/cluster security and persistent storage permissions need operator verification.
7. **Multi-write consistency:** conversation deletion, regeneration, assistant persistence, and document cleanup use separate operations without an encompassing transaction. Errors/restarts can leave incomplete work, stale references, or lost regenerated tails.
8. **Cancellation/stream robustness:** Qdrant query lacks direct signal forwarding; ChatProvider has no explicit active-generation unmount abort effect; SSE sentinel formatting differs between server/helper; no heartbeats, auto-reconnect protocol, or explicit drain/backpressure handling is implemented.

Sources: the auth/error/controller/helper files cited in this section; [chat-controller.js](B:/AI_BUDDY/backend/src/controllers/chat-controller.js); [app.js](B:/AI_BUDDY/backend/src/app.js).

## 13. Limitations and Future Improvements

### 13.1 Implemented versus partial or absent behavior

| Area | Current status and limitation | Possible future improvement, not implemented here |
|---|---|---|
| Durable PDF processing | Partial: in-process reservations and scheduled work; expired jobs are marked Failed on later activity. | Persistent queue, restart recovery, cross-instance reservations, monitored dead jobs. |
| File durability | Partial: private local originals, no automatic expiry or shared volume abstraction. | Persistent volume/object storage with coordinated metadata cleanup and backups. |
| Text understanding | PDF text extraction only; no OCR, image/diagram understanding, or advanced table reconstruction. | Explicit OCR/layout pipeline with privacy/resource controls. |
| Chunk quality | Character-based, page-local windows; duplicate text collapses later occurrences. | Token-aware/page-aware refinement and provenance for repeated passages if needed. |
| Search quality | Owned top-K cosine search; no score threshold, reranker, BM25/hybrid, or query rewriting. | Evaluate relevance first, then add measured retrieval improvements rather than assuming nearest means useful. |
| Citation confidence | Structural source/format validation, not semantic proof; regex can reject legitimate page/filename mentions. | Evidence checks and better structured text/citation validation without model-authored page metadata. |
| RAG latency/streaming | Buffered JSON answer before one SSE delta. | A compatible incremental structured-output/citation protocol if safe validation can be preserved. |
| Context accounting | Message-count and character caps; no exact global token budget or history summarizer. | Token-aware total input accounting and explicit truncation/summary policy. |
| Memory coverage | Explicit deterministic patterns and a small set of languages/preferences, bounded profile and conflicts. | Carefully extend supported patterns with offline checks; retain consent/privacy boundaries and quota discipline. |
| Memory deletion scope | Saved facts deleted independently from original chat text. | Clear UX for history versus memory deletion and an explicit broader deletion policy. |
| Caching/cost | Ready byte-duplicate reuse only; no general chunk/query embedding cache. | A user-isolated cache with invalidation only after measuring quota needs. |
| Client management | PDF and memory dialogs implemented; no PDF viewer/download route, no full document pagination UI. | Private authenticated viewing and scalable listing if required. |
| Security/observability | Auth and owner filters exist; gaps listed in section 12. | CSRF/rate protection, consistent sanitization, revocation policy, safe metrics/trace IDs. |
| Deployment packaging | Separate npm projects, SPA fallback file, no inspected infrastructure/container workflow. | Reproducible runtime/deployment configuration and production service checks. |

### 13.2 Verification scope for this document

This task used static source inspection. No signup/login submission, server startup, MongoDB migration, PDF upload/extraction job, Gemini generation, embedding request, Qdrant connectivity query, application build, or application test suite was run to produce this guide. Existing offline tests and scripts were inspected as tools/coverage evidence, not treated as live-service proof. Documentation checks are distinct from feature testing.

For this guide, the Markdown was parsed with the already-installed remark/GFM tooling; 33 tables and 168 source links were checked, and the API tables were matched against all 27 statically registered method/path combinations. The eight diagrams use a small standard Mermaid flowchart/sequence subset, checked for node/participant references, labels, arrows, and balanced control blocks and reviewed manually. No Mermaid rendering engine was installed or run, so rendered layout was not verified. These checks did not execute application requests or change dependencies.

Available operator commands, listed for orientation and **not executed as application verification in this task**:

| Command/location | What it establishes or changes |
|---|---|
| `npm test` in backend | Runs the existing 10 offline auth and eight memory/chat-prompt checks; Mongo/provider behavior is mocked. |
| `npm run test:api` in backend | Live API exercise; creates test users, can call Gemini, and does not fully remove its test accounts. Use a disposable environment. |
| `npm run qdrant:check` in backend | Live read-only collection/connectivity inspection without embeddings. |
| `npm run qdrant:init` in backend | Creates a missing collection explicitly; does not replace an incompatible existing one. |
| `npm run migrate -- --dry-run` in backend | Reads legacy data to preview migration; still requires a real Mongo connection. Do not confuse it with a no-service unit test. |
| `npm run lint` / `npm run build` in frontend | Source/toolchain checks, not live authentication, retrieval, or persistence verification. |

Sources: [backend/package.json](B:/AI_BUDDY/backend/package.json), [check-auth.mjs](B:/AI_BUDDY/backend/scripts/check-auth.mjs), [check-memory.mjs](B:/AI_BUDDY/backend/scripts/check-memory.mjs), [e2e-test.mjs](B:/AI_BUDDY/backend/scripts/e2e-test.mjs), [check-qdrant.js](B:/AI_BUDDY/backend/scripts/check-qdrant.js), [migrate-chats.js](B:/AI_BUDDY/backend/scripts/migrate-chats.js).

### 13.3 Questions requiring manual/deployment verification

1. Does the deployed browser origin match `FRONTEND_URL`, and does `VITE_API_URL` point to the intended `/api/v1` service? Do Secure/SameSite cookies survive the actual HTTPS/domain arrangement?
2. Are MongoDB account/document/profile indexes actually built, and does the runtime account have appropriate permissions? Have all relevant legacy histories been migrated safely?
3. Does the configured Qdrant REST endpoint resolve and authorize this key? Is the configured collection one unnamed 768-dimensional Cosine vector with compatible owner/document keyword indexes?
4. Do the separate generation and embedding keys have usable model access/quota? Actual deployed availability cannot be inferred from imported SDKs or constants.
5. Does the real deployment Node executable support the installed PDF.js/Vite versions, and is private PDF storage writable and persistent across restart/redeployment?
6. Does the reverse proxy preserve incremental SSE delivery without buffering/timeouts, and does Stop cancel provider work and persist partial output as expected?
7. With one small text PDF, does Ready represent complete indexing, does a known-answer question retrieve the correct owner's passage, and does the cited page match the original file?
8. After explicitly stating a fictional name/nickname, does Manage memory show the saved entries, and does a fresh no-PDF conversation retrieve them for the same account while a second account sees none?
9. Can partial deletion, interrupted uploads, concurrent retries, and a process restart be recovered without orphaned disk files/points? These failure cases need a controlled environment, not assumptions from the happy path.

The architecture is one shared authenticated conversation system with ordinary generation, optional PDF retrieval, and independent structured personal memory. Its primary remaining work is operational reliability and measured validation—not a second chat pipeline.
