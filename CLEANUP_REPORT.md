# AI-Buddy cleanup report

Cleanup date: 2026-10-25. Changes are relative to the working tree at the start of this task, which already contained public-page/authentication work and six file deletions. Those existing changes were preserved.

## Scope and evidence

The review covered frontend/backend entry points, all source modules, controllers, registered routes, models, middleware, services, hooks/providers, assets/styles, package scripts, deployment/configuration files, migrations, tests, and documentation. An AST import/export audit traced 87 JavaScript/JSX modules before cleanup and 83 afterward, including the PDF worker loaded through `new URL(..., import.meta.url)` and the dynamic PDF.js import. Build-tool configuration exports were treated as entry points, not unused modules.

Candidates were checked against imports, runtime strings, route registration, npm scripts, tests, configuration, and documentation before removal. Static reachability does not prove live-service behavior or rule out external clients of published API routes.

## Files deleted by this cleanup

| File | Evidence and replacement |
|---|---|
| `frontend/src/components/shared/CustomizedInput.jsx` | No remaining imports or runtime references; current auth fields live in `components/public/AuthForm.jsx`. |
| `frontend/src/components/shared/Logo.jsx` | Unreferenced old header logo; current public pages use `components/public/Brand.jsx`, and chat renders its own branding. |
| `frontend/src/components/shared/NavigationLink.jsx` | No callers; current public navigation uses its existing links directly. |
| `frontend/src/App.css` | Unimported Vite starter stylesheet; current entry points load `index.css`, `public.css`, and `public-theme.css`. |
| `frontend/src/assets/react.svg` | No source, HTML, configuration, or deployment reference; the active favicon/avatar asset is `public/logo.png`. |
| `backend/tmp-pf.mjs` | Unregistered one-off provider-failure probe that created an account and repeatedly submitted generation requests; legitimate API tests remain in `scripts/e2e-test.mjs`. |

The previously deleted `frontend/public/{aicircle,airobot,chatt,robot}.png`, `frontend/public/vite.svg`, and `frontend/src/components/typeranimation/Typinganimation.jsx` were already absent when this task began. This cleanup did not restore or delete them again. No PDFs, uploaded files, MongoDB records, Qdrant points, or real environment files were removed.

## Modified files

| File | Change |
|---|---|
| `frontend/src/helpers/api.js` | Removed uncalled `sendChatRequest`, `getUserChats`, `deleteUserChats`, and non-streaming `sendConversationMessage` wrappers. Active SSE, auth, document, memory, and conversation helpers remain. Kept error conversion private to its module. |
| `frontend/src/index.css` | Removed unused old logo/navigation/tilt/rotation rules and the unused Josefin Sans/Tektur font requests. Active layouts, chat styling, Markdown, scrollbars, and the Inter/Roboto/Fira Code fonts remain. |
| `backend/src/app.js` | Removed the unused Morgan import and commented-out logging setup; middleware and API mounts are unchanged. |
| `backend/src/db/connection.js` | Removed the unreferenced disconnect wrapper/import; active connection behavior is unchanged. The migration retains its own explicit disconnect handling. |
| `backend/src/config/rag.config.js` | Kept the environment-file path module-private; loading location and precedence are unchanged. |
| `backend/src/services/document-index.service.js` | Kept the stable chunk-point ID helper module-private; its algorithm and indexing behavior are unchanged. |
| `backend/src/services/gemini.service.js` | Removed unused external exports of the model constant, system instruction, and history converter. Their values, prompts, settings, and internal use are unchanged. |
| `backend/scripts/e2e-test.mjs` | Removed an unused variable and corrected its misleading account-cleanup comment. Test requests and assertions remain. |
| `backend/package.json` | Removed three unused packages and added `npm test` to run the two existing offline suites together. |
| `frontend/package.json` | Removed the unused animation dependency. |
| Both `package-lock.json` files | Updated with npm offline, without running lifecycle scripts. No retained package version or integrity changed. |
| `backend/.env.example` | Documented the already-used `NODE_ENV` setting with a development value. Real `.env` files were untouched. |
| `Readme.md` | Removed stale package/probe references, updated the project tree/theme description, and documented offline test commands and their limits. |
| `frontend/README.md` | Replaced unrelated TypeScript/Vite template instructions with the actual JavaScript frontend setup, source map, and verification commands. |
| `CLEANUP_REPORT.md` | Records removal evidence, retained compatibility code, checks, and limits. |

