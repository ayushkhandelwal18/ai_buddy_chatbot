/* End-to-end API test for the AI-Buddy backend (run against a live server).
 *
 * Usage:
 *   npm start                       # in one terminal
 *   npm run test:api                # in another one
 *   TEST_BASE=http://localhost:3000/api/v1 npm run test:api
 *
 * The suite creates throw-away users and cleans up after itself. Checks that
 * need the AI provider are reported as SKIP when the provider is unreachable
 * (for example when the Gemini free-tier quota is exhausted).
 */
const BASE = process.env.TEST_BASE || "http://localhost:3000/api/v1";

const jar = new Map();

function cookieHeader() {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function req(path, { method = "GET", body, raw = false } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(jar.size ? { Cookie: cookieHeader() } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const setCookie = res.headers.getSetCookie?.() || [];
  for (const c of setCookie) {
    const [pair] = c.split(";");
    const idx = pair.indexOf("=");
    jar.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
  }

  if (raw) return { res, text: await res.text() };

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { _raw: text };
  }
  return { status: res.status, json };
}

let failures = 0;
let skipped = 0;
let aiAvailable = true;
const check = (label, cond, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${extra ? ` :: ${extra}` : ""}`);
  if (!cond) failures += 1;
};
const skip = (label, reason = "") => {
  console.log(`SKIP  ${label}${reason ? ` :: ${reason}` : ""}`);
  skipped += 1;
};

const unique = Date.now();

(async () => {
  /* ---------------------------- 1. auth ---------------------------------- */
  const emailA = `test-a-${unique}@example.com`;
  const emailB = `test-b-${unique}@example.com`;

  let r = await req("/user/signup", {
    method: "POST",
    body: { name: "Test A", email: emailA, password: "secret123" },
  });
  check("signup A", r.status === 201, JSON.stringify(r.json));

  r = await req("/user/auth-status");
  check("auth-status A", r.status === 200 && r.json.email === emailA, JSON.stringify(r.json));

  const jarA = new Map(jar); // keep A's cookies

  /* -------------------------- 2. conversations ---------------------------- */
  r = await req("/conversations", { method: "POST", body: {} });
  check("create conversation", r.status === 201 && !!r.json.conversation?.id, JSON.stringify(r.json));
  const convId = r.json.conversation.id;

  r = await req("/conversations", { method: "POST", body: { title: "My custom title" } });
  check("create titled conversation", r.status === 201 && r.json.conversation.title === "My custom title");
  const titledId = r.json.conversation.id;

  r = await req("/conversations");
  check("list conversations", r.status === 200 && r.json.conversations.length >= 2, `n=${r.json.conversations?.length}`);

  r = await req(`/conversations/${convId}`);
  check("get conversation", r.status === 200 && r.json.conversation.id === convId);

  r = await req(`/conversations/${convId}`, { method: "PATCH", body: { title: "Renamed chat" } });
  check("rename conversation", r.status === 200 && r.json.conversation.title === "Renamed chat");

  r = await req(`/conversations/${convId}`, { method: "PATCH", body: { title: "" } });
  check("rename rejects empty title (422)", r.status === 422, `status=${r.status}`);

  r = await req("/conversations/not-a-mongo-id");
  check("invalid id rejected (422)", r.status === 422, `status=${r.status}`);

  /* ------------------------- 3. messages --------------------------------- */
  r = await req(`/conversations/${convId}/messages`, {
    method: "POST",
    body: { message: "Hi there! Reply with exactly: ACK-1" },
  });
  const providerDown = r.status === 503;
  if (!providerDown) {
    check(
      "send message",
      r.status === 201 && !!r.json.assistantMessage?.content,
      JSON.stringify(r.json).slice(0, 300)
    );
  }

  if (providerDown || r.status !== 201 || !r.json.assistantMessage?.content) {
    // The AI provider is unreachable (e.g. Gemini free-tier quota exhausted).
    // Everything that depends on a model answer is reported as SKIP.
    aiAvailable = false;
    skip("reply mentions ACK-1", r.json?.message);
    skip("auto title generated", r.json?.message);
    skip("list messages", r.json?.message);
    skip("message order user->assistant", r.json?.message);
  } else {
    check("reply mentions ACK-1", /ACK-1/.test(r.json.assistantMessage?.content || ""), r.json.assistantMessage?.content);
    check("auto title generated", r.json.conversation?.title && r.json.conversation.title !== "New chat", r.json.conversation?.title);

    r = await req(`/conversations/${convId}/messages`);
    check("list messages", r.status === 200 && r.json.messages.length === 2, `n=${r.json.messages?.length}`);
    check("message order user->assistant", r.json.messages[0].role === "user" && r.json.messages[1].role === "assistant");
  }

  r = await req(`/conversations/${convId}/messages`, { method: "POST", body: { message: "   " } });
  check("empty message rejected (422)", r.status === 422, `status=${r.status}`);

  /* --------------------- 4. context / follow-up -------------------------- */
  if (aiAvailable) {
    r = await req(`/conversations/${convId}/messages`, {
      method: "POST",
      body: { message: "What was the exact token I asked you to reply with? Answer with just the token." },
    });
    check(
      "context retained across turns",
      /ACK-1/.test(r.json.assistantMessage?.content || ""),
      r.json.assistantMessage?.content
    );

    /* --------------------------- 5. regenerate ------------------------------ */
    const userMsgId = r.json.userMessage.id;
    r = await req(`/conversations/${convId}/messages/${userMsgId}/regenerate`, { method: "POST" });
    check("regenerate", r.status === 201 && !!r.json.assistantMessage?.content, JSON.stringify(r.json).slice(0, 200));

    r = await req(`/conversations/${convId}/messages`);
    check("regenerate replaced answer", r.json.messages.length === 4, `n=${r.json.messages.length}`);

    /* ---------------------------- 6. streaming ------------------------------ */
    const stream = await req(`/conversations/${convId}/messages/stream`, {
      method: "POST",
      body: { message: "Stream me the numbers 1 to 5 separated by spaces." },
      raw: true,
    });
    check("stream content-type", stream.res.headers.get("content-type")?.includes("text/event-stream"), stream.res.headers.get("content-type"));
    check("stream body has deltas + DONE", stream.text.includes('"type":"delta"') && stream.text.includes("[DONE]"), stream.text.slice(0, 200));
    const streamed = [...stream.text.matchAll(/data: (.+)/g)].map((m) => m[1]);
    check("stream emitted content", streamed.some((s) => s.includes("1") && s.includes("5")));

    r = await req(`/conversations/${convId}/messages`);
    check("streamed answer persisted", r.json.messages.length === 6, `n=${r.json.messages.length}`);
  } else {
    skip("context retained across turns");
    skip("regenerate");
    skip("regenerate replaced answer");
    skip("stream content-type");
    skip("stream body has deltas + DONE");
    skip("stream emitted content");
    skip("streamed answer persisted");
  }

  /* -------------------------- 7. authorization ---------------------------- */
  // Switch to user B
  jar.clear();
  r = await req("/user/signup", { method: "POST", body: { name: "Test B", email: emailB, password: "secret123" } });
  check("signup B", r.status === 201);

  r = await req(`/conversations/${convId}`);
  check("B cannot read A's conversation (404)", r.status === 404, `status=${r.status}`);

  r = await req(`/conversations/${convId}/messages`);
  check("B cannot read A's messages (404)", r.status === 404, `status=${r.status}`);

  r = await req(`/conversations/${convId}/messages`, { method: "POST", body: { message: "hijack" } });
  check("B cannot post to A's conversation (404)", r.status === 404, `status=${r.status}`);

  r = await req(`/conversations/${convId}`, { method: "PATCH", body: { title: "hijack" } });
  check("B cannot rename A's conversation (404)", r.status === 404, `status=${r.status}`);

  r = await req(`/conversations/${convId}`, { method: "DELETE" });
  check("B cannot delete A's conversation (404)", r.status === 404, `status=${r.status}`);

  r = await req("/conversations");
  check("B sees no conversations", r.status === 200 && r.json.conversations.length === 0, `n=${r.json.conversations?.length}`);

  /* --------------------------- 8. no auth -------------------------------- */
  jar.clear();
  r = await req("/conversations");
  check("unauthenticated list rejected (401)", r.status === 401, `status=${r.status}`);
  r = await req("/conversations", { method: "POST", body: {} });
  check("unauthenticated create rejected (401)", r.status === 401, `status=${r.status}`);

  /* --------------------- 9. legacy endpoints still work ------------------- */
  jar.clear();
  for (const [k, v] of jarA) jar.set(k, v);
  r = await req("/chat/new", { method: "POST", body: { message: "Legacy endpoint check" } });
  if (aiAvailable) {
    check("legacy POST /chat/new", r.status === 200 && Array.isArray(r.json.chats), JSON.stringify(r.json).slice(0, 200));
  } else {
    // The legacy endpoint now surfaces provider failures as a 503.
    check(
      "legacy POST /chat/new reports provider failure cleanly",
      r.status === 503 && !!r.json.message,
      JSON.stringify(r.json).slice(0, 200)
    );
  }

  r = await req("/chat/all-chats?limit=10&skip=0");
  check("legacy GET /chat/all-chats", r.status === 200 && Array.isArray(r.json.chats) && "hasMore" in r.json);

  r = await req("/chat/delete", { method: "DELETE" });
  check("legacy DELETE /chat/delete", r.status === 200 && r.json.message === "OK");

  /* --------------------------- 10. delete all ----------------------------- */
  r = await req("/conversations", { method: "DELETE" });
  check("delete all conversations", r.status === 200, JSON.stringify(r.json));
  r = await req("/conversations");
  check("no conversations left", r.json.conversations.length === 0);

  console.log(
    `\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}` +
      (skipped ? ` (${skipped} skipped — AI provider unavailable)` : "")
  );
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => {
  console.error("TEST CRASHED:", e);
  process.exit(1);
});
