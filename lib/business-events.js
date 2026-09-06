import { createClient } from "@/utils/supabase/browser";

export const BUSINESS_EVENT_TYPES = new Set([
  "profile_view",
  "deal_view",
  "website_click",
  "call_click",
  "email_click",
  "social_click",
  "favorite_add",
  "favorite_remove",
  "business_share",
  "business_link_copy",
]);

export function recordBusinessEvent({ businessId, eventType, dealId } = {}) {
  if (!businessId || !BUSINESS_EVENT_TYPES.has(eventType)) {
    return;
  }

  try {
    const supabase = createClient();
    const payload = {
      business_id: businessId,
      event_type: eventType,
      ...(eventType === "deal_view" && dealId ? { deal_id: dealId } : {}),
    };

    void supabase
      .from("business_events")
      .insert(payload)
      .then(({ error }) => {
        if (error && process.env.NODE_ENV !== "production") {
          console.warn(`Business event tracking failed: ${eventType}`, error);
        }
      });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`Business event tracking failed: ${eventType}`, error);
    }
  }
}