## Dependencies removed

- Backend: `openai` (no active provider call site), `concurrently` (no npm/script/tool reference), and `morgan` (logging middleware was already disabled).
- Frontend: `react-type-animation` (its old component was already deleted and no active module imports it).
- npm removed 33 backend lock entries and one frontend lock entry. No dependency was added or upgraded.

## Retained intentionally

- All 27 existing API routes, including `/api/v1/chat/*` and the non-streaming conversation endpoint. These are registered public contracts, are referenced by compatibility tests, and may have clients outside the current React application. Their frontend wrappers were unused; their server implementations are not dead code.
- `scripts/migrate-chats.js`, `User.chats`, `isLegacy`, and message legacy IDs. A migration's presence in the repository does not prove every deployed database has completed it; removing these could make older history inaccessible.
- Both Google SDKs. `@google/generative-ai` serves existing chat generation; `@google/genai` serves reduced-dimension embeddings. They are distinct active integrations.
- The npm `node` runtime package: its binary is available to npm scripts and preserves the existing Node 22 runtime setup used by PDF.js. Removing it would change runtime selection.
- Material UI's Emotion dependencies, Vite/SWC/ESLint tooling, Nodemon, useful offline/live tests, the Qdrant diagnostic/initializer, SPA redirects, and the actual logo asset.
- Both public stylesheets: one supplies active responsive layouts, the other applies shared chat-derived tokens. Dynamic feature-icon classes and optional component modifiers were not mistaken for unused CSS.
- Ignored `node_modules` and build output remain standard dependency/build directories. The requested frontend build regenerated `dist/`; no uploaded data directory was cleaned.

No additional file was deleted based on uncertain purpose. The remaining migration/compatibility code needs deployment/data/client inventory before any future removal.

## Checks performed and actual results

| Check | Result |
|---|---|
| `cd backend; npm test` | 18/18 passed: 10 offline auth/router tests and eight offline memory/chat-prompt tests. MongoDB and Gemini are mocked; memory tests block fetch. |
| `cd frontend; npm run build` | Passed. Existing warning: generated JavaScript chunk exceeds 500 kB. |
| `cd frontend; npm run lint` | Zero errors; two existing Fast Refresh export warnings in `AuthContent.jsx` and `ChatContext.jsx`. |
| Backend unused-import/variable inspection | Passed for source and maintained scripts. Backend has no configured npm lint command; the installed ESLint API was used for this focused check. |
| AST source/import/export audit | All 83 remaining modules parsed; no missing local imports, missing imported exports, or unreachable modules from application/script/tool roots. |
| API registration comparison | The app still mounts the API router, with the same five route groups and all 27 method/path entries as before cleanup. Fetch was blocked during inspection. |
| Offline PDF/RAG helper checks | Passed for non-empty/empty chunking, source page metadata, attachment readiness blocking, the 768-dimensional configuration constant, and mocked ready-document selection with authenticated owner and normalized document IDs. No PDF upload, vector generation, or external services were used. |
| Runtime environment documentation | All 16 variable names referenced by application source are covered by the two `.env.example` files. Optional live-test `TEST_BASE` remains documented separately. |
| `npm ls --depth=0` in both packages | Passed; declared dependencies resolve. |
| Lockfile comparison | No retained dependency version/integrity changes or newly added entries. |
| Removed-name/reference search | No stale references in application source, scripts, HTML, or build/lint configuration. Deletion names appear here intentionally as audit evidence. |

The temporary import-audit script and lock comparison snapshot were removed after use.

## Not verified and minimal remaining checks

The live `npm run test:api` suite, live MongoDB persistence, Qdrant connectivity/indexing, actual PDF extraction, Gemini completions, and embedding requests were not run. The live suite creates persistent accounts and can consume model quota, so it was retained for a disposable environment rather than executed during cleanup. Offline checks do not establish production readiness by themselves.

No migrations, credential changes, collection resets, or data cleanup are required for these changes. After deploying, use an existing account to check sign-in, one ordinary streamed conversation, and cross-chat recall. When quota permits, upload one small text PDF, wait for Ready, and ask one question with a known page citation. Run the retained live suite only against a disposable database if broader API verification is wanted.
