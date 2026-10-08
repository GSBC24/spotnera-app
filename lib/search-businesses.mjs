import { businessCategoryMatches, getBusinessCategoryConfig } from "./business-categories.js";
import { SUPPORTED_COUNTRY_NAMES } from "./supported-countries.js";
import { getLiveDeals } from "./deals.js";

function clean(value) {
  return String(value ?? "").trim();
}

export function businessMatchesFilters(business, filters) {
  if (!business?.is_active || business.suspended_at) return false;
  const search = clean(filters.searchQuery).toLocaleLowerCase("en");
  const country = clean(business.country);
  const city = clean(business.city);
  return (
    (!search || clean(business.name).toLocaleLowerCase("en").includes(search)) &&
    (!filters.selectedCategories.length || filters.selectedCategories.some((category) => businessCategoryMatches(business.category, category))) &&
    (!SUPPORTED_COUNTRY_NAMES.length || SUPPORTED_COUNTRY_NAMES.includes(country)) &&
    (!filters.selectedCountry || country === filters.selectedCountry) &&
    (!filters.selectedCity || city === filters.selectedCity)
  );
}

export function groupSearchBusinesses(businesses, now = new Date()) {
  const groups = new Map();
  for (const business of businesses) {
    if (!business?.is_active || business.suspended_at) continue;
    const category = getBusinessCategoryConfig(business.category).label;
    const liveDeals = getLiveDeals(
      (business.deals ?? []).filter((deal) => !deal.admin_disabled_at),
      now,
    );
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category).push({ business, liveDeals });
  }
  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([category, items]) => ({ category, items }));
}
