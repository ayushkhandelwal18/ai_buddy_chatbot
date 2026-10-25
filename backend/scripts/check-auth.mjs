// Focused router checks. No sockets, real MongoDB, AI, or external services run.
import assert from "node:assert/strict";
import { after, before, test, mock } from "node:test";
import express from "express";
import cookieParser from "cookie-parser";
import { hash, compare } from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../src/models/user.model.js";
import userRoutes from "../src/routes/user.route.js";
import { verifyToken } from "../src/utils/token-manager.js";

const records = [];
let databaseFailure = false, duplicateRace = false;
let serial = 1;
const originalEnv = { JWT_SECRET: process.env.JWT_SECRET, COOKIE_SECRET: process.env.COOKIE_SECRET, NODE_ENV: process.env.NODE_ENV };
const identity = (record, fields) => !record ? null : {
  _id: record._id, name: record.name, email: record.email,
  ...(fields.includes("+password") ? { password: record.password } : {}),
};
const query = (lookup) => ({ async select(fields) {
  if (databaseFailure) throw new Error("Private database detail must stay internal");
  return identity(lookup(), fields);
} });

before(async () => {
  process.env.JWT_SECRET = "offline-auth-check-signing-secret";
  process.env.COOKIE_SECRET = "offline-auth-check-cookie-secret";
  process.env.NODE_ENV = "test";
  mock.method(User, "findOne", ({ email }) => query(() => records.find((record) => typeof email === "string" ? record.email === email : new RegExp(email.$regex, email.$options).test(record.email))));
  mock.method(User, "findById", (id) => query(() => records.find((record) => record._id === id)));
  mock.method(User, "create", async (data) => {
    if (duplicateRace) { const error = new Error("duplicate"); error.code = 11000; throw error; }
    const record = { ...data, _id: String(serial++).padStart(24, "0") };
    records.push(record);
    return record;
  });
});
after(async () => {
  mock.restoreAll();
  for (const [name, value] of Object.entries(originalEnv)) { if (value === undefined) delete process.env[name]; else process.env[name] = value; }
});
const request = (route, { body, cookie } = {}) => new Promise((resolve, reject) => {
  const req = { method: body ? "POST" : "GET", url: route.replace(/^\/user/, "") || "/", originalUrl: route,
    body: body ? JSON.parse(JSON.stringify(body)) : {}, headers: cookie ? { cookie } : {} };
  let setCookie = "";
  const res = { req, locals: {}, statusCode: 200,
    status(value) { this.statusCode = value; return this; },
    json(data) { resolve({ status: this.statusCode, data, setCookie, cookie: setCookie.split(";")[0] }); return this; },
    append(name, value) { if (name === "Set-Cookie") setCookie = value; return this; },
    cookie: express.response.cookie, clearCookie: express.response.clearCookie,
  };
  cookieParser(process.env.COOKIE_SECRET)(req, res, () => {
    if (route === "/identity") return verifyToken(req, res, () => res.json({ id: res.locals.jwtData.id }));
    userRoutes.handle(req, res, (error) => error ? reject(error) : reject(new Error("Unexpected route fallthrough")));
  });
});
let accountCookie;

test("signup hashes the password, issues the existing cookie session and exposes no credentials", async () => {
  const result = await request("/user/signup", { body: { name: " Test Person ", email: " Person@Example.com ", password: "test-password" } });
  assert.equal(result.status, 201);
  assert.equal(result.data.name, "Test Person"); assert.equal(result.data.email, "person@example.com");
  assert.ok(await compare("test-password", records[0].password));
  for (const field of ["password", "token", "chats"]) assert.ok(!(field in result.data));
  assert.match(result.setCookie, /HttpOnly/); assert.match(result.setCookie, /SameSite=Lax/);
  accountCookie = result.cookie;
  const session = await request("/identity", { cookie: accountCookie });
  assert.equal(session.data.id, records[0]._id);
});

test("duplicate email and a concurrent unique-index failure return safe 409 responses", async () => {
  const body = { name: "Another", email: "PERSON@example.com", password: "another-password" };
  assert.equal((await request("/user/signup", { body })).status, 409);
  duplicateRace = true;
  try { assert.equal((await request("/user/signup", { body: { ...body, email: "race@example.com" } })).status, 409); }
  finally { duplicateRace = false; }
  assert.equal(records.length, 1);
});

test("login reuses the account ID and does not accept a frontend user ID", async () => {
  const result = await request("/user/login", { body: { email: "PERSON@example.com", password: "test-password", userId: "ffffffffffffffffffffffff" } });
  assert.equal(result.status, 200); assert.ok(!result.data.token);
  assert.equal((await request("/identity", { cookie: result.cookie })).data.id, records[0]._id);
});

