"use client";

import { useEffect, useRef } from "react";
import { recordBusinessEvent } from "@/lib/business-events";
import { trackEvent } from "@/lib/analytics";

export function BusinessProfileAnalytics({ businessId, businessCategory, city, country }) {
  const trackedBusinessId = useRef(null);

  useEffect(() => {
    if (!businessId || trackedBusinessId.current === businessId) {
      return;
    }

    trackedBusinessId.current = businessId;
    trackEvent("public_business_view", {
      business_id: businessId,
      business_category: businessCategory,
      city,
      country,
    });
    recordBusinessEvent({
      businessId,
      eventType: "profile_view",
    });
  }, [businessCategory, businessId, city, country]);

  return null;
}
