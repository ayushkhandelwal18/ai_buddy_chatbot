# AI-Buddy frontend

React 19 + Vite client for the existing AI-Buddy API. See the [project README](../Readme.md) for backend setup, environment variables, API contracts, PDF RAG, and persistent memory.

## Local development

Copy `.env.example` to a local `.env` and set `VITE_API_URL` to the API origin including `/api/v1`. Keep it aligned with the backend's `FRONTEND_URL` cookie/CORS configuration. Never place provider or database secrets in Vite variables.

```sh
npm install
npm run dev
```

## Checks and production output

```sh
npm run lint
npm run build
```

Vite writes the production build to ignored `dist/`. The `public/_redirects` SPA fallback supports hosts that recognize that format; configure the equivalent fallback on other hosts.

## Source map

- `src/App.jsx`: existing public and protected workspace routes.
- `src/theme.js`: shared dark Material UI theme.
- `src/public.css` and `src/public-theme.css`: public layouts and styles derived from the chat theme.
- `src/components/public/`: shared brand, preview, and login/signup forms.
- `src/components/chat/`: active workspace, attachments, sources, and memory management.
- `src/context/`: authentication, conversations, streaming, and PDF attachment state.
- `src/helpers/api.js`: active REST helpers and POST SSE transport.

Login/signup use the existing email/password cookie session. The workspace uses the conversation/message API; the backend still retains its older chat endpoints for compatibility. The frontend does not need those legacy transport wrappers.
