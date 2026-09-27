import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createSupportEmail, handleSupportRequest, validateSupportPayload } from "./support-email.mjs";

const valid = { category: "Customer", subject: "Help with a deal", message: "Please help me.",
  email: "visitor@example.org", website: "" };

function request(payload, extraHeaders = {}) {
  return new Request("https://app.spotnera.com/api/support", { method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://app.spotnera.com", ...extraHeaders },
    body: JSON.stringify(payload) });
}

test("valid payload is trimmed and creates fixed sender/recipient with validated Reply-To", () => {
  const checked = validateSupportPayload({ ...valid, subject: "  Help with a deal  ",
    message: "  Please help me.  ", email: "  visitor@example.org  " });
  assert.deepEqual(checked, { category: "Customer", subject: "Help with a deal",
    message: "Please help me.", email: "visitor@example.org" });
  const email = createSupportEmail(checked);
  assert.equal(email.from, "Spotnera Support <noreply@spotnera.com>");
  assert.deepEqual(email.to, ["support@spotnera.com"]);
  assert.equal(email.reply_to, "visitor@example.org");
  assert.match(email.text, /^Spotnera Support Request\n\nTopic: Customer\nSubject: Help with a deal\nReply email: visitor@example.org\n\nMessage:\nPlease help me\./);
  assert.deepEqual(Object.keys(email).sort(), ["from", "reply_to", "subject", "text", "to"]);
});

test("invalid topic, email, empty fields, and length limits are rejected", () => {
  for (const payload of [
    { ...valid, category: "Admin" },
    { ...valid, email: "bad@@example.org" },
    { ...valid, email: "visitor@example.org\nBcc: attacker@example.org" },
    { ...valid, subject: "  " },
    { ...valid, subject: "x".repeat(141) },
    { ...valid, subject: "Hello\nBcc: attacker@example.org" },
    { ...valid, message: " \n " },
    { ...valid, message: "x".repeat(2001) },
    { ...valid, email: `${"x".repeat(250)}@example.org` },
  ]) assert.equal(validateSupportPayload(payload), null);
});

test("honeypot and malformed JSON never reach the provider", async () => {
  let calls = 0;
  const fetchImpl = async () => { calls += 1; return Response.json({ id: "should-not-send" }); };
  assert.equal((await handleSupportRequest(request({ ...valid, website: "spam.example" }),
    { apiKey: "test-key", fetchImpl })).status, 400);
  const malformed = new Request("https://app.spotnera.com/api/support", { method: "POST",
    headers: { "Content-Type": "application/json" }, body: "{" });
  assert.equal((await handleSupportRequest(malformed, { apiKey: "test-key", fetchImpl })).status, 400);
  assert.equal(calls, 0);
});

test("client cannot override From, To, or Reply-To", async () => {
  let sent;
  const response = await handleSupportRequest(request({ ...valid, from: "attacker@example.org",
    to: "attacker@example.org", reply_to: "attacker@example.org" }), {
    apiKey: "test-key",
    fetchImpl: async (url, options) => {
      assert.equal(url, "https://api.resend.com/emails");
      assert.equal(options.method, "POST");
      assert.equal(options.headers.Authorization, "Bearer test-key");
      sent = JSON.parse(options.body);
      return Response.json({ id: "accepted-id" });
    },
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { sent: true });
  assert.equal(sent.from, "Spotnera Support <noreply@spotnera.com>");
  assert.deepEqual(sent.to, ["support@spotnera.com"]);
  assert.equal(sent.reply_to, valid.email);
});

test("missing key and provider failure return generic errors without secrets", async () => {
  let calls = 0;
  const noKey = await handleSupportRequest(request(valid), { apiKey: "", fetchImpl: async () => { calls += 1; } });
  assert.equal(noKey.status, 503);
  assert.equal(calls, 0);
  const failed = await handleSupportRequest(request(valid), { apiKey: "private-test-key",
    fetchImpl: async () => Response.json({ message: "provider secret details" }, { status: 401 }) });
  assert.equal(failed.status, 503);
  assert.deepEqual(await failed.json(), { error: "Unable to send message." });
  const thrown = await handleSupportRequest(request(valid), { apiKey: "private-test-key",
    fetchImpl: async () => { throw Error("provider secret details"); } });
  assert.equal(thrown.status, 503);
  assert.doesNotMatch(await thrown.text(), /private-test-key|provider secret details/);
});

test("cross-origin and oversized requests fail without provider calls", async () => {
  let calls = 0;
  const fetchImpl = async () => { calls += 1; return Response.json({ id: "unexpected" }); };
  assert.equal((await handleSupportRequest(request(valid, { Origin: "https://other.example" }),
    { apiKey: "test-key", fetchImpl })).status, 403);
  assert.equal((await handleSupportRequest(request({ ...valid, message: "x".repeat(9000) }),
    { apiKey: "test-key", fetchImpl })).status, 400);
  assert.equal(calls, 0);
});

test("route uses server-only environment key; example advertises the setting", () => {
  const route = readFileSync(new URL("../../app/api/support/route.js", import.meta.url), "utf8");
  const example = readFileSync(new URL("../../.env.example", import.meta.url), "utf8");
  assert.match(route, /process\.env\.RESEND_API_KEY/);
  assert.doesNotMatch(route, /NEXT_PUBLIC_|getUser|createClient/);
  assert.match(example, /^RESEND_API_KEY=$/m);
});
