import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { copyPremiumEmail, getPremiumContactEmail, getPremiumMailto,
  submitPremiumInquiry } from "./premium-contact.mjs";

const page = readFileSync(new URL("../app/owner/premium/page.js", import.meta.url), "utf8");
const actions = readFileSync(new URL("../components/premium-contact-actions.js", import.meta.url), "utf8");
const form = readFileSync(new URL("../components/premium-inquiry-form.js", import.meta.url), "utf8");

test("contact address uses configured email, legal fallback, then safe no-email state", () => {
  assert.equal(getPremiumContactEmail(" premium@example.org ", "legal@example.org"), "premium@example.org");
  assert.equal(getPremiumContactEmail("", "legal@example.org"), "legal@example.org");
  assert.equal(getPremiumContactEmail("invalid?subject=bad", "legal@example.org"), "legal@example.org");
  assert.equal(getPremiumContactEmail("", ""), "");
  assert.equal(getPremiumMailto("premium@example.org"), "mailto:premium@example.org?subject=Spotnera%20Premium");
});

test("copy action reports success, denial, and missing Clipboard API", async () => {
  let copied = "";
  assert.equal(await copyPremiumEmail("premium@example.org", { writeText: async (value) => { copied = value; } }), true);
  assert.equal(copied, "premium@example.org");
  assert.equal(await copyPremiumEmail("premium@example.org", { writeText: async () => { throw Error("denied"); } }), false);
  assert.equal(await copyPremiumEmail("premium@example.org", undefined), false);
});

test("Premium page remains Coming soon and retains visible support fallback", () => {
  assert.match(page, /Coming soon/);
  assert.match(page, /<PremiumInquiryForm \/>/);
  assert.match(page, /<PremiumContactActions email=\{SUPPORT_EMAIL\}/);
  assert.match(actions, /\{email\}/);
  assert.match(actions, /Copy email/);
  assert.match(actions, /role="status" aria-live="polite"/);
  assert.match(actions, /type="button"/);
  assert.match(form, /Contact name/);
  assert.match(form, /Business name/);
  assert.match(form, /Phone number/);
  assert.match(form, /Optional/);
  assert.match(form, /Thanks for your interest in Spotnera Premium/);
  assert.match(form, /setStatus\("error"\)/);
  assert.doesNotMatch(form, /createClient|supabase|profile|payment|checkout/i);
});

test("Premium form client sends only an accepted inquiry", async () => {
  const payload = { contactName: "Ada", businessName: "Cafe", email: "ada@example.org",
    phone: "", message: "Please contact me", website: "" };
  assert.equal(await submitPremiumInquiry(payload, async (url, options) => {
    assert.equal(url, "/api/premium-inquiry");
    assert.equal(options.method, "POST");
    assert.deepEqual(JSON.parse(options.body), payload);
    return Response.json({ sent: true });
  }), true);
  assert.equal(await submitPremiumInquiry(payload,
    async () => Response.json({ sent: false })), false);
});
