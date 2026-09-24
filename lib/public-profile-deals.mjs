import { DEAL_STATUS, getDealStatus } from "./deals.js";

function timestamp(value, fallback) {
  if (!value) return fallback;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : fallback;
}

function compareId(left, right) {
  return String(left.id).localeCompare(String(right.id));
}

export function classifyPublicProfileDeal(deal, now = new Date()) {
  if (deal?.is_active !== true) return "excluded";
  const status = getDealStatus(deal, now);
  if (status === DEAL_STATUS.LIVE) return "active";
  if (status === DEAL_STATUS.SCHEDULED) return "upcoming";
  return "excluded";
}

export function partitionPublicProfileDeals(deals = [], now = new Date()) {
  const active = [];
  const upcoming = [];
  for (const deal of deals) {
    const classification = classifyPublicProfileDeal(deal, now);
    if (classification === "active") active.push(deal);
    if (classification === "upcoming") upcoming.push(deal);
  }
  active.sort((left, right) =>
    timestamp(left.ends_at, Infinity) - timestamp(right.ends_at, Infinity) || compareId(left, right));
  upcoming.sort((left, right) =>
    timestamp(left.starts_at, Infinity) - timestamp(right.starts_at, Infinity) || compareId(left, right));
  return { active, upcoming };
}
