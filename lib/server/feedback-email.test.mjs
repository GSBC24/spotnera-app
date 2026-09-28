import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { FEEDBACK_QUESTIONS } from "../feedback.mjs";
import { createFeedbackEmail, handleFeedbackRequest, validateFeedbackPayload } from "./support-email.mjs";

const answers = Object.fromEntries(FEEDBACK_QUESTIONS.map((question) =>
  [question.id, question.type === "choice" ? question.options[0] : `Answer <${question.id}> & detail`]));
const valid = { businessName: "Cafe <North> & Co", contactName: "Ada", email: "ada@example.org",
  phone: "+47 123 45 678", answers, website: "" };

function request(payload, extraHeaders = {}) {
  return new Request("https://app.spotnera.com/api/feedback", { method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://app.spotnera.com", ...extraHeaders },
    body: JSON.stringify(payload) });
}

test("feedback validates ten answers, required business, and optional contact fields", () => {
  assert.equal(FEEDBACK_QUESTIONS.length, 10);
  assert.equal(validateFeedbackPayload(valid).businessName, valid.businessName);
  const anonymous = validateFeedbackPayload({ businessName: " Cafe ", answers });
  assert.equal(anonymous.businessName, "Cafe");
  assert.equal(anonymous.email, "");
  assert.equal(anonymous.phone, "");
  for (const payload of [
    { ...valid, businessName: " " },
    { ...valid, email: "invalid@@example.org" },
    { ...valid, email: "hello@example.org\nBcc: bad@example.org" },
    { ...valid, phone: "not a number" },
    { ...valid, phone: "1".repeat(41) },
    { ...valid, website: "spam.example" },
    { ...valid, answers: { ...answers, q1: " " } },
    { ...valid, answers: { ...answers, q2: "Excellent" } },
    { ...valid, answers: { ...answers, q10: "x".repeat(501) } },
  ]) assert.equal(validateFeedbackPayload(payload), null);
});

test("feedback email is branded, escaped, complete, and uses optional Reply-To", () => {
  const email = createFeedbackEmail(validateFeedbackPayload(valid), new Date("2026-09-29T09:00:00.000Z"));
  assert.equal(email.from, "Spotnera Support <noreply@spotnera.com>");
  assert.deepEqual(email.to, ["support@spotnera.com"]);
  assert.equal(email.reply_to, valid.email);
  assert.equal(email.subject, `[Spotnera] Business Feedback — ${valid.businessName}`);
  assert.match(email.html, /BUSINESS FEEDBACK/);
  assert.match(email.html, /Cafe &lt;North&gt; &amp; Co/);
  assert.match(email.html, /Answer &lt;q1&gt; &amp; detail/);
  assert.match(email.html, /src="https:\/\/app\.spotnera\.com\/icons\/spotnera-icon-192\.png"/);
  assert.match(email.html, /Submitted/);
  assert.match(email.text, /2026-09-29T09:00:00.000Z/);
  for (const question of FEEDBACK_QUESTIONS) {
    assert.ok(email.html.includes(question.label));
    assert.ok(email.text.includes(question.label));
    assert.ok(email.text.includes(answers[question.id]));
  }
  assert.doesNotMatch(email.html, /®|&reg;|&#174;|<script|<link\b|class=|pixel|tracking/i);
  assert.equal((email.html.match(/<img\b/g) ?? []).length, 1);
  const noContact = createFeedbackEmail(validateFeedbackPayload({ businessName: "Cafe", answers }));
  assert.equal(Object.hasOwn(noContact, "reply_to"), false);
  assert.doesNotMatch(noContact.html, /Reply to this email/);
  assert.doesNotMatch(noContact.text, /Contact name:|Email:|Phone:/);
});

test("feedback route uses shared origin, honeypot, limits, provider handling, and no database", async () => {
  let sends = 0;
  const fetchImpl = async (url, options) => {
    sends += 1;
    assert.equal(url, "https://api.resend.com/emails");
    const email = JSON.parse(options.body);
    assert.deepEqual(email.to, ["support@spotnera.com"]);
    assert.equal(email.reply_to, valid.email);
    return Response.json({ id: "accepted" });
  };
  assert.equal((await handleFeedbackRequest(request(valid), { apiKey: "test-key", fetchImpl })).status, 200);
  assert.equal(sends, 1);
  for (const badRequest of [
    request({ ...valid, website: "spam.example" }),
    request(valid, { Origin: "https://other.example" }),
    request({ ...valid, answers: { ...answers, q1: "x".repeat(9_000) } }),
    request({ ...valid, email: "bad" }),
  ]) assert.notEqual((await handleFeedbackRequest(badRequest, { apiKey: "test-key", fetchImpl })).status, 200);
  assert.equal(sends, 1);
  assert.equal((await handleFeedbackRequest(request(valid), { apiKey: "" })).status, 503);
  const failed = await handleFeedbackRequest(request(valid), { apiKey: "test-key", fetchImpl: async () => Response.json({ error: "no" }, { status: 503 }) });
  assert.equal(failed.status, 503);
  const route = readFileSync(new URL("../../app/api/feedback/route.js", import.meta.url), "utf8");
  assert.match(route, /process\.env\.RESEND_API_KEY/);
  assert.doesNotMatch(route, /createClient|supabase|\.from\(|insert\(/i);
});
