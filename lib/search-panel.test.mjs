import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { businessMatchesFilters, getSearchFilterSummary, groupSearchBusinesses } from "./search-businesses.mjs";

const dashboard = readFileSync(new URL("../components/spotnera-dashboard.js", import.meta.url), "utf8");
const now = new Date("2026-10-08T12:00:00Z");
const deal = { id: "deal", title: "Lunch", is_active: true, starts_at: "2026-10-01T00:00:00Z", ends_at: "2026-10-10T00:00:00Z" };
const business = { id: "one", slug: "little-cafe", name: "Little Cafe", category: "Cafés", country: "Norway", city: "Oslo", is_active: true, deals: [deal] };
const filters = { searchQuery: "", selectedCategories: [], selectedCountry: "Norway", selectedCity: "" };

test("filter changes update the same eligible business count used by Search", () => {
  const businesses = [business, { ...business, id: "two", name: "North Bakery", category: "Bakery", deals: [] }];
  const count = (nextFilters) => businesses.filter((item) => businessMatchesFilters(item, nextFilters)).length;
  assert.equal(count(filters), 2);
  assert.equal(count({ ...filters, selectedCategories: ["Bakery"] }), 1);
  assert.equal(count({ ...filters, selectedCategories: ["Restaurants"] }), 0);
  assert.equal(count({ ...filters, searchQuery: "little" }), 1);
  assert.equal(count({ ...filters, selectedCity: "Bergen" }), 0);
});

test("collapsed results summarize the active country, city and categories", () => {
  assert.equal(getSearchFilterSummary({ selectedCountry: "", selectedCity: "", selectedCategories: [] }), "All countries · All cities · All categories");
  assert.equal(getSearchFilterSummary({ selectedCountry: "Norway", selectedCity: "Oslo", selectedCategories: ["Cafés", "Bakery"] }), "Norway · Oslo · Cafés, Bakery");
});

test("active-deal and zero-deal cards use the correct actions", () => {
  const groups = groupSearchBusinesses([business, { ...business, id: "two", deals: [] }], now);
  assert.deepEqual(groups[0].items.map(({ liveDeals }) => liveDeals.length), [1, 0]);
  assert.match(dashboard, /liveDeals\.length \? <button[\s\S]*?View deals<\/button> : null/);
  assert.match(dashboard, /href=\{getBusinessPath\(business\)\}/);
  assert.match(dashboard, /liveDeals\.length \? "border border-white\/16 text-white" : "spotnera-brand-action"/);
});

test("Search opens with filters, then reveals results and keeps Show map separate", () => {
  assert.match(dashboard, /\[showSearchBusinesses, setShowSearchBusinesses\] = useState\(false\)/);
  assert.match(dashboard, /handleViewSearchBusinesses[\s\S]*?setAreFiltersOpen\(false\);\s*setShowSearchBusinesses\(true\)/);
  assert.match(dashboard, /handleHideSearchBusinesses[\s\S]*?setShowSearchBusinesses\(false\);\s*setAreFiltersOpen\(true\)/);
  assert.match(dashboard, /View businesses \(\{filteredBusinesses\.length\}\)/);
  assert.match(dashboard, /Hide businesses/);
  assert.match(dashboard, /Edit filters/);
  assert.match(dashboard, /Show map/);
  assert.match(dashboard, /searchDialogRef[\s\S]*?event\.key === "Escape"/);
});
