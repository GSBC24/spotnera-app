import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { FEEDBACK_QUESTIONS, submitFeedback } from "./feedback.mjs";

const page = readFileSync(new URL("../app/feedback/page.js", import.meta.url), "utf8");
const form = readFileSync(new URL("../components/feedback-form.js", import.meta.url), "utf8");
const owner = readFileSync(new URL("../app/owner/page.js", import.meta.url), "utf8");

test("feedback page and one-step form expose all questions and owner entry", () => {
  assert.match(page, /Help us improve Spotnera™/);
  assert.match(page, /<FeedbackForm \/>/);
  assert.match(form, /FEEDBACK_QUESTIONS\.map/);
  assert.equal(FEEDBACK_QUESTIONS.length, 10);
  assert.match(form, /Business name\s*<input required/);
  assert.match(form, /type="email" maxLength=\{254\}/);
  assert.match(form, /type="tel" maxLength=\{40\}/);
  assert.match(form, /Submit feedback/);
  assert.match(form, /Thank you!/);
  assert.match(form, /Your feedback has been sent successfully/);
  assert.match(form, /submissionLockRef\.current = true/);
  assert.match(form, /disabled=\{status === "sending"\}/);
  assert.match(form, /setStatus\("error"\)/);
  assert.match(form, /Your answers are still here/);
  assert.match(owner, /href="\/feedback"[^>]*>Give feedback<\/Link>/);
});

test("client reports success only after server accepts delivery", async () => {
  const payload = { businessName: "Cafe", answers: {} };
  assert.equal(await submitFeedback(payload, async (url, options) => {
    assert.equal(url, "/api/feedback");
    assert.equal(options.method, "POST");
    assert.deepEqual(JSON.parse(options.body), payload);
    return Response.json({ sent: true });
  }), true);
  assert.equal(await submitFeedback(payload, async () => Response.json({ sent: false })), false);
  assert.equal(await submitFeedback(payload, async () => Response.json({ error: "failed" }, { status: 503 })), false);
  assert.equal(await submitFeedback(payload, async () => { throw Error("network"); }), false);
});
