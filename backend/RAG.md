# RAG foundation — Part 1

Set these backend `.env` variables (case-sensitive):
`Gemini_API_KEY_for_embedding`, `QDRANT_URL`, `QDRANT_API_KEY`, and
`QDRANT_COLLECTION`. The existing `GEMINI_API_KEY` remains dedicated to chat.
Use an HTTPS Qdrant endpoint in production.

From the `backend` directory, optionally run:

```sh
npm run qdrant:check
npm run qdrant:init
```

`qdrant:check` checks connectivity and inspects the configured collection without
writing data. A missing collection is reported; an incompatible collection causes
a nonzero exit. `qdrant:init` creates only a missing collection, with one unnamed
768-dimensional vector and Cosine distance. Neither command calls Gemini.
Existing collections are never reset or deleted. If the collection is incompatible,
choose another `QDRANT_COLLECTION` or resolve the mismatch separately.

Reusable functions:

- `getQdrantClient()` in `src/config/qdrant.config.js`: lazy shared client.
- `generateEmbedding(text)` in `src/services/embedding.service.js`: explicitly
  calls `gemini-embedding-001` using the separate key, requests 768 dimensions,
  validates finite vector values and normalizes the vector.
- `inspectQdrantCollection()` and `initializeQdrantCollection()` in
  `src/services/qdrant.service.js`: explicit inspection and initialization.

No RAG network requests are made at startup. Live provider behavior
must be checked separately when desired; implementation checks do not call Gemini.

## PDF ingestion — Part 2

The chat composer's + menu offers Upload PDF and Manage PDFs. Selecting a PDF
starts upload automatically and displays its actual upload/processing status.
Uploading a PDF is the only action that starts extraction
and embedding requests. PDFs are not included in chat prompts. These APIs use
the existing authenticated cookie identity:

- `POST /api/v1/documents/upload`: one multipart `file`, returns HTTP 202 with
  document metadata. Extension, MIME type, signature and size are validated.
- `GET /api/v1/documents?limit=30&skip=0`: owner-scoped list (maximum 100/page).
- `GET /api/v1/documents/:id/status`: owner-scoped processing status.
- `DELETE /api/v1/documents/:id`: owner-scoped removal of Qdrant points, file,
  and metadata. Active jobs return 409. Failed cleanup preserves metadata for retry.

Original files live privately in `backend/uploads/pdfs/`, resolved relative to
the module, with UUID filenames and no public static route. MongoDB stores metadata
and a filename only. The upload directory is Git-ignored. Optional `PDF_MAX_SIZE_MB`
defaults to 20. Backend limits are authoritative; the UI displays server errors.

PDF.js extracts pages in a worker thread (60-second timeout, 256 MB JS heap limit),
with limits of 500 pages and 2 million extracted characters. Malformed/encrypted
PDFs fail safely. PDFs without meaningful text fail with an OCR-not-supported
message. Mixed image/text PDFs index extractable text only; image content is ignored.
No OCR or table/diagram interpretation is included.

Chunking approximates tokens as four characters, targets 500–700 tokens with
about 100 tokens of overlap, and prefers line/sentence boundaries. Chunks never
cross pages; shorter page-ending chunks are allowed. Duplicate text is skipped.
Payloads contain text, userId, documentId, originalFilename, pageStart, pageEnd,
and chunkIndex. Stable UUID-shaped IDs are derived from document/chunk identifiers.
Maximum 500 chunks/document; embeddings reuse the Part 1 service with SDK-supported
batches of two texts/request, with no retries and a 60-second request timeout.
All expected upserts must complete before ready status is saved.

Initialize the existing collection manually using `npm run qdrant:init` if needed.
Uploads validate it and add missing keyword payload indexes for `userId` and
`documentId`; the Qdrant key needs write, index-creation, and deletion permissions.
Collections are never deleted or recreated. Failures after indexing starts trigger
owner/document-filtered point cleanup. Cleanup failures are recorded for explicit
deletion retries. Failed documents retain their private original PDF until deletion.

