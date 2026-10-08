import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { countMapUpcomingDeals, groupMapUpcomingDeals } from "./map-upcoming-deals.mjs";
import { getDiscoverableDeals } from "./deal-discovery.mjs";
import { getDealAvailabilityLabel } from "./deals.js";
import { getBusinessPath } from "./business-url.js";

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
  const groups = groupMapUpcomingDeals(future, ["business-a", "business-b"], now);
  assert.deepEqual(groups.get("business-a").map((item) => item.id), ["a1", "a2"]);
  assert.equal(groups.get("business-b")[0].id, "b1");
  assert.match(getDealAvailabilityLabel(groups.get("business-a")[0], now), /^Starts /);
});

test("dialog rows sort by overall start and omit businesses without upcoming deals", () => {
  const groups = groupMapUpcomingDeals([
    deal("later", { starts_at: "2026-09-28T12:00:00.000Z" }),
    deal("soon", { starts_at: "2026-09-25T12:00:00.000Z" }),
  ], ["business-a", "business-b"], now);
  assert.deepEqual(groups.get("business-a").map((item) => item.id), ["soon", "later"]);
  assert.equal(groups.has("business-b"), false);
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
  assert.match(page, /upcomingDeals: upcomingDealGroups\?\.get\(business\.id\) \?\? \[\]/);
  assert.match(page, /upcomingDealCount: upcomingDealGroups\?\.get\(business\.id\)\?\.length \?\? null/);
  assert.match(page, /\.select\(DEAL_SELECT\)[\s\S]*?\.gt\("starts_at", now\.toISOString\(\)\)/);
  assert.match(page, /deal_schedules \(/);
});

test("View deals shows active and upcoming rows and opens the shared Deal Details dialog", () => {
  const dashboard = readFileSync(new URL("../components/spotnera-dashboard.js", import.meta.url), "utf8");
  const details = dashboard.match(/selectedBusiness && isDetailOpen \? \([\s\S]*?<\/motion\.section>/)?.[0];
  const upcoming = dashboard.match(/function MapUpcomingDeals\([\s\S]*?function getActiveDeal/)?.[0];
  assert.ok(details);
  assert.ok(upcoming);
  assert.match(details, /<MapActiveDeals business=\{selectedBusiness\}[\s\S]*?<MapUpcomingDeals business=\{selectedBusiness\} onOpen=\{\(item\) => openDealDetails\(item, "map"\)\}/);
  assert.match(upcoming, /const deals = groupMapUpcomingDeals\(business\.upcomingDeals \?\? \[\], \[business\.id\]\)/);
  assert.match(upcoming, /if \(!deals\.length\) return null/);
  assert.match(upcoming, /deals\.map\(\(deal\) =>/);
  assert.match(upcoming, /onOpen\(\{ business: \{[\s\S]*?id: business\.id, slug: business\.slug, name: business\.name,[\s\S]*?\}, deal \}\)/);
  assert.match(upcoming, /deal\.description/);
  assert.match(upcoming, /getDealAvailabilityLabel\(deal\)/);
  assert.match(dashboard, /selectedDeal \? \([\s\S]*?<DealDetailsDialog business=\{selectedDeal\.business\} deal=\{selectedDeal\.deal\}/);
  assert.match(dashboard, /recordDealClick\(item\.business, item\.deal, source\)/);
  assert.match(dashboard, /const closeDealDetails = useCallback\(\(\) => setSelectedDeal\(null\), \[\]\)/);
});

test("compact Map card reuses Save action, guest auth, and Phase D pending protection", () => {
  const dashboard = readFileSync(new URL("../components/spotnera-dashboard.js", import.meta.url), "utf8");
  const compact = dashboard.match(/selectedBusiness && isSelectedCardOpen && !isDetailOpen[\s\S]*?BusinessLocationActions key=\{selectedBusiness\.id\}/)?.[0];
  assert.ok(compact);
  assert.match(compact, /upcomingDealCount|MapBusinessDeals business=\{selectedBusiness\}/);
  assert.match(compact, /FavoriteButton[\s\S]*?onClick=\{\(\) => handleToggleFavorite\(selectedBusiness\)\}/);
  assert.match(compact, /pendingNotificationBusinessId === selectedBusiness\.id/);
  assert.match(compact, /<FavoriteButton[\s\S]*?<BusinessAddress business=\{selectedBusiness\} compact/);
  assert.match(dashboard, /aria-label=\{isFavorite \? "Remove saved business" : "Save business"\}/);
  assert.match(dashboard, /fill=\{isFavorite \? "currentColor" : "none"\}/);
  assert.match(dashboard, /if \(!userId\) \{\s*requestAuth\(getBusinessPath\(business\)\)/);
  assert.match(dashboard, /if \(pendingFavoriteId \|\| favoriteWriteRef\.current \|\|/);
  assert.match(dashboard, /notificationWriteRef\.current === business\.id/);
  assert.match(dashboard, /data\?\.length !== 1 \|\| data\[0\]\.business_id !== business\.id/);
  assert.match(dashboard, /\.delete\(\)\s*\.eq\("business_id", business\.id\)\s*\.eq\("user_id", userId\)/);
  assert.match(dashboard, /Deal notifications from this business/);
  assert.match(dashboard, /View deals/);
});

test("Map card actions keep zero-deal profiles primary and future deals reachable", () => {
  const dashboard = readFileSync(new URL("../components/spotnera-dashboard.js", import.meta.url), "utf8");
  const card = dashboard.slice(dashboard.indexOf("{selectedBusiness && isSelectedCardOpen"), dashboard.indexOf("{selectedBusiness && isDetailOpen"));
  assert.equal(getDiscoverableDeals({ deals: [deal("future")] }, now).length, 0);
  assert.equal(getDiscoverableDeals({ deals: [deal("hidden", { is_active: false, starts_at: null })] }, now).length, 0);
  assert.match(card, /selectedBusinessLiveDeals\.length \? <button[\s\S]*?View deals[\s\S]*?<\/button> : null/);
  assert.match(card, /selectedBusinessLiveDeals\.length \? "border border-white\/14[\s\S]*?" : "spotnera-brand-action"/);
  assert.match(card, /!selectedBusinessLiveDeals\.length && selectedBusiness\.upcomingDealCount > 0 \? <button[\s\S]*?setIsDetailOpen\(true\)[\s\S]*?Upcoming deals/);
  assert.match(card, /href=\{getBusinessPath\(selectedBusiness\)\}/);
  assert.equal(getBusinessPath({ id: "private-id", slug: "public-slug" }), "/business/public-slug");
  assert.match(card, /grid-cols-2 max-\[340px\]:grid-cols-1/);
  assert.match(card, /<BusinessLocationActions[^>]*compact/);
});

test("Map bookmark and location controls retain save, directions and copy behavior", () => {
  const dashboard = readFileSync(new URL("../components/spotnera-dashboard.js", import.meta.url), "utf8");
  const location = readFileSync(new URL("../components/business-location-actions.js", import.meta.url), "utf8");
  assert.match(dashboard, /aria-pressed=\{isFavorite\}/);
  assert.match(dashboard, /event\.stopPropagation\(\);\s*onClick\(\)/);
  assert.match(dashboard, /const nextFavoriteState = !business\.isFavorite/);
  assert.match(dashboard, /requestAuth\(getBusinessPath\(business\)\)/);
  assert.match(dashboard, /\.from\("favorites"\)\.insert/);
  assert.match(dashboard, /\.from\("favorites"\)[\s\S]*?\.delete\(\)/);
  assert.match(dashboard, /focus-visible:ring-2 focus-visible:ring-\[#72f0cc\]/);
  assert.match(location, /getBusinessDirectionsUrl\(business\)/);
  assert.match(location, /href=\{directionsUrl\}/);
  assert.match(location, /recordBusinessEvent\(\{ businessId: business\.id, eventType: "directions_click", source \}\)/);
  assert.match(location, /copyBusinessAddress\(address\) \? "Address copied" : "Could not copy/);
  assert.match(location, /compact \? <UtilityIcon path=\{NAVIGATION_PATH\}/);
  assert.match(location, /compact \? <UtilityIcon path=\{COPY_PATH\}/);
  assert.match(location, /min-h-11/);
});
