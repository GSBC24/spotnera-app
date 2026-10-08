"use client";

import { useState } from "react";
import { recordBusinessEvent } from "@/lib/business-events";
import {
  copyBusinessAddress,
  getBusinessDirectionsUrl,
  getCopyableBusinessAddress,
} from "@/lib/business-address.mjs";

const NAVIGATION_PATH = "M3 11.5 21 3l-7.5 18-2-7.5L3 11.5z";
const COPY_PATH = "M8 3h12v15H8V3zM4 7h2v13h11v2H4V7z";

function UtilityIcon({ path }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 shrink-0"><path fill="currentColor" d={path} /></svg>;
}

export function BusinessLocationActions({ business, className = "", source = "map", compact = false }) {
  const [feedback, setFeedback] = useState("");
  const address = getCopyableBusinessAddress(business);
  const directionsUrl = getBusinessDirectionsUrl(business);
  if (!address && !directionsUrl) return null;
  const actionClass = `inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-white/12 text-xs font-semibold text-white/78 transition hover:bg-white/14 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#72f0cc] ${compact ? "bg-transparent px-2.5" : "bg-white/8 px-3"}`;

  return (
    <div className={`min-w-0 ${className}`}>
      <div className="flex min-w-0 flex-wrap gap-2">
        {directionsUrl ? (
          <a href={directionsUrl} target="_blank" rel="noopener noreferrer"
            onClick={(event) => {
              event.stopPropagation();
              recordBusinessEvent({ businessId: business.id, eventType: "directions_click", source });
            }}
            className={actionClass}>
            {compact ? <UtilityIcon path={NAVIGATION_PATH} /> : null}
            Directions
          </a>
        ) : null}
        {address ? (
          <button type="button" aria-label="Copy business address"
            onClick={async (event) => {
              event.stopPropagation();
              setFeedback(await copyBusinessAddress(address) ? "Address copied" : "Could not copy. Select the address above.");
            }}
            className={actionClass}>
            {compact ? <UtilityIcon path={COPY_PATH} /> : null}
            Copy address
          </button>
        ) : null}
      </div>
      <p role="status" aria-live="polite" className={feedback ? "mt-1 break-words text-xs text-white/60" : "sr-only"}>{feedback}</p>
    </div>
  );
}
