import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { getDealAvailabilityLabel, isDealAvailableNow } from "./deals.js";
import { getDiscoverableDeals } from "./deal-discovery.mjs";
import { classifyPublicProfileDeal, partitionPublicProfileDeals } from "./public-profile-deals.mjs";

const now = new Date("2026-09-10T12:00:00.000Z"); // Thursday, 14:00 in Oslo.
const base = { is_active: true, availability_mode: "continuous", starts_at: "2026-09-01T00:00:00.000Z", ends_at: "2026-09-30T00:00:00.000Z" };
const deal = (id, fields = {}) => ({ ...base, id, title: id, ...fields });

test("active continuous and weekly deals stay active regardless of today's weekly window", () => {
  const continuous = deal("continuous");
  const weeklyOpen = deal("weekly-open", { availability_mode: "weekly", deal_schedules: [
    { day_of_week: 4, start_time: "13:00:00", end_time: "15:00:00", spans_midnight: false },
  ] });
  const weeklyClosed = deal("weekly-closed", { availability_mode: "weekly", deal_schedules: [
    { day_of_week: 5, start_time: "18:00:00", end_time: "21:00:00", spans_midnight: false },
  ] });
  for (const item of [continuous, weeklyOpen, weeklyClosed]) {
    assert.equal(classifyPublicProfileDeal(item, now), "active");
  }
  assert.equal(isDealAvailableNow(weeklyOpen, now), true);
  assert.equal(getDealAvailabilityLabel(weeklyOpen, now), "Available now");
  assert.equal(isDealAvailableNow(weeklyClosed, now), false);
  assert.match(getDealAvailabilityLabel(weeklyClosed, now), /Next available Friday 18:00/);
});

test("future overall start wins over a matching weekly window", () => {
  const future = deal("future", { starts_at: "2026-09-17T12:00:00.000Z", availability_mode: "weekly", deal_schedules: [
    { day_of_week: 4, start_time: "13:00:00", end_time: "15:00:00", spans_midnight: false },
  ] });
  assert.equal(classifyPublicProfileDeal(future, now), "upcoming");
  assert.equal(isDealAvailableNow(future, now), false);
  assert.match(getDealAvailabilityLabel(future, now), /^Starts /);
  assert.equal(getDiscoverableDeals({ deals: [future] }, now).length, 0);
});

test("exact start becomes active; exact end and disabled deals are excluded", () => {
  assert.equal(classifyPublicProfileDeal(deal("at-start", { starts_at: now.toISOString() }), now), "active");
  assert.equal(classifyPublicProfileDeal(deal("at-end", { ends_at: now.toISOString() }), now), "excluded");
  assert.equal(classifyPublicProfileDeal(deal("past", { ends_at: "2026-09-09T00:00:00.000Z" }), now), "excluded");
  assert.equal(classifyPublicProfileDeal(deal("disabled", { is_active: false, status: "paused" }), now), "excluded");
});

test("active deals end soonest first and upcoming deals start soonest first", () => {
  const items = [
    deal("open-ended", { ends_at: null }),
    deal("later", { ends_at: "2026-09-28T00:00:00.000Z" }),
    deal("soon", { ends_at: "2026-09-15T00:00:00.000Z" }),
    deal("future-later", { starts_at: "2026-09-25T00:00:00.000Z", ends_at: "2026-09-30T00:00:00.000Z" }),
    deal("future-soon", { starts_at: "2026-09-12T00:00:00.000Z", ends_at: "2026-09-30T00:00:00.000Z" }),
  ];
  const groups = partitionPublicProfileDeals(items, now);
  assert.deepEqual(groups.active.map((item) => item.id), ["soon", "later", "open-ended"]);
  assert.deepEqual(groups.upcoming.map((item) => item.id), ["future-soon", "future-later"]);
});

test("migration retains public eligibility and owner access while removing only the start boundary", () => {
  const sql = readFileSync(new URL("../supabase/migrations/20260924020000_allow_public_upcoming_deals.sql", import.meta.url), "utf8");
  const previous = readFileSync(new URL("../supabase/migrations/20260906020000_reassert_public_read_access.sql", import.meta.url), "utf8");
  const policy = /create policy "Public users can read live deals for active businesses"[\s\S]*?;/i;
  const oldDefinition = previous.match(policy)?.[0];
  const newDefinition = sql.match(policy)?.[0];
  assert.ok(oldDefinition && newDefinition);
  const withoutStartBoundary = oldDefinition.replace(/\s+and \(deals\.starts_at is null or deals\.starts_at <= now\(\)\)/i, "");
  assert.equal(newDefinition.replace(/\s+/g, ""), withoutStartBoundary.replace(/\s+/g, ""));
  assert.match(sql, /drop policy if exists "Public users can read live deals for active businesses" on public\.deals/i);
  assert.match(sql, /for select\s+to anon, authenticated/i);
  assert.match(sql, /businesses\.id = deals\.business_id/i);
  assert.match(sql, /businesses\.owner_id = auth\.uid\(\)/i);
  assert.match(sql, /businesses\.is_active\s+and deals\.is_active/i);
  assert.match(sql, /deals\.ends_at is null or deals\.ends_at > now\(\)/i);
  assert.doesNotMatch(sql, /deals\.starts_at\s+(?:is null|<=|>=)/i);
  assert.doesNotMatch(sql, /for (?:insert|update|delete)|grant |revoke |notification_|deal_schedules/i);
});

test("profile alone drops the future-start filter; global discovery keeps it", () => {
  const profile = readFileSync(new URL("../app/business/[id]/page.js", import.meta.url), "utf8");
  const dashboard = readFileSync(new URL("../app/page.js", import.meta.url), "utf8");
  assert.doesNotMatch(profile, /\.or\(`starts_at\.is\.null,starts_at\.lte/);
  assert.match(profile, /\.or\(`ends_at\.is\.null,ends_at\.gt/);
  assert.match(dashboard, /\.or\(`starts_at\.is\.null,starts_at\.lte/);
});
