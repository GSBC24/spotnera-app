import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { copySupportText, prepareSupportMessage, SUPPORT_CATEGORIES, SUPPORT_EMAIL } from "./support-contact.mjs";

test("support uses the official email and prepares a categorized mailto draft", () => {
  assert.equal(SUPPORT_EMAIL, "support@spotnera.com");
  assert.deepEqual(SUPPORT_CATEGORIES, ["Customer", "Business", "Account", "Deal", "Notifications", "Other"]);
  const draft = prepareSupportMessage({ category: "Deal", subject: "Calendar & hours",
    message: "Monday 09:00–15:00\nWednesday 17:00–20:00", replyEmail: "visitor@example.org" });
  assert.ok(draft.mailto.startsWith(`mailto:${SUPPORT_EMAIL}?`));
  const params = new URL(draft.mailto).searchParams;
  assert.equal(params.get("subject"), "Spotnera Support — Deal: Calendar & hours");
  assert.match(params.get("body"), /Category: Deal\n\nMonday 09:00–15:00/);
  assert.match(params.get("body"), /Reply email: visitor@example\.org/);
  assert.match(draft.copyText, /^To: support@spotnera\.com/);
  assert.doesNotMatch(draft.mailto, /customer_id|user_id|tracking/i);
});

test("support draft tolerates anonymous use and strips subject header line breaks", () => {
  const draft = prepareSupportMessage({ category: "Unknown", subject: "Hello\nBcc: stranger@example.org",
    message: "Please help" });
  assert.equal(new URL(draft.mailto).searchParams.get("subject"),
    "Spotnera Support — Other: Hello Bcc: stranger@example.org");
  assert.doesNotMatch(draft.body, /Reply email:/);
});

test("copy helper reports success, unavailable clipboard, and failure", async () => {
  let copied = "";
  assert.equal(await copySupportText(SUPPORT_EMAIL, { writeText: async (value) => { copied = value; } }), true);
  assert.equal(copied, SUPPORT_EMAIL);
  assert.equal(await copySupportText(SUPPORT_EMAIL, undefined), false);
  assert.equal(await copySupportText(SUPPORT_EMAIL, { writeText: async () => { throw Error("blocked"); } }), false);
});

test("contact UI keeps the email visible and never claims a support ticket was submitted", () => {
  const ui = readFileSync(new URL("../components/support-contact.js", import.meta.url), "utf8");
  assert.match(ui, /\{SUPPORT_EMAIL\}/);
  assert.match(ui, /Copy email/);
  assert.match(ui, /Copy message/);
  assert.match(ui, /Spotnera has not received a message yet/);
  assert.match(ui, /select-text/);
  assert.doesNotMatch(ui, /ticket submitted|message sent successfully|fetch\(|server action/i);
});
