export const SPOTNERA_APP_URL = "https://app.spotnera.com";

export function getBusinessPath(business) {
  const identifier = String(business?.slug || business?.id || "").trim();

  return identifier ? `/business/${encodeURIComponent(identifier)}` : "/business";
}

export function getBusinessUrl(business, origin = SPOTNERA_APP_URL) {
  return `${origin.replace(/\/$/, "")}${getBusinessPath(business)}`;
}
