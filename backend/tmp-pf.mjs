const BASE = "http://localhost:3000/api/v1";
const jar = new Map();
const cookieHeader = () => [...jar.entries()].map(([k,v]) => `${k}=${v}`).join("; ");
async function req(path, { method = "GET", body, raw = false } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(jar.size ? { Cookie: cookieHeader() } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  for (const c of (res.headers.getSetCookie?.() || [])) {
    const [pair] = c.split(";"); const i = pair.indexOf("=");
    jar.set(pair.slice(0,i).trim(), pair.slice(i+1).trim());
  }
  const text = await res.text();
  return raw ? { status: res.status, text } : { status: res.status, json: JSON.parse(text) };
}
(async () => {
  const email = `pf-${Date.now()}@example.com`;
  await req("/user/signup", { method: "POST", body: { name: "PF", email, password: "secret123" } });
  const c = await req("/conversations", { method: "POST", body: {} });
  const id = c.json.conversation.id;
  console.log("--- POST /conversations/:id/messages (provider down) ---");
  for (let i = 0; i < 3; i++) {
    const r = await req(`/conversations/${id}/messages`, { method: "POST", body: { message: "hi" } });
    console.log(`  run ${i + 1}: status=${r.status} ${JSON.stringify(r.json).slice(0,90)}`);
  }
  console.log("--- POST /chat/new (legacy, provider down) ---");
  for (let i = 0; i < 3; i++) {
    const r = await req("/chat/new", { method: "POST", body: { message: "hi" } });
    console.log(`  run ${i + 1}: status=${r.status} ${JSON.stringify(r.json).slice(0,90)}`);
  }
})();
