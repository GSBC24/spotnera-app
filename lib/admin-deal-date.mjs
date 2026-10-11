import { DEFAULT_DEAL_AVAILABILITY_TIMEZONE } from "./deals.js";

export function adminDealDate(value, timeZone) {
  if (!value) return "Not specified";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Not specified";

  const options = {
    timeZone: timeZone || DEFAULT_DEAL_AVAILABILITY_TIMEZONE,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  };
  try {
    return new Intl.DateTimeFormat("en-GB", options).format(date);
  } catch {
    return new Intl.DateTimeFormat("en-GB", {
      ...options, timeZone: DEFAULT_DEAL_AVAILABILITY_TIMEZONE,
    }).format(date);
  }
}
