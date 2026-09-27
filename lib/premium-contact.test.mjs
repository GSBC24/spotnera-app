import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { copyPremiumEmail, getPremiumContactEmail, getPremiumMailto } from "./premium-contact.mjs";

const page = readFileSync(new URL("../app/owner/premium/page.js", import.meta.url), "utf8");
const actions = readFileSync(new URL("../components/premium-contact-actions.js", import.meta.url), "utf8");

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

test("Premium page retains the no-email route and renders visible, accessible contact controls", () => {
  assert.match(page, /NEXT_PUBLIC_SPOTNERA_CONTACT_EMAIL/);
  assert.match(page, /legalConfig\.legalContactEmail/);
  assert.match(page, /<PremiumContactActions email=\{contactEmail\}/);
  assert.match(page, /href="\/terms#contact"/);
  assert.match(actions, /\{email\}/);
  assert.match(actions, /Copy email/);
  assert.match(actions, /role="status" aria-live="polite"/);
  assert.match(actions, /type="button"/);
});
