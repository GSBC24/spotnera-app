import { getLiveDeals } from "./deals.js";
import { canonicalInterest } from "./personalization.mjs";

export function getDiscoverableDeals(business, now = new Date()) {
  return getLiveDeals(business.deals ?? [], now);
}

export function partitionDiscoveryDeals(businesses, userId, now = new Date(), interests = []) {
  const saved = [];
  const general = [];
  const seenIds = new Set();

  const orderedBusinesses = userId
    ? [...businesses.filter((business) => business.isFavorite), ...businesses.filter((business) => !business.isFavorite)]
    : businesses;
  for (const business of orderedBusinesses) {
    for (const deal of getDiscoverableDeals(business, now)) {
      if (seenIds.has(deal.id)) continue;
      seenIds.add(deal.id);
      const item = { business, deal };
      (userId && business.isFavorite ? saved : general).push(item);
    }
  }

  if (userId && interests.length) {
    const selected = new Set(interests);
    const matching = [];
    const remaining = [];
    for (const item of general) {
      (selected.has(canonicalInterest(item.business.category)) ? matching : remaining).push(item);
    }
    return { saved, general: [...matching, ...remaining] };
  }
  return { saved, general };
}
