"use client";

import { useState } from "react";
import { trackEvent } from "@/lib/analytics";

export function CopyProfileLinkButton({
  businessCategory,
  businessId,
  city,
  country,
  label = "Copy profile link",
  url,
}) {
  const [message, setMessage] = useState(null);

  async function copyLink() {
    const link = url || `${window.location.origin}/business/${businessId}`;

    try {
      await navigator.clipboard.writeText(link);
      setMessage("Link copied");
      trackEvent("business_link_copy", {
        business_id: businessId,
        business_category: businessCategory,
        city,
        country,
        share_method: "owner_dashboard_copy",
      });
    } catch (error) {
      console.error("Profile link copy failed", error);
      setMessage("Unable to copy");
    }
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <button
        type="button"
        onClick={copyLink}
        className="spotnera-secondary-action inline-flex min-h-10 items-center justify-center px-4 text-xs"
      >
        {label}
      </button>
      {message ? <span className="text-xs font-semibold text-zinc-500">{message}</span> : null}
    </span>
  );
}
