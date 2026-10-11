"use client";

import { recordBusinessEvent } from "@/lib/business-events";
import {
  getBusinessDirectionsUrl,
  getCopyableBusinessAddress,
} from "@/lib/business-address.mjs";
import { useBusinessCopyFeedback } from "@/components/use-business-copy-feedback";

const NAVIGATION_PATH = "M3 11.5 21 3l-7.5 18-2-7.5L3 11.5z";
const COPY_PATH = "M8 3h12v15H8V3zM4 7h2v13h11v2H4V7z";

function UtilityIcon({ path }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 shrink-0"><path fill="currentColor" d={path} /></svg>;
}

export function BusinessLocationActions({ business, className = "", source = "map", compact = false }) {
  const { feedback, copy } = useBusinessCopyFeedback();
  const address = getCopyableBusinessAddress(business);
  const directionsUrl = getBusinessDirectionsUrl(business);
  if (!address && !directionsUrl) return null;
  const actionClass = `inline-flex min-h-12 min-w-0 items-center justify-center gap-2 rounded-xl border border-white/12 text-xs font-semibold text-white/78 transition hover:bg-white/14 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#72f0cc] ${compact ? "bg-transparent px-2.5" : "bg-white/8 px-4"}`;

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
            <UtilityIcon path={NAVIGATION_PATH} />
            Directions
          </a>
        ) : null}
        {address ? (
          <button type="button" aria-label="Copy business address"
            onClick={async (event) => {
              event.stopPropagation();
              await copy(address, "Address copied");
            }}
            className={actionClass}>
            <UtilityIcon path={COPY_PATH} />
            {feedback === "Address copied" ? "Address copied" : feedback ? "Copy failed" : "Copy address"}
          </button>
        ) : null}
      </div>
      <span role="status" aria-live="polite" className="sr-only">{feedback}</span>
    </div>
  );
}
