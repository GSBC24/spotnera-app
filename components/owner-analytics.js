"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { trackEvent } from "@/lib/analytics";
import { DEAL_STATUS, getDealStatus } from "@/lib/deals";

const SubmissionLockContext = createContext(false);

function SubmissionCompletion({ onComplete }) {
  const { pending } = useFormStatus();
  const wasPendingRef = useRef(false);

  useEffect(() => {
    if (pending) {
      wasPendingRef.current = true;
      return;
    }

    if (wasPendingRef.current) {
      wasPendingRef.current = false;
      onComplete();
    }
  }, [onComplete, pending]);

  return null;
}

export function LockedFormSubmitButton({ children, pendingLabel }) {
  const { pending } = useFormStatus();
  const isLocked = useContext(SubmissionLockContext);
  const isSubmitting = pending || isLocked;

  return (
    <button
      type="submit"
      data-analytics-submit="true"
      disabled={isSubmitting}
      aria-disabled={isSubmitting}
      className="spotnera-primary-action px-4 text-sm disabled:cursor-wait disabled:opacity-55"
    >
      {isSubmitting ? pendingLabel : children}
    </button>
  );
}

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
  preventDuplicateSubmissions = false,
}) {
  const submissionLockRef = useRef(false);
  const [isSubmissionLocked, setIsSubmissionLocked] = useState(false);

  function releaseSubmissionLock() {
    submissionLockRef.current = false;
    setIsSubmissionLocked(false);
  }

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
      const dealStatus = getDealStatus({
        is_active: formData.get("is_active") === "on",
        starts_at: String(formData.get("starts_at") ?? "") || null,
        ends_at: String(formData.get("ends_at") ?? "") || null,
      });

      return {
        deal_id: analyticsContext.dealId,
        business_id: String(formData.get("business_id") ?? "").trim(),
        deal_status: dealStatus.toLowerCase(),
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
        const isTrackedSubmission =
          submitter?.dataset.analyticsSubmit === "true" ||
          (preventDuplicateSubmissions && !submitter);

        if (!event.currentTarget.checkValidity() || !isTrackedSubmission) {
          return;
        }

        if (preventDuplicateSubmissions && submissionLockRef.current) {
          event.preventDefault();
          return;
        }

        if (preventDuplicateSubmissions) {
          submissionLockRef.current = true;
          setIsSubmissionLocked(true);
        }

        const formData = new FormData(event.currentTarget);
        const eventParameters = getEventParameters(formData);
        trackEvent(eventName, eventParameters);

        if (
          eventName === "deal_create" &&
          eventParameters.deal_status === DEAL_STATUS.SCHEDULED.toLowerCase()
        ) {
          trackEvent("deal_schedule", eventParameters);
        }
      }}
    >
      <SubmissionLockContext.Provider value={isSubmissionLocked}>
        {children}
        {preventDuplicateSubmissions ? (
          <SubmissionCompletion onComplete={releaseSubmissionLock} />
        ) : null}
      </SubmissionLockContext.Provider>
    </form>
  );
}
