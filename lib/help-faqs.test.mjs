import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { HELP_CATEGORIES, HELP_FAQS, searchHelpFaqs } from "./help-faqs.mjs";

test("Help has six customer-facing categories and 24 distinct, substantive FAQs", () => {
  assert.deepEqual(HELP_CATEGORIES, ["Customer", "Business", "Account", "Deals", "Notifications", "Other"]);
  assert.equal(HELP_FAQS.length, 24);
  assert.equal(new Set(HELP_FAQS.map((faq) => faq.id)).size, HELP_FAQS.length);
  for (const faq of HELP_FAQS) {
    assert.ok(HELP_CATEGORIES.includes(faq.category));
    assert.ok(faq.question.length > 10 && faq.answer.length > 30);
    assert.doesNotMatch(`${faq.question} ${faq.answer}`, /Spotnera®|ticket submitted|Premium subscription is available/i);
  }
  for (const category of HELP_CATEGORIES) assert.ok(HELP_FAQS.some((faq) => faq.category === category));
});

test("search matches question, answer, category, and keywords immediately", () => {
  assert.equal(searchHelpFaqs(HELP_FAQS).length, 24);
  assert.ok(searchHelpFaqs(HELP_FAQS, "HOW DO I SAVE").some((faq) => faq.id === "save-business"));
  assert.ok(searchHelpFaqs(HELP_FAQS, "norway").some((faq) => faq.id === "coverage"));
  assert.ok(searchHelpFaqs(HELP_FAQS, "bookmark").some((faq) => faq.id === "save-business"));
  assert.ok(searchHelpFaqs(HELP_FAQS, "premium", "Business").some((faq) => faq.id === "premium"));
  assert.ok(searchHelpFaqs(HELP_FAQS, "weekly", "Notifications").every((faq) => faq.category === "Notifications"));
  assert.deepEqual(searchHelpFaqs(HELP_FAQS, "no matching article xzyq"), []);
});

test("public Help route and zero-results Contact Support path exist without auth", () => {
  const page = readFileSync(new URL("../app/help/page.js", import.meta.url), "utf8");
  const center = readFileSync(new URL("../components/help-center.js", import.meta.url), "utf8");
  assert.match(page, /export default function HelpPage/);
  assert.match(page, /<HelpCenter \/>/);
  assert.doesNotMatch(page, /getUser|redirect\(|createClient|auth/);
  assert.match(center, /type="search"/);
  assert.match(center, /No help articles found\./);
  assert.match(center, /href="#contact-support"/);
  assert.match(center, /<details/);
});

test("shared Help destination covers principal headers and every route through footer", () => {
  const link = readFileSync(new URL("../components/help-link.js", import.meta.url), "utf8");
  const footer = readFileSync(new URL("../components/site-footer.js", import.meta.url), "utf8");
  const layout = readFileSync(new URL("../app/layout.js", import.meta.url), "utf8");
  assert.match(link, /href="\/help"/);
  assert.match(link, /aria-label="Help & Support"/);
  assert.match(footer, /href="\/help"/);
  assert.match(layout, /<SiteFooter \/>/);
  for (const path of ["../components/spotnera-dashboard.js", "../app/owner/page.js",
    "../app/me/page.js", "../app/business/[id]/page.js", "../app/owner/premium/page.js",
    "../app/onboarding/page.js"]) {
    assert.match(readFileSync(new URL(path, import.meta.url), "utf8"), /<HelpLink/);
  }
  const bottomNav = readFileSync(new URL("../components/spotnera-bottom-nav.js", import.meta.url), "utf8");
  assert.doesNotMatch(bottomNav, /label: "Help"/);
});
