import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { businessMatchesFilters, groupSearchBusinesses } from "./search-businesses.mjs";
import { canPresentInstallPrompt } from "./prompt-visibility.mjs";
import { canCreateBusiness } from "./owner-plan.mjs";
import { SHOW_OWNER_PREMIUM_PROMOTION } from "./owner-ui-config.mjs";
import { getBusinessPath } from "./business-url.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const dashboard = read("../components/spotnera-dashboard.js");
const consent = read("../components/consent-manager.js");
const install = read("../components/pwa-install-prompt.js");
const owner = read("../app/owner/page.js");
const home = read("../app/page.js");
const locationActions = read("../components/business-location-actions.js");
const now = new Date("2026-10-08T12:00:00Z");
const filters = { searchQuery: "", selectedCategories: [], selectedCountry: "", selectedCity: "" };
const live = { id: "live", title: "Lunch", is_active: true, starts_at: "2026-10-01T00:00:00Z", ends_at: "2026-10-10T00:00:00Z" };
const business = { id: "one", slug: "little-cafe", name: "Little Cafe", category: "Cafés", country: "Norway", city: "Oslo", is_active: true, suspended_at: null, deals: [live] };

test("Search filters public businesses by category and name, including legacy categories", () => {
  assert.equal(businessMatchesFilters(business, filters), true);
  assert.equal(businessMatchesFilters(business, { ...filters, searchQuery: "little" }), true);
  assert.equal(businessMatchesFilters(business, { ...filters, selectedCategories: ["Restaurants"] }), false);
  assert.equal(businessMatchesFilters(business, { ...filters, selectedCategories: ["Cafés"] }), true);
  assert.equal(businessMatchesFilters({ ...business, category: "Cafe" }, { ...filters, selectedCategories: ["Cafés"] }), true);
  assert.equal(businessMatchesFilters({ ...business, suspended_at: now.toISOString() }, filters), false);
  assert.equal(businessMatchesFilters({ ...business, is_active: false }, filters), false);
});

test("Search groups eligible businesses and counts only live, enabled deals", () => {
  const grouped = groupSearchBusinesses([
    business,
    { ...business, id: "suspended", suspended_at: now.toISOString() },
    { ...business, id: "hidden", is_active: false },
    { ...business, id: "two", name: "Another Cafe", deals: [
      { ...live, id: "admin", admin_disabled_at: now.toISOString() },
      { ...live, id: "paused", is_active: false },
      { ...live, id: "expired", ends_at: "2026-10-07T00:00:00Z" },
    ] },
  ], now);
  assert.deepEqual(grouped.map((group) => group.category), ["Cafés"]);
  assert.deepEqual(grouped[0].items.map(({ business: item }) => item.id), ["one", "two"]);
  assert.deepEqual(grouped[0].items.map(({ liveDeals }) => liveDeals.length), [1, 0]);
  assert.equal(getBusinessPath(business), "/business/little-cafe");
});

test("public discovery still applies business and deal moderation in its existing query", () => {
  assert.match(home, /\.eq\("is_active", true\)\s*\.is\("suspended_at", null\)/);
  assert.match(home, /\.is\("admin_disabled_at", null\)/);
  assert.match(home, /\.is\("businesses\.suspended_at", null\)/);
  assert.match(dashboard, /groupSearchBusinesses\(filteredBusinesses\)/);
  assert.match(dashboard, /href=\{getBusinessPath\(business\)\}/);
});

test("auth, consent and install dialogs fit the viewport and hand off visibility", () => {
  assert.match(dashboard, /authViewportRef/);
  assert.match(dashboard, /visualViewport/);
  assert.match(dashboard, /data-spotnera-auth-dialog role="dialog" aria-modal="true"/);
  assert.match(dashboard, /h-\[100dvh\].*safe-area-inset-bottom/);
  assert.match(consent, /role="dialog"\s*aria-modal="true"/);
  assert.match(consent, /h-\[100dvh\].*safe-area-inset-bottom/);
  assert.match(install, /h-\[100dvh\].*safe-area-inset-bottom/);
  assert.match(dashboard, /event\.key === "Escape"/);
  assert.match(consent, /event\.key !== "Tab"/);
  assert.match(install, /event\.key !== "Tab"/);
  const ready = { available: true, installed: false, hasConsentChoice: true, consentDialogVisible: false, authDialogVisible: false };
  assert.equal(canPresentInstallPrompt(ready), true);
  assert.equal(canPresentInstallPrompt({ ...ready, consentDialogVisible: true }), false);
  assert.equal(canPresentInstallPrompt({ ...ready, authDialogVisible: true }), false);
  assert.equal(canPresentInstallPrompt({ ...ready, installed: true }), false);
  assert.equal(canPresentInstallPrompt({ ...ready, hasConsentChoice: false }), false);
});

test("map card keeps its actions and owner Premium promotion is off during pilot", () => {
  for (const action of ["View deals", "Business profile", "Save business", "Directions", "Copy address"]) {
    assert.ok((dashboard + locationActions).includes(action));
  }
  assert.match(dashboard, /handleToggleFavorite\(selectedBusiness\)/);
  assert.match(locationActions, /getBusinessDirectionsUrl\(business\)/);
  assert.match(locationActions, /copyBusinessAddress\(address\)/);
  assert.equal(SHOW_OWNER_PREMIUM_PROMOTION, false);
  assert.match(owner, /SHOW_OWNER_PREMIUM_PROMOTION && ownerSection/);
  assert.equal(canCreateBusiness("FREE", 4), true);
  assert.equal(canCreateBusiness("FREE", 5), false);
});