test("incorrect credentials have the same safe response", async () => {
  const wrong = await request("/user/login", { body: { email: "person@example.com", password: "incorrect" } });
  const absent = await request("/user/login", { body: { email: "missing@example.com", password: "incorrect" } });
  assert.equal(wrong.status, 401); assert.equal(absent.status, 401); assert.deepEqual(wrong.data, absent.data);
});

test("existing mixed-case email accounts keep their identity", async () => {
  const legacy = { _id: "eeeeeeeeeeeeeeeeeeeeeeee", name: "Legacy", email: "Legacy.Person@Example.com", password: await hash("legacy-password", 10) };
  records.push(legacy);
  const result = await request("/user/login", { body: { email: "legacy.person@example.com", password: "legacy-password" } });
  assert.equal(result.status, 200);
  assert.equal((await request("/identity", { cookie: result.cookie })).data.id, legacy._id);
  assert.equal((await request("/user/signup", { body: { name: "Copy", email: "LEGACY.PERSON@example.com", password: "some-password" } })).status, 409);
  const longPassword = "legacy-password-".repeat(6);
  records.push({ _id: "dddddddddddddddddddddddd", name: "Legacy Long", email: "legacy-long@example.com", password: await hash(longPassword, 10) });
  assert.equal((await request("/user/login", { body: { email: "legacy-long@example.com", password: longPassword } })).status, 200);
});

test("server validation rejects malformed/oversized input without echoing passwords", async () => {
  for (const body of [
    { name: " ", email: "valid@example.com", password: "good-password" },
    { name: "Valid", email: { $ne: null }, password: "good-password" },
    { name: "Valid", email: "valid@example.com", password: "short" },
    { name: "Valid", email: "valid@example.com", password: "a".repeat(73) },
  ]) {
    const result = await request("/user/signup", { body });
    assert.equal(result.status, 422); assert.ok(result.data.errors.length);
    assert.ok(!result.data.errors.some((error) => "value" in error));
    assert.ok(!JSON.stringify(result.data).includes(body.password));
  }
});

test("account listing requires authentication and returns only the caller's public fields", async () => {
  assert.equal((await request("/user")).status, 401);
  const result = await request("/user", { cookie: accountCookie });
  assert.equal(result.status, 200); assert.equal(result.data.data.length, 1);
  assert.equal(result.data.data[0].id, records[0]._id);
  assert.deepEqual(Object.keys(result.data.data[0]).sort(), ["email", "id", "name"]);
  assert.equal((await request("/user/auth-status", { cookie: accountCookie })).data.email, "person@example.com");
});

test("invalid and expired JWTs return 401 without leaking token errors", () => {
  for (const token of [false, "not-a-jwt", jwt.sign({ id: records[0]._id, email: records[0].email }, process.env.JWT_SECRET, { expiresIn: -1 })]) {
    let status, data;
    verifyToken({ signedCookies: { auth_token: token } }, { locals: {}, status(value) { status = value; return this; }, json(value) { data = value; } }, () => assert.fail("Invalid JWT accepted"));
    assert.equal(status, 401); assert.ok(!data.message.includes("jwt"));
  }
});

test("production session flags, seven-day JWT expiry, and logout are preserved", async () => {
  process.env.NODE_ENV = "production";
  try {
    const result = await request("/user/login", { body: { email: "person@example.com", password: "test-password" } });
    assert.match(result.setCookie, /Secure/); assert.match(result.setCookie, /SameSite=None/); assert.match(result.setCookie, /HttpOnly/);
    const logout = await request("/user/logout", { cookie: result.cookie });
    assert.equal(logout.status, 200); assert.match(logout.setCookie, /Expires=Thu, 01 Jan 1970/);
    // Read the payload inside the mock response only; never print its token.
    const signed = decodeURIComponent(result.cookie.split("=").slice(1).join("="));
    const token = signed.slice(2, signed.lastIndexOf("."));
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    assert.equal(payload.exp - payload.iat, 7 * 86400);
  } finally { process.env.NODE_ENV = "test"; }
});

test("database failures use a non-success status and safe diagnostics", async () => {
  databaseFailure = true;
  const log = mock.method(console, "error", () => {});
  try {
    const result = await request("/user/login", { body: { email: "person@example.com", password: "test-password" } });
    assert.equal(result.status, 503); assert.ok(!JSON.stringify(result.data).includes("Private database"));
    assert.ok(!JSON.stringify(log.mock.calls).includes("Private database"));
  } finally { databaseFailure = false; log.mock.restore(); }
});
