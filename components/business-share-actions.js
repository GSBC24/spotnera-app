"use client";

import { useState } from "react";
import { recordBusinessEvent } from "@/lib/business-events";
import { trackEvent } from "@/lib/analytics";
import { getBusinessUrl } from "@/lib/business-url";

export function BusinessShareActions({ businessId, businessSlug, businessCategory, city, country, title }) {
  const [message, setMessage] = useState(null);
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

    try {
      await navigator.clipboard.writeText(shareUrl);
      setMessage("Link copied");
      trackEvent("business_link_copy", {
        ...analyticsParameters,
        share_method: shareMethod,
      });
      recordBusinessEvent({
        businessId,
        eventType: "business_link_copy",
      });
    } catch (error) {
      console.error("Business link copy failed", error);
      setMessage("Unable to copy link");
    }
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
        setMessage("Shared");
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
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <button
        type="button"
        onClick={shareBusiness}
        className="spotnera-primary-action inline-flex min-h-12 items-center justify-center px-5 text-sm"
      >
        Share business
      </button>
      <button
        type="button"
        onClick={() => copyLink("copy")}
        className="spotnera-secondary-action inline-flex min-h-12 items-center justify-center px-5 text-sm"
      >
        Copy link
      </button>
      {message ? (
        <p className="text-center text-xs font-bold text-white/64 sm:text-left">
          {message}
        </p>
      ) : null}
    </div>
  );
}
