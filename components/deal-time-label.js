"use client";

import { formatDealDateTime, getDealTimingLabel } from "@/lib/deals";

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
