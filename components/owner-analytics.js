"use client";

import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics";

export function OwnerDashboardAnalytics({
  businessCount = 0,
  activeDealCount = 0,
}) {
  useEffect(() => {
    trackEvent("owner_dashboard_view", {
      business_count: businessCount,
      active_deal_count: activeDealCount,
    });
  }, [activeDealCount, businessCount]);

  return null;
}

export function AnalyticsForm({
  action,
  analyticsContext = {},
  children,
  className,
  encType,
  eventName,
}) {
  function getEventParameters(formData) {
    if (eventName === "business_create" || eventName === "business_update") {
      return {
        business_id: analyticsContext.businessId,
        business_category: String(formData.get("category") ?? "").trim(),
        country: String(formData.get("country") ?? "").trim(),
        city: String(formData.get("city") ?? "").trim(),
      };
    }

    if (eventName === "deal_create" || eventName === "deal_update") {
      return {
        deal_id: analyticsContext.dealId,
        business_id: String(formData.get("business_id") ?? "").trim(),
        deal_status: String(formData.get("status") ?? "").trim(),
      };
    }

    return {};
  }

  return (
    <form
      action={action}
      encType={encType}
      className={className}
      onSubmit={(event) => {
        const submitter = event.nativeEvent.submitter;

        if (!event.currentTarget.checkValidity() || submitter?.dataset.analyticsSubmit !== "true") {
          return;
        }

        const formData = new FormData(event.currentTarget);
        trackEvent(eventName, getEventParameters(formData));
      }}
    >
      {children}
    </form>
  );
}
