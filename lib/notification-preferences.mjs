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

export function normalizeNotificationPreferenceState(preferences) {
  return {
    saved_business_new_deals: preferences?.saved_business_new_deals === true,
    saved_business_deal_starting_soon: timedPreference(preferences, "starting") !== null,
    starting_soon_minutes: validLead("starting", preferences?.starting_soon_minutes)
      ? Number(preferences.starting_soon_minutes) : null,
    saved_business_deal_ending_soon: timedPreference(preferences, "ending") !== null,
    ending_soon_minutes: validLead("ending", preferences?.ending_soon_minutes)
      ? Number(preferences.ending_soon_minutes) : null,
    weekly_deals_email: preferences?.weekly_deals_email === true,
    new_deal_email: preferences?.new_deal_email === true,
  };
}

export function resolveNotificationPreferenceState(actionState, draft) {
  return actionState?.success && actionState.preferences &&
    draft.baseActionState !== actionState
    ? normalizeNotificationPreferenceState(actionState.preferences) : draft.values;
}
