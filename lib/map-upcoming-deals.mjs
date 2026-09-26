import { classifyPublicProfileDeal } from "./public-profile-deals.mjs";

export function groupMapUpcomingDeals(deals, activeBusinessIds, now = new Date()) {
  const groups = new Map();
  const activeIds = new Set(activeBusinessIds);
  const seenDeals = new Set();
  const nowTime = now.getTime();

  for (const deal of deals) {
    if (!activeIds.has(deal.business_id) || !deal.id || seenDeals.has(deal.id)) continue;
    const startsAt = Date.parse(deal.starts_at);
    const endsAt = deal.ends_at == null ? null : Date.parse(deal.ends_at);
    if (!Number.isFinite(startsAt) || startsAt <= nowTime ||
        (endsAt !== null && (!Number.isFinite(endsAt) || endsAt <= nowTime)) ||
        classifyPublicProfileDeal(deal, now) !== "upcoming") continue;
    seenDeals.add(deal.id);
    const businessDeals = groups.get(deal.business_id) ?? [];
    businessDeals.push(deal);
    groups.set(deal.business_id, businessDeals);
  }

  for (const businessDeals of groups.values()) {
    businessDeals.sort((left, right) =>
      Date.parse(left.starts_at) - Date.parse(right.starts_at) ||
      String(left.id).localeCompare(String(right.id)));
  }

  return groups;
}

export function countMapUpcomingDeals(deals, activeBusinessIds, now = new Date()) {
  const counts = new Map();
  for (const [businessId, businessDeals] of groupMapUpcomingDeals(deals, activeBusinessIds, now)) {
    counts.set(businessId, businessDeals.length);
  }
  return counts;
}
