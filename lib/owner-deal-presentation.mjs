import {
  DEAL_AVAILABILITY_MODE,
  DEAL_STATUS,
  getDealAvailabilityLabel,
  getDealStatus,
  getDealTimingLabel,
} from "./deals.js";

export function getOwnerDealTimingLabel(deal, now = new Date()) {
  const status = getDealStatus(deal, now);
  if (status === DEAL_STATUS.LIVE && deal?.availability_mode === DEAL_AVAILABILITY_MODE.WEEKLY) {
    return getDealAvailabilityLabel(deal, now);
  }
  if (status === DEAL_STATUS.DISABLED) return "Not visible to customers";
  const timing = getDealTimingLabel(deal, now);
  if (status === DEAL_STATUS.LIVE) {
    if (timing.startsWith("Active until ")) return timing.replace("Active until ", "Ends ");
    if (timing.startsWith("Active since ")) return timing.replace("Active since ", "Started ");
    return "Available now";
  }
  return timing;
}
