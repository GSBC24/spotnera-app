import { classifyPublicProfileDeal } from "./public-profile-deals.mjs";

export function countMapUpcomingDeals(deals, activeBusinessIds, now = new Date()) {
  const counts = new Map();
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
    counts.set(deal.business_id, (counts.get(deal.business_id) ?? 0) + 1);
  }

  return counts;
}
