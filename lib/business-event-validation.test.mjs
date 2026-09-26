import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { EVENT_TYPES, EVENT_SOURCES, validateBusinessEvent,
  isEligibleEventBusiness, isEligibleEventDeal } from "./business-event-validation.mjs";

const businessId = "11111111-1111-4111-8111-111111111111";
const dealId = "22222222-2222-4222-8222-222222222222";
const event = (eventType, fields = {}) => ({ businessId, eventType, source: "deals", ...fields });
const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("Phase F types and sources are constrained; deal events require a valid related deal ID", () => {
  for (const eventType of ["deal_view", "deal_click", "deal_save", "business_view",
    "website_click", "directions_click", "call_click"]) {
    assert.ok(EVENT_TYPES.has(eventType));
    assert.ok(validateBusinessEvent(event(eventType, eventType.startsWith("deal_") ? { dealId } : {})));
  }
  for (const source of ["deals", "saved", "map", "business_profile", "search"]) {
    assert.ok(EVENT_SOURCES.has(source));
    assert.ok(validateBusinessEvent(event("deal_view", { dealId, source })));
  }
  assert.equal(validateBusinessEvent(event("unknown")), null);
  assert.equal(validateBusinessEvent(event("business_view", { source: "invented" })), null);
  assert.equal(validateBusinessEvent(event("business_view", { source: null })), null);
  assert.equal(validateBusinessEvent(event("business_view", { businessId: "bad" })), null);
  assert.equal(validateBusinessEvent(event("deal_view")), null);
  assert.equal(validateBusinessEvent(event("deal_click", { dealId: "bad" })), null);
  assert.equal(validateBusinessEvent(event("website_click", { dealId })), null);
  assert.equal(validateBusinessEvent(event("deal_view", { dealId, age_range: "25–34" })), null);
  assert.equal(validateBusinessEvent(event("deal_view", { dealId, interests: ["Restaurants"] })), null);
});

test("server eligibility requires a public business, legitimate action, and matching active deal", () => {
  const business = { is_active: true, website_url: "example.com", phone: "+47 12345678",
    latitude: 59.9, longitude: 10.7, address: "" };
  assert.ok(isEligibleEventBusiness(business, "website_click"));
  assert.ok(isEligibleEventBusiness(business, "call_click"));
  assert.ok(isEligibleEventBusiness(business, "directions_click"));
  assert.equal(isEligibleEventBusiness({ ...business, is_active: false }, "business_view"), false);
  assert.equal(isEligibleEventBusiness({ ...business, website_url: "javascript:bad" }, "website_click"), false);
  assert.equal(isEligibleEventBusiness({ ...business, phone: null }, "call_click"), false);
  assert.equal(isEligibleEventBusiness({ ...business, latitude: null, longitude: null }, "directions_click"), false);
  assert.equal(isEligibleEventBusiness({ ...business, latitude: "", longitude: "" }, "directions_click"), false);
  const now = new Date("2026-09-27T12:00:00Z");
  const deal = { business_id: businessId, is_active: true, ends_at: null };
  assert.ok(isEligibleEventDeal(deal, businessId, now));
  assert.equal(isEligibleEventDeal({ ...deal, business_id: dealId }, businessId, now), false);
  assert.equal(isEligibleEventDeal({ ...deal, is_active: false }, businessId, now), false);
  assert.equal(isEligibleEventDeal({ ...deal, ends_at: now.toISOString() }, businessId, now), false);
});

