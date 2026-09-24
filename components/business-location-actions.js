"use client";

import { useState } from "react";
import {
  copyBusinessAddress,
  getBusinessDirectionsUrl,
  getCopyableBusinessAddress,
} from "@/lib/business-address.mjs";

export function BusinessLocationActions({ business, className = "" }) {
  const [feedback, setFeedback] = useState("");
  const address = getCopyableBusinessAddress(business);
  const directionsUrl = getBusinessDirectionsUrl(business);
  if (!address && !directionsUrl) return null;

  return (
    <div className={`min-w-0 ${className}`}>
      <div className="flex min-w-0 flex-wrap gap-2">
        {directionsUrl ? (
          <a href={directionsUrl} target="_blank" rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center rounded-xl border border-white/12 bg-white/8 px-3 text-xs font-semibold text-white/78 transition hover:bg-white/14 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#72f0cc]">
            Directions
          </a>
        ) : null}
        {address ? (
          <button type="button" aria-label="Copy business address"
            onClick={async () => setFeedback(await copyBusinessAddress(address) ? "Address copied" : "Could not copy. Select the address above.")}
            className="inline-flex min-h-11 items-center rounded-xl border border-white/12 bg-white/8 px-3 text-xs font-semibold text-white/78 transition hover:bg-white/14 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#72f0cc]">
            Copy address
          </button>
        ) : null}
      </div>
      <p role="status" aria-live="polite" className="mt-1 min-h-4 break-words text-xs text-white/60">{feedback}</p>
    </div>
  );
}