The development worker pool permits two active jobs per backend process and one
per user per process. Jobs have a 15-minute budget. On process interruption, stale
uploaded/processing records become failed on the next owner-scoped list/status/delete
request after their 20-minute deadline. No embedding requests resume automatically.
Any partial points left after a crash are removed by explicit document deletion.
Deletion uses a two-minute lease to prevent simultaneous cleanup; interrupted
deletions can be retried after the lease expires. Cross-service deletion is not
transactional: successful cleanup steps are idempotent and metadata is removed last.

Local storage is suitable for development. Production requires persistent private
storage: ephemeral filesystems may lose PDFs during redeployment or instance
replacement. Multiple backend instances also require shared storage and a durable
job queue; the in-process pool is not a production distributed worker system.
Automatic orphan-file cleanup and automatic processing retries are not included.

Manual setup: ensure MongoDB is reachable, configure the Part 1 variables, initialize
the Qdrant collection, and give the backend write access to its upload directory.
Start the existing backend/frontend normally, sign in, click + → Upload PDF, and
choose a PDF when you want to spend embedding quota. Status polls every five seconds
while pending and stops on completion, failure, request errors, or unmount.

## Retrieval and document answers — Part 3

Use + → Upload PDF in the composer. There is no mode checkbox or selection list.
The picker accepts up to 10 PDFs per question, uploads them automatically one at a
time, and waits for server-confirmed Ready status for every attachment. The original
one-processing-job-per-user backend limit is preserved. Ready, Processing, Uploading,
Failed, and status-check errors have separate indicators. Retry upload explicitly
reuses the browser's File object; after refresh choose the original file again.
No file is treated as ready merely because its filename is visible.

The draft attachment hook owns selected files, uploads and status updates together.
It checks the exact document IDs using the existing authenticated status endpoint,
without deriving readiness from a paginated global document list. Status-check
failures stop polling that ID until manual refresh, removal, or reopening the chat.
Removing an attachment does not delete its private file or cancel processing already
accepted by the server. Manage PDFs lists uploaded documents and supports deletion.

On send, explicit documentIds activate RAG automatically and replace the conversation's
previous attachment set. Only those documents are searched. The owner-validated IDs
are stored on both the conversation and its user message. Follow-ups inherit them,
including after reopening the conversation. New attachments replace inherited context;
multiple attachments added before sending accumulate. Removing all attachments and
sending persists an empty set and restores normal chat. A new chat starts without
attachments. Unsent drafts and queued files are browser-session state and are not
restored by a page refresh. Older conversations can inherit references from their
existing RAG user messages without a database migration. Regeneration uses the
original user message's attachments and resets conversation context accordingly.

Existing message POST endpoints, including `/messages/stream`, accept optional
`documentIds: ["..."]`; no separate rag flag is required. Omitting documentIds
inherits conversation context. An explicit empty array clears it. The old rag flag
remains accepted for compatible clients; only a legacy explicit rag:true without
IDs or conversation attachments uses the previous newest-100-ready-documents rule.
No new chat endpoints were added.
Document IDs are validated and resolved using the authenticated cookie identity.
`retrieveChunks()` in `src/services/retrieval.service.js` embeds the question with
the existing embedding service and queries the existing Qdrant collection with both
userId and resolved documentId payload filters. Ownership, readiness, and payload
metadata are checked before chunks are returned. Default top-K is 5; optional
`RAG_TOP_K` accepts 1–10. No ingestion is repeated and no collection is recreated.

`answerRagQuestion()` in `src/services/rag.service.js` caps source text at 12,000
characters (3,200/chunk), history at 8,000 characters/10 messages, and question at
8,000 characters. It uses the existing Gemini chat model and chat key. The embedding
key remains separate. System instructions treat PDF content as untrusted evidence,
ignore embedded instructions, and require an insufficient-information answer when
evidence does not support an answer. Empty retrieval skips answer generation.

