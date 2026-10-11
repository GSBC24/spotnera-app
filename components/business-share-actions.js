"use client";

import { recordBusinessEvent } from "@/lib/business-events";
import { trackEvent } from "@/lib/analytics";
import { getBusinessUrl } from "@/lib/business-url";
import { useBusinessCopyFeedback } from "@/components/use-business-copy-feedback";

const SHARE_PATH = "M12 16V3m0 0L7.5 7.5M12 3l4.5 4.5M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5";
const COPY_PATH = "M8 4h11a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2ZM3 16V4a2 2 0 0 1 2-2h11";

function ActionIcon({ path }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0"><path d={path} /></svg>;
}

export function BusinessShareActions({ businessId, businessSlug, businessCategory, city, country, title, children }) {
  const { feedback, copy, showFeedback } = useBusinessCopyFeedback();
  const shareUrl = getBusinessUrl({ id: businessId, slug: businessSlug });
  const analyticsParameters = {
    business_id: businessId,
    business_category: businessCategory,
    city,
    country,
  };

  async function copyLink(shareMethod = "copy") {
    if (!shareUrl) {
      return;
    }

    await copy(shareUrl, "Link copied", () => {
      trackEvent("business_link_copy", {
        ...analyticsParameters,
        share_method: shareMethod,
      });
      recordBusinessEvent({
        businessId,
        eventType: "business_link_copy",
      });
    });
  }

  async function shareBusiness() {
    if (!shareUrl) {
      return;
    }

    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: `${title} on Spotnera`,
          url: shareUrl,
        });
        showFeedback("Shared");
        trackEvent("business_share", {
          ...analyticsParameters,
          share_method: "native",
        });
        recordBusinessEvent({
          businessId,
          eventType: "business_share",
        });
        return;
      } catch (error) {
        if (error?.name === "AbortError") {
          return;
        }

        console.error("Native share failed", error);
      }
    }

    await copyLink("fallback_copy");
  }

  return (
    <div className="flex flex-wrap items-start gap-2 sm:justify-end">
      <button
        type="button"
        onClick={shareBusiness}
        className="spotnera-primary-action inline-flex min-h-12 items-center justify-center gap-2 px-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#72f0cc]"
      >
        <ActionIcon path={SHARE_PATH} />{feedback === "Shared" ? "Shared" : "Share"}
      </button>
      <button
        type="button"
        onClick={() => copyLink("copy")}
        className="spotnera-secondary-action inline-flex min-h-12 items-center justify-center gap-2 px-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#72f0cc]"
      >
        <ActionIcon path={COPY_PATH} />{feedback === "Link copied" ? "Link copied" : feedback.startsWith("Could not") ? "Copy failed" : "Copy link"}
      </button>
      {children}
      <span role="status" aria-live="polite" className="sr-only">{feedback}</span>
    </div>
  );
}
