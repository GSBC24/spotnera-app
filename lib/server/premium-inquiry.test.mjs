import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createPremiumEmail, handlePremiumRequest,
  validatePremiumPayload } from "./support-email.mjs";

const valid = { contactName: "Ada <Owner>", businessName: "Café & Co",
  email: "ada@example.org", message: "I'd like to know more.\nPlease reply.", website: "" };

function request(payload, extraHeaders = {}) {
  return new Request("https://app.spotnera.com/api/premium-inquiry", { method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://app.spotnera.com",
      ...extraHeaders }, body: JSON.stringify(payload) });
}

test("valid Premium inquiry uses fixed sender/recipient and customer Reply-To", () => {
  const checked = validatePremiumPayload({ ...valid, contactName: "  Ada <Owner>  ",
    businessName: "  Café & Co  ", phone: "  +47 123 45 678  " });
  assert.equal(checked.contactName, "Ada <Owner>");
  assert.equal(checked.businessName, "Café & Co");
  assert.equal(checked.phone, "+47 123 45 678");
  const email = createPremiumEmail(checked);
  assert.equal(email.from, "Spotnera Support <noreply@spotnera.com>");
  assert.deepEqual(email.to, ["support@spotnera.com"]);
  assert.equal(email.reply_to, "ada@example.org");
  assert.equal(email.subject, "Spotnera Premium inquiry — Café & Co");
  assert.match(email.text, /^PREMIUM INQUIRY\n\nBusiness: Café & Co\nContact name: Ada <Owner>\nEmail: ada@example.org\nPhone: \+47 123 45 678\n\nMessage:/);
  assert.match(email.html, /PREMIUM INQUIRY/);
  assert.match(email.html, /Ada &lt;Owner&gt;/);
  assert.match(email.html, /Café &amp; Co/);
  assert.match(email.html, /I&#39;d like to know more\.<br>Please reply\./);
  assert.match(email.html, /src="https:\/\/app\.spotnera\.com\/icons\/spotnera-icon-192\.png"/);
  assert.equal((email.html.match(/<img\b/g) ?? []).length, 1);
  assert.doesNotMatch(email.html, /®|&reg;|&#174;|<script|<link\b|class=|data:image|pixel/i);
});

test("phone is optional and invalid email, phone, or required fields are rejected", () => {
  const without = createPremiumEmail(validatePremiumPayload(valid));
  assert.doesNotMatch(without.text, /Phone:/);
  assert.doesNotMatch(without.html, />Phone</);
  for (const payload of [
    { ...valid, email: "bad@@example.org" },
    { ...valid, phone: "not a phone" },
    { ...valid, phone: "1".repeat(41) },
    { ...valid, phone: "+47\nBcc: attacker@example.org" },
    { ...valid, contactName: " " },
    { ...valid, businessName: " " },
    { ...valid, message: " " },
  ]) assert.equal(validatePremiumPayload(payload), null);
});

test("Premium route reuses origin, honeypot, size and safe Resend handling without persistence", async () => {
  let sends = 0;
  const fetchImpl = async (url, options) => {
    sends += 1;
    assert.equal(url, "https://api.resend.com/emails");
    const email = JSON.parse(options.body);
    assert.equal(email.reply_to, valid.email);
    assert.equal(email.from, "Spotnera Support <noreply@spotnera.com>");
    assert.deepEqual(email.to, ["support@spotnera.com"]);
    return Response.json({ id: "accepted" });
  };
  assert.equal((await handlePremiumRequest(request({ ...valid,
    from: "attacker@example.org", to: "attacker@example.org",
    reply_to: "attacker@example.org" }),
    { apiKey: "test-key", fetchImpl })).status, 200);
  assert.equal(sends, 1);
  for (const badRequest of [
    request({ ...valid, website: "spam.example" }),
    request(valid, { Origin: "https://other.example" }),
    request({ ...valid, message: "x".repeat(9000) }),
  ]) assert.notEqual((await handlePremiumRequest(badRequest,
    { apiKey: "test-key", fetchImpl })).status, 200);
  assert.equal(sends, 1);
  const route = readFileSync(new URL("../../app/api/premium-inquiry/route.js", import.meta.url), "utf8");
  const handler = readFileSync(new URL("./support-email.mjs", import.meta.url), "utf8");
  assert.match(route, /process\.env\.RESEND_API_KEY/);
  assert.doesNotMatch(route + handler, /createClient|supabase|\.from\(|insert\(/i);
});