test("central route validates and inserts only minimal server-approved context", () => {
  const route = read("../app/api/business-events/route.js");
  const client = read("./business-events.js");
  assert.match(route, /validateBusinessEvent\(JSON\.parse\(body\)\)/);
  assert.match(route, /\.eq\("id", event\.dealId\)\.eq\("business_id", event\.businessId\)/);
  assert.match(route, /isEligibleEventBusiness\(business, event\.eventType\)/);
  assert.match(route, /isEligibleEventDeal\(deal, event\.businessId\)/);
  assert.match(route, /event\.eventType === "deal_save"/);
  assert.match(route, /business_id: event\.businessId,[\s\S]*?event_type: event\.eventType,[\s\S]*?deal_id: event\.dealId,[\s\S]*?source: event\.source/);
  assert.doesNotMatch(route, /age_range|interests|date_of_birth|user_agent|ip_address/);
  assert.match(client, /fetch\("\/api\/business-events"/);
  assert.match(client, /\.catch\(\(\) => \{\}\)/);
  assert.doesNotMatch(client, /\.from\("business_events"\)/);
});

test("tracking transport failures do not throw or interrupt the primary action", async () => {
  const previousWindow = globalThis.window;
  const previousFetch = globalThis.fetch;
  try {
    globalThis.window = {};
    globalThis.fetch = () => Promise.reject(new Error("network unavailable"));
    const { recordBusinessEvent } = await import("./business-events.js");
    assert.doesNotThrow(() => recordBusinessEvent(event("deal_click", { dealId })));
    await new Promise((resolve) => setImmediate(resolve));
  } finally {
    globalThis.window = previousWindow;
    globalThis.fetch = previousFetch;
  }
});

test("deal and business views require presented experiences; clicks require actions", () => {
  const dialog = read("../components/deal-details-dialog.js");
  const dashboard = read("../components/spotnera-dashboard.js");
  const profile = read("../components/business-profile-analytics.js");
  const profileDeals = read("../components/business-profile-deals.js");
  const locations = read("../components/business-location-actions.js");
  const links = read("../components/business-event-link.js");
  assert.match(dialog, /useEffect\(\(\) => \{[\s\S]*?viewedDealRef\.current === deal\.id[\s\S]*?eventType: "deal_view"/);
  assert.match(dashboard, /recordDealClick\(item\.business, item\.deal, source\);\s*setSelectedDeal/);
  assert.match(profileDeals, /recordDealClick\(business, deal, "business_profile"\);\s*setSelectedDeal/);
  assert.match(profile, /useEffect\(\(\) => \{[\s\S]*?trackedBusinessId\.current === businessId[\s\S]*?eventType: "business_view"/);
  assert.doesNotMatch(dashboard, /eventType: "profile_view"|eventType: "deal_view"/);
  assert.match(locations, /directionsUrl \? \([\s\S]*?onClick=\{\(\) => recordBusinessEvent\(\{ businessId: business\.id, eventType: "directions_click", source \}\)\}/);
  assert.match(links, /onClick=\{\(\) => \{[\s\S]*?recordBusinessEvent/);
  assert.doesNotMatch(dashboard + profileDeals + dialog, /eventType: "deal_save"/);
});

test("raw events are private while the existing owner view remains aggregate", () => {
  const migration = read("../supabase/migrations/20260927010000_phase_f_interaction_events.sql");
  const owner = read("../app/owner/page.js");
  const original = read("../supabase/migrations/20260906000000_create_business_events.sql");
  assert.match(migration, /revoke insert, select on public\.business_events from anon, authenticated/);
  assert.match(migration, /drop policy if exists "Owners can read analytics for their businesses"/);
  assert.match(migration, /drop policy if exists "Visitors can insert public business engagement events"/);
  assert.match(migration, /security definer/);
  assert.match(migration, /set search_path = pg_catalog, pg_temp/);
  assert.match(migration, /b\.owner_id = \(select auth\.uid\(\)\)/);
  assert.match(migration, /group by e\.business_id/);
  assert.match(migration, /revoke all on function public\.get_owner_business_event_counts\(text\) from public, anon/);
  assert.match(migration, /grant execute on function public\.get_owner_business_event_counts\(text\) to authenticated/);
  assert.match(original, /business_id uuid not null references public\.businesses\(id\)/);
  assert.match(original, /deal_id uuid null references public\.deals\(id\)/);
  assert.match(owner, /get_owner_business_event_counts/);
  assert.doesNotMatch(migration, /add column (user_id|email|interests|age_range|date_of_birth)\b/i);
});

test("owner RPC accepts only the three UI ranges and rejects malformed or null ranges", () => {
  const migration = read("../supabase/migrations/20260927010000_phase_f_interaction_events.sql");
  const owner = read("../app/owner/page.js");
  const ranges = owner.match(/const ANALYTICS_RANGES = \[([\s\S]*?)\];/)?.[1];
  assert.ok(ranges);
  assert.deepEqual([...ranges.matchAll(/key: "([^"]+)"/g)].map((match) => match[1]), ["7d", "30d", "all"]);
  assert.match(migration, /if range_key is null or range_key not in \('7d', '30d', 'all'\) then\s+raise exception 'Invalid analytics range' using errcode = '22023'/);
  assert.match(migration, /when range_key = '7d' then now\(\) - interval '7 days'/);
  assert.match(migration, /when range_key = '30d' then now\(\) - interval '30 days'/);
  assert.match(migration, /when range_key = 'all' then null/);
  assert.match(owner, /range_key: analyticsRange\.key/);
});
