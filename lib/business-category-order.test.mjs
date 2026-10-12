import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ALPHABETICAL_BUSINESS_CATEGORIES, ALPHABETICAL_BUSINESS_CATEGORY_LABELS,
  BUSINESS_CATEGORIES, BUSINESS_CATEGORY_LABELS, businessCategoryMatches } from "./business-categories.js";

const owner = readFileSync(new URL("../app/owner/page.js", import.meta.url), "utf8");
const search = readFileSync(new URL("../components/spotnera-dashboard.js", import.meta.url), "utf8");
const personalization = readFileSync(new URL("../components/personalization-settings.js", import.meta.url), "utf8");

test("category sorting keeps the original taxonomy and stored values unchanged", () => {
  const collator = new Intl.Collator("en", { sensitivity: "base" });
  assert.notEqual(ALPHABETICAL_BUSINESS_CATEGORIES, BUSINESS_CATEGORIES);
  assert.deepEqual(ALPHABETICAL_BUSINESS_CATEGORY_LABELS,
    ALPHABETICAL_BUSINESS_CATEGORIES.map(({ value }) => value));
  assert.deepEqual(new Set(ALPHABETICAL_BUSINESS_CATEGORY_LABELS), new Set(BUSINESS_CATEGORY_LABELS));
  assert.ok(ALPHABETICAL_BUSINESS_CATEGORIES.every((item, index, rows) =>
    index === 0 || collator.compare(rows[index - 1].label, item.label) <= 0));
  assert.equal(BUSINESS_CATEGORIES[0].value, "Restaurants");
  assert.equal(businessCategoryMatches("Restaurant", "Restaurants"), true);
});

test("search, create, edit and interest selectors use alphabetical category labels", () => {
  assert.match(search, /<span>All categories<\/span>[\s\S]*?visibleCategories\.map/);
  assert.match(search, /const selectedOnlyCategories = ALPHABETICAL_BUSINESS_CATEGORIES\.filter/);
  assert.match(search, /\? ALPHABETICAL_BUSINESS_CATEGORIES/);
  assert.match(search, /ALPHABETICAL_BUSINESS_CATEGORIES\.slice\(0, 12\)/);
  assert.match(owner, /<option value="" disabled>Choose category<\/option>[\s\S]*?ALPHABETICAL_BUSINESS_CATEGORY_LABELS\.map/);
  assert.match(owner, /defaultValue=\{selectedCategory\}/);
  assert.match(owner, /hasLegacyCategory[\s\S]*?<option value=\{selectedCategory\}>/);
  assert.match(personalization, /ALPHABETICAL_BUSINESS_CATEGORIES\.map/);
});
