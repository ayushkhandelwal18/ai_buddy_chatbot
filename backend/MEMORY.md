# Persistent personal memory

Memory uses the existing MongoDB connection and Gemini chat calls. There are no new dependencies, environment variables, embeddings, Qdrant collections, or extraction-model calls.

## Implementation files

New:

- `backend/src/models/memory.model.js`
- `backend/src/services/memory-extraction.service.js`
- `backend/src/services/memory-policy.service.js`
- `backend/src/services/memory.service.js`
- `backend/src/controllers/memory.controller.js`
- `backend/src/routes/memory.route.js`
- `frontend/src/components/chat/MemoryDialog.jsx`
- `backend/scripts/check-memory.mjs`
- `backend/MEMORY.md`

Extended for integration:

- `backend/src/controllers/conversation.controller.js`
- `backend/src/controllers/chat-controller.js`
- `backend/src/services/gemini.service.js`
- `backend/src/services/rag.service.js`
- `backend/src/models/message.model.js`
- `backend/src/routes/index.route.js`
- `frontend/src/Pages/Chat.jsx`
- `frontend/src/components/chat/TopBar.jsx`
- `frontend/src/components/chat/MessageBubble.jsx`
- `frontend/src/helpers/api.js`

## Storage and lifecycle

Each authenticated user has one `MemoryProfile` with a unique `userId` index, an enabled setting, a revision, and up to 128 structured facts. Entries contain category/key/value, source conversation/message references, timestamps, expiry, and bounded conflict alternatives. Values are capped at 240 characters. Ensure the schema's unique `userId` index is created when deploying if automatic Mongoose index creation is disabled.

Only newly submitted user messages are examined, including the legacy chat endpoint. Existing conversations are not backfilled, regeneration does not re-save facts, and assistant replies/PDF text are never mined for memory. New user messages that explicitly repeat a deleted fact can save it again. Statements containing likely credentials, identifiers, instructions, quoted examples, or an explicit opt-out are conservatively excluded. This filter is not a general-purpose sensitive-data classifier; do not share secrets in chat.

Supported English examples:

- Informal introductions are supported, including `bro my name is ayush you can call me ayu as nickname` (separate name **Ayush** and nickname **Ayu**). No `remember this` command is required.

- `My name is …`, `You can call me …`, `I study at …`, `My degree is …`, `I graduate in 2028`.
- `My skills include JavaScript and MongoDB`, `My project StudyBuddy uses Groq API`.
- `I prefer concise answers with examples`, `I prefer English`.
- `I am learning RAG`, `I recently learned MongoDB`, `My current goal is …`.
- `Actually, my college is …` or `My college is now …` explicitly corrects a stable fact. Unmarked contradictions remain unresolved, with the original and alternative values visible. Explicit nickname/style preferences and current topics/goals update to the latest declaration.

Current learning topics and goals expire after 30 days. Completed learning expires after 90 days. Expired entries are excluded immediately, then pruned on a subsequent management read or fact write. Stable facts remain until deleted. Memory capacity is bounded; a full profile will not silently evict stable facts. Delete obsolete entries to free space.

Before normal, streaming, legacy, and regenerated replies, a local relevance ranker selects at most 12 entries (about 4,500 JSON characters). Relevant categories/words and communication preferences determine selection. Gemini receives these as untrusted personal data with instructions to avoid inventing personal facts and to ask about conflicts. There is no additional model call. Memory operations have short database deadlines and failures let chat continue without memory. A turn may save an explicit fact even if its subsequent Gemini answer fails.

PDF RAG keeps its authenticated document filtering, retrieval, and page citations. It can cite relevant confirmed memory as distinct `M` sources labeled **Saved memory**, while PDF evidence retains `S` sources and page metadata. Preferences and conflicted facts are not factual RAG sources. Memory is never presented as PDF evidence. RAG still requires a successful document retrieval operation; Qdrant failures are not silently bypassed.

## Management

The chat header's **Manage memory** button opens a dialog to inspect, refresh, pause, delete individual entries, or confirm clearing all entries. Pausing disables both saving and use, without deleting entries. Clearing/deleting memory does not erase original chat history or answers that already quoted it. In-flight answers may already have received memory before deletion; deletion affects subsequent turns. Delete the original conversation too if that history should no longer supply the information.

Authenticated APIs (identity comes only from the existing JWT cookie):

- `GET /api/v1/memories`
- `DELETE /api/v1/memories/:id`
- `DELETE /api/v1/memories`
- `PATCH /api/v1/memories/settings`, JSON `{ "enabled": false }` (or `true`).

Atomic revision predicates protect concurrent writes. Manual changes set a time boundary so previously accepted turns cannot restore deleted facts. One bounded revision-conflict retry is allowed; provider calls are not retried. Management failures return safe errors and do not claim deletion succeeded.

Chat responses also include a safe `memory` status (availability, save status, retrieved count, and an optional warning). Streaming sends this as a `memory` event; the UI displays warnings without aborting the answer. Server diagnostics identify the failed memory stage without logging fact values or raw validation errors. A conversational acknowledgement is not proof of persistence: inspect **Manage memory** to confirm a fact was saved. Previously missed introductions are not backfilled automatically; resend them after updating. Facts known only through a PDF are still not persisted; explicitly state `My college is …` to save one.

## Focused offline checks

From `backend`, run `node --test scripts/check-memory.mjs`. This checks extraction, conflict/expiry policy, schema bounds, isolation/management/concurrency using an in-memory Mongo stub, fail-open handling, and prompt integration with a mocked Gemini SDK. Network calls are blocked in this script. It is not a live database or Gemini integration test.

## Minimal manual verification

1. Restart the backend/frontend normally. In chat A, say `My name is Test Person. I study at Example College. You can call me Buddy. I prefer concise answers with examples.` Open **Manage memory** and inspect the saved entries.
2. Start chat B without a PDF. Ask `What is my name, which college do I attend, and what nickname did I choose?` Check the streamed answer.
3. Say `Actually, my college is New College.` Inspect the update. Delete the college entry, then ask in a **new** chat which college you attend; it should be unavailable. Check pause/clear as desired. A second account must see none of the first account's entries.

Extraction intentionally covers explicit English declarations, not arbitrary biography, inferred assistant-chosen nicknames, multilingual text, implicit corrections, or semantic recollection of entire conversations. Confirm an assistant's nickname with `You can call me …`. No historical backfill or OCR is introduced. As with existing chat data, production MongoDB backups, access controls, encryption at rest, and retention policies should cover this collection.
