import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { copySupportText, submitSupportForm, SUPPORT_CATEGORIES, SUPPORT_EMAIL } from "./support-contact.mjs";

test("support still uses the official visible fallback address and allowed topics", () => {
  assert.equal(SUPPORT_EMAIL, "support@spotnera.com");
  assert.deepEqual(SUPPORT_CATEGORIES, ["Customer", "Business", "Account", "Deal", "Notifications", "Other"]);
  const ui = readFileSync(new URL("../components/support-contact.js", import.meta.url), "utf8");
  assert.match(ui, /\{SUPPORT_EMAIL\}/);
  assert.match(ui, /select-text/);
  assert.match(ui, /Copy email/);
  assert.match(ui, /type="email" required/);
  assert.match(ui, /Phone number/);
  assert.match(ui, /type="tel" autoComplete="tel" maxLength=\{40\}/);
  assert.match(ui, /category, subject, message, email, phone, website/);
  assert.doesNotMatch(ui, /Open email app|Copy message/);
});

test("client returns success only after a successful server response", async () => {
  const payload = { category: "Deal", subject: "Question", message: "Please help", email: "visitor@example.org", website: "" };
  let called = 0;
  const success = await submitSupportForm(payload, async (url, options) => {
    called += 1;
    assert.equal(url, "/api/support");
    assert.equal(options.method, "POST");
    assert.deepEqual(JSON.parse(options.body), payload);
    return Response.json({ sent: true });
  });
  assert.equal(called, 1);
  assert.equal(success, true);
  assert.equal(await submitSupportForm(payload, async () => Response.json({ sent: false })), false);
  assert.equal(await submitSupportForm(payload, async () => Response.json({ error: "provider secret" }, { status: 503 })), false);
  assert.equal(await submitSupportForm(payload, async () => { throw Error("network failure"); }), false);
});

test("UI locks duplicate submits and keeps sending, success, and error states honest", () => {
  const ui = readFileSync(new URL("../components/support-contact.js", import.meta.url), "utf8");
  assert.match(ui, /submissionLockRef\.current \|\| status === "success"/);
  assert.match(ui, /submissionLockRef\.current = true/);
  assert.match(ui, /setStatus\("sending"\)/);
  assert.match(ui, /if \(sent\) \{/);
  assert.match(ui, /setStatus\("success"\)/);
  assert.match(ui, /setStatus\("error"\)/);
  assert.match(ui, /disabled=\{status === "sending" \|\| status === "success"\}/);
  assert.match(ui, /Sending\.\.\./);
  assert.match(ui, /Message sent\./);
  assert.match(ui, /We couldn&apos;t send your message/);
});

test("copy helper reports success, unavailable clipboard, and failure", async () => {
  let copied = "";
  assert.equal(await copySupportText(SUPPORT_EMAIL, { writeText: async (value) => { copied = value; } }), true);
  assert.equal(copied, SUPPORT_EMAIL);
  assert.equal(await copySupportText(SUPPORT_EMAIL, undefined), false);
  assert.equal(await copySupportText(SUPPORT_EMAIL, { writeText: async () => { throw Error("blocked"); } }), false);
});
