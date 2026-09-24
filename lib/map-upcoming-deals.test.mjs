import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { countMapUpcomingDeals } from "./map-upcoming-deals.mjs";
import { getDiscoverableDeals } from "./deal-discovery.mjs";

const now = new Date("2026-09-24T12:00:00.000Z");
const deal = (id, fields = {}) => ({
  id, business_id: "business-a", is_active: true,
  starts_at: "2026-09-25T12:00:00.000Z", ends_at: null,
  ...fields,
});

test("Map counts active continuous and closed weekly deals only as active", () => {
  const active = [
    deal("continuous", { starts_at: "2026-09-20T12:00:00.000Z", availability_mode: "continuous" }),
    deal("weekly", { starts_at: null, availability_mode: "weekly", deal_schedules: [
      { day_of_week: 1, start_time: "09:00:00", end_time: "11:00:00", spans_midnight: false },
    ] }),
  ];
  assert.equal(getDiscoverableDeals({ deals: active }, now).length, 2);
  assert.equal(countMapUpcomingDeals(active, ["business-a"], now).size, 0);
});

test("future deals count per active business without entering live deal arrays", () => {
  const future = [
    deal("a1"), deal("a2"), deal("b1", { business_id: "business-b" }),
  ];
  const counts = countMapUpcomingDeals(future, ["business-a", "business-b"], now);
  assert.equal(counts.get("business-a"), 2);
  assert.equal(counts.get("business-b"), 1);
  assert.equal(getDiscoverableDeals({ deals: future }, now).length, 0);
  assert.equal(countMapUpcomingDeals(future, ["business-c"], now).size, 0);
});

test("inactive, expired, malformed, and already started rows do not count as upcoming", () => {
  const rows = [
    deal("inactive", { is_active: false }),
    deal("expired", { ends_at: "2026-09-23T12:00:00.000Z" }),
    deal("invalid-start", { starts_at: "invalid" }),
    deal("invalid-end", { ends_at: "invalid" }),
    deal("at-start", { starts_at: now.toISOString() }),
    deal("null-start", { starts_at: null }),
    deal("valid"), deal("valid"),
  ];
  assert.equal(countMapUpcomingDeals(rows, ["business-a"], now).get("business-a"), 1);
});

test("dashboard fetches upcoming rows separately in pages and retains live discovery isolation", () => {
  const page = readFileSync(new URL("../app/page.js", import.meta.url), "utf8");
  assert.match(page, /\.gt\("starts_at", now\.toISOString\(\)\)/);
  assert.match(page, /\.or\(`ends_at\.is\.null,ends_at\.gt\.\$\{now\.toISOString\(\)\}`\)/);
  assert.match(page, /\.range\(offset, offset \+ 499\)/);
  assert.match(page, /offset \+= page\.length/);
  assert.match(page, /for \(const deal of liveDealRows\)/);
  assert.match(page, /deals: dealsByBusinessId\.get\(business\.id\) \?\? \[\]/);
  assert.match(page, /upcomingDealCount: upcomingDealCounts\?\.get\(business\.id\) \?\? null/);
});

test("compact Map card reuses Save action, guest auth, and Phase D pending protection", () => {
  const dashboard = readFileSync(new URL("../components/spotnera-dashboard.js", import.meta.url), "utf8");
  const compact = dashboard.match(/selectedBusiness && isSelectedCardOpen && !isDetailOpen[\s\S]*?BusinessLocationActions key=\{selectedBusiness\.id\}/)?.[0];
  assert.ok(compact);
  assert.match(compact, /upcomingDealCount|MapBusinessDeals business=\{selectedBusiness\}/);
  assert.match(compact, /FavoriteButton[\s\S]*?onClick=\{\(\) => handleToggleFavorite\(selectedBusiness\)\}/);
  assert.match(compact, /pendingNotificationBusinessId === selectedBusiness\.id/);
  assert.match(compact, /selectedBusiness\.isFavorite \? "Saved" : "Save"/);
  assert.match(dashboard, /if \(!userId\) \{\s*requestAuth\(getBusinessPath\(business\)\)/);
  assert.match(dashboard, /if \(pendingFavoriteId \|\| favoriteWriteRef\.current \|\|/);
  assert.match(dashboard, /notificationWriteRef\.current === business\.id/);
  assert.match(dashboard, /data\?\.length !== 1 \|\| data\[0\]\.business_id !== business\.id/);
  assert.match(dashboard, /\.delete\(\)\s*\.eq\("business_id", business\.id\)\s*\.eq\("user_id", userId\)/);
  assert.match(dashboard, /Deal notifications from this business/);
  assert.match(dashboard, /View deals/);
});
