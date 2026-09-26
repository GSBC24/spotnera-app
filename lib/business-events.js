import { validateBusinessEvent } from "./business-event-validation.mjs";

export function recordBusinessEvent(event) {
  const payload = validateBusinessEvent(event);
  if (!payload || typeof window === "undefined") return;
  try {
    void fetch("/api/business-events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Recording is best effort; never interrupt the requested action.
  }
}

export function recordDealClick(business, deal, source) {
  recordBusinessEvent({ businessId: business?.id, dealId: deal?.id, eventType: "deal_click", source });
}