The model returns structured statements with source IDs. The server validates every
ID, rejects model-written page/source references in statement text, and constructs
inline citations itself. Only cited sources are persisted and returned; their page
ranges and filenames come from validated stored metadata, not the model. Message
responses add `rag`, `documentIds`, and `sources` without removing existing fields.
Sources include sourceId, documentId, originalFilename, pageStart, pageEnd,
chunkIndex, chunkReference, and similarity score. Chunk text is not returned as
source metadata. Sources appear below the answer; the existing document UI has no
private PDF viewer, so no file link or public URL is created.

Normal responses retain token streaming. RAG uses the same SSE events but buffers
generation until citation validation, then emits validated answer text followed by
the existing done event containing source metadata. Cancellation remains supported;
no unvalidated partial RAG answer is displayed or saved. Provider requests are not
automatically retried. Quota failures have a clear wait-for-reset message.

No new dependencies, migrations, or required environment variables are needed.
Restart the existing backend/frontend after updating. Optional `RAG_TOP_K=5` is
documented in `.env.example`. Existing ready documents can be used immediately.

Limitations: retrieval embeds the current question rather than rewriting follow-ups;
pronoun-only questions may retrieve weak matches. Citation checks validate references,
not the semantic truth of every statement. Prompt-based grounding is not a formal
guarantee against model mistakes or malicious source content. Invalid model output
is reported as an answer-validation error. Empty retrieval explicitly reports that
no relevant information was retrieved from the selected documents.
Source metadata is a historical snapshot and remains on past messages after a PDF
is deleted. OCR and advanced retrieval remain outside this phase.

## Qdrant connection and upload retries

The installed Qdrant SDK's client timeout is measured in **milliseconds**. The
client now uses `10000` (10 seconds), replacing the incorrect `10` (10 ms).
An explicit endpoint port is preserved; URLs without a port use standard HTTP(S)
ports, avoiding the SDK's implicit `6333` override. Dashboard URLs are rejected.
The backend `.env` is resolved relative to the configuration module regardless of
the launch directory. Deployment environment variables retain precedence; local
credentials are never rewritten. Chat and embedding API keys remain separate.

Upload preflight checks Qdrant collection connectivity/configuration before creating
new document metadata. Processing checks it again before generating embeddings.
No Qdrant or embedding calls were added to startup. Missing collections must be
initialized explicitly with the existing `qdrant:init` command. Initialization
creates a missing collection only and preserves existing collections and data.

Server logs identify stages such as file reading, Mongo metadata creation,
collection checks, extraction, embedding, upsert and cleanup. Original exceptions
are retained as causes, with redacted exception/cause stacks and status codes in
logs. Request headers, credentials and arbitrary provider response bodies are not
dumped. Safe frontend messages distinguish timeout, DNS/network, access denial,
missing collection and incompatible configuration. A Qdrant error is never
relabelled as a MongoDB/file-reading error.

New PDF uploads store an internal SHA-256 content fingerprint. An owner/fingerprint
unique partial Mongo index prevents duplicate records for concurrent/repeated
uploads; records without fingerprints are excluded. The MongoDB account must be
able to create this index. Ready/active duplicates reuse their existing metadata.
Failed uploads are claimed atomically, their partial Qdrant points are removed
using owner/document filters, and the original document/point IDs are reused.
The UI sends `retryDocumentId` when retrying an existing failed upload; ownership
and PDF content are checked before reuse, including older records without hashes.
Temporary duplicate files are removed. Failed records retain their original file
for explicit retries; no automatic ingestion retry spends quota.

Connectivity and collection initialization were checked without Gemini calls.
End-to-end PDF extraction/embedding/indexing still needs one manual upload after
restarting the backend. Run `npm run qdrant:check` from backend if needed; it only
reads Qdrant. From the project root, `node backend/scripts/check-qdrant.js` also
loads the correct backend environment file.
