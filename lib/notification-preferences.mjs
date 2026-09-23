export const STARTING_LEADS = [30, 60, 120];
export const ENDING_LEADS = [30, 60];

export function validLead(kind, value) {
  const allowed = kind === "starting" ? STARTING_LEADS : ENDING_LEADS;
  return typeof value === "number" && Number.isInteger(value) && allowed.includes(value)
    || typeof value === "string" && allowed.some((minutes) => value === String(minutes));
}

export function timedPreference(preferences, kind) {
  const toggle = kind === "starting"
    ? "saved_business_deal_starting_soon" : "saved_business_deal_ending_soon";
  const minutes = kind === "starting" ? "starting_soon_minutes" : "ending_soon_minutes";
  return preferences?.[toggle] === true && validLead(kind, preferences?.[minutes])
    ? Number(preferences[minutes]) : null;
}

export function parseTimedPreference(formData, kind, previousMinutes) {
  const toggle = kind === "starting"
    ? "saved_business_deal_starting_soon" : "saved_business_deal_ending_soon";
  const minutes = kind === "starting" ? "starting_soon_minutes" : "ending_soon_minutes";
  const enabled = formData.get(toggle) === "on";
  const supplied = formData.get(minutes);
  if ((enabled && supplied === null) ||
      (supplied !== null && (typeof supplied !== "string" || !validLead(kind, supplied)))) {
    return null;
  }
  const retained = typeof supplied === "string" && validLead(kind, supplied) ? Number(supplied) :
    validLead(kind, previousMinutes) ? Number(previousMinutes) : null;
  return { [toggle]: enabled, [minutes]: enabled ? Number(supplied) : retained };
}
