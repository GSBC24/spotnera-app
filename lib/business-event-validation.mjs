export const EVENT_TYPES = new Set([
  "business_view", "deal_view", "deal_click", "deal_save",
  "website_click", "directions_click", "call_click",
  "email_click", "social_click", "favorite_add", "favorite_remove",
  "business_share", "business_link_copy",
]);

export const EVENT_SOURCES = new Set(["deals", "saved", "map", "business_profile", "search"]);
export const DEAL_EVENT_TYPES = new Set(["deal_view", "deal_click", "deal_save"]);
const PHASE_F_TYPES = new Set(["business_view", "deal_view", "deal_click", "deal_save",
  "website_click", "directions_click", "call_click"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateBusinessEvent(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      Object.keys(value).some((key) => !["businessId", "eventType", "dealId", "source"].includes(key))) {
    return null;
  }
  const { businessId, eventType, dealId = null, source = null } = value;
  if (!UUID.test(businessId) || !EVENT_TYPES.has(eventType) ||
      (source !== null && !EVENT_SOURCES.has(source)) ||
      (PHASE_F_TYPES.has(eventType) && source === null) ||
      (DEAL_EVENT_TYPES.has(eventType) ? !UUID.test(dealId) : dealId !== null)) return null;
  return { businessId, eventType, dealId, source };
}

export function isEligibleEventBusiness(business, eventType) {
  if (!business?.is_active) return false;
  if (eventType === "website_click") {
    const raw = String(business.website_url ?? "").trim();
    if (!raw) return false;
    try {
      const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(raw) ? raw : `https://${raw}`);
      return ["http:", "https:"].includes(url.protocol) && url.hostname.includes(".");
    } catch { return false; }
  }
  if (eventType === "call_click") {
    const phone = String(business.phone ?? "").trim();
    return /^\+?[\d\s().-]{6,32}$/.test(phone) && /\d/.test(phone);
  }
  if (eventType === "directions_click") {
    return (business.latitude !== null && business.latitude !== "" &&
      business.longitude !== null && business.longitude !== "" &&
      Number.isFinite(Number(business.latitude)) && Number.isFinite(Number(business.longitude))) ||
      Boolean(String(business.address ?? "").trim());
  }
  return true;
}

export function isEligibleEventDeal(deal, businessId, now = new Date()) {
  return Boolean(deal && deal.business_id === businessId && deal.is_active === true &&
    (deal.ends_at === null || (Number.isFinite(Date.parse(deal.ends_at)) && Date.parse(deal.ends_at) > now.getTime())));
}
