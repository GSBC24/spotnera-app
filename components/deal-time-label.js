"use client";

import {
  formatDealDateTime,
  getDealAvailabilityLabel,
  getDealTimingLabel,
} from "@/lib/deals";

export function DealTimeLabel({ deal, fallback }) {
  const label = getDealTimingLabel(deal) || fallback || "";

  return <span suppressHydrationWarning>{label}</span>;
}

export function LocalDealDateTime({ prefix, value }) {
  const label = formatDealDateTime(value);

  if (!label) {
    return null;
  }

  return (
    <span suppressHydrationWarning>
      {prefix}
      {label}
    </span>
  );
}

export function DealAvailabilityLabel({ deal }) {
  return <span suppressHydrationWarning>{getDealAvailabilityLabel(deal)}</span>;
}
