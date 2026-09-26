import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { BUSINESS_CATEGORIES } from "./business-categories.js";
import { AGE_RANGES, MAX_INTERESTS, canonicalInterest, validatePersonalization } from "./personalization.mjs";

test("interests use canonical business categories and allow zero through five distinct choices", () => {
  const categories = BUSINESS_CATEGORIES.slice(0, MAX_INTERESTS).map(({ value }) => value);
  assert.equal(validatePersonalization([], null).error, undefined);
  assert.deepEqual(validatePersonalization([categories[0]], null).interests, [categories[0]]);
  assert.deepEqual(validatePersonalization(categories, null).interests, categories);
  assert.ok(validatePersonalization([...categories, BUSINESS_CATEGORIES[5].value], null).error);
  assert.ok(validatePersonalization([categories[0], categories[0]], null).error);
  assert.deepEqual(validatePersonalization([...categories.slice(0, 4), BUSINESS_CATEGORIES[5].value], null).interests,
    [...categories.slice(0, 4), BUSINESS_CATEGORIES[5].value]);
  assert.equal(canonicalInterest("Restaurant"), "Restaurants");
  assert.equal(canonicalInterest("Cafe"), BUSINESS_CATEGORIES[1].value);
  assert.equal(canonicalInterest("not a category"), null);
  assert.ok(validatePersonalization(["not a category"], null).error);
});

test("age range accepts exactly the six explicit values or null", () => {
  assert.deepEqual(AGE_RANGES, ["18–24", "25–34", "35–44", "45–54", "55–64", "65+"]);
  for (const ageRange of [null, ...AGE_RANGES]) {
    assert.equal(validatePersonalization([], ageRange).ageRange, ageRange);
  }
  for (const ageRange of ["", "17–24", "66+", "25-34"]) {
    assert.ok(validatePersonalization([], ageRange).error);
  }
});

test("migration enforces profile ownership inheritance, max five, uniqueness and age values", () => {
  const migration = readFileSync(new URL("../supabase/migrations/20260927000000_add_customer_personalization.sql", import.meta.url), "utf8");
  const onboarding = readFileSync(new URL("../supabase/onboarding.sql", import.meta.url), "utf8");
  assert.match(onboarding, /interests text\[\] not null default '\{\}'/);
  assert.match(onboarding, /for select\s+using \(auth\.uid\(\) = id\)/);
  assert.match(onboarding, /for update\s+using \(auth\.uid\(\) = id\)\s+with check \(auth\.uid\(\) = id\)/);
  assert.match(migration, /add column age_range text/);
  assert.match(migration, /age_range is null or age_range in/);
  assert.match(migration, /cardinality\(interests\) <= 5/);
  assert.match(migration, /interest = any\(seen\)/);
  assert.match(migration, /before insert or update of interests on public\.profiles/);
  assert.doesNotMatch(migration, /create policy|grant .*business|date_of_birth|notification_preferences/i);
});

test("Me saves exact personalization fields and notification eligibility has no interest dependency", () => {
  const me = readFileSync(new URL("../app/me/page.js", import.meta.url), "utf8");
  const ui = readFileSync(new URL("../components/personalization-settings.js", import.meta.url), "utf8");
  const notifications = readFileSync(new URL("./server/timed-notifications.mjs", import.meta.url), "utf8");
  assert.match(me, /interests, age_range, onboarding_completed/);
  assert.match(ui, /\.update\(\{ interests: checked\.interests, age_range: checked\.ageRange \}\)/);
  assert.match(ui, /\.select\("interests, age_range"\)/);
  assert.match(ui, /if \(writeRef\.current\) return/);
  assert.doesNotMatch(notifications, /\binterests\b|\bage_range\b/);
});
