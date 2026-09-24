"use client";

import { useEffect, useState } from "react";
import {
  BUSINESS_TIME_ZONE, BUSINESS_WEEKDAYS, formatBusinessDayHours,
  getBusinessOpeningStatus,
} from "@/lib/business-opening-hours.mjs";

export function BusinessOpeningStatus({ hours, className = "" }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const status = getBusinessOpeningStatus(hours, now, BUSINESS_TIME_ZONE);
  return <p className={`break-words text-sm font-semibold ${status.state === "open" ? "text-[#72f0cc]" : "text-white/70"} ${className}`}>{status.label}</p>;
}

export function BusinessOpeningHoursPanel({ hours }) {
  const byDay = new Map((hours ?? []).map((row) => [Number(row.day_of_week), row]));
  const hasHours = Boolean(hours?.length);
  return (
    <section className="spotnera-surface min-w-0 rounded-[30px] p-4 sm:p-5">
      <h2 className="spotnera-kicker text-white/42">Opening hours</h2>
      <BusinessOpeningStatus hours={hours} className="mt-3" />
      {hasHours ? (
        <details className="mt-3 min-w-0">
          <summary className="min-h-11 cursor-pointer rounded-xl py-3 text-sm font-semibold text-[#72f0cc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#72f0cc]">View all hours</summary>
          <dl className="grid min-w-0 gap-2 border-t border-white/10 pt-3">
            {BUSINESS_WEEKDAYS.map((day, index) => (
              <div key={day} className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-2 text-sm">
                <dt className="break-words font-medium text-white/72">{day}</dt>
                <dd className="break-words text-right text-white/88">{formatBusinessDayHours(byDay.get(index + 1))}</dd>
              </div>
            ))}
          </dl>
        </details>
      ) : <p className="mt-2 text-sm text-white/56">Opening hours not provided.</p>}
    </section>
  );
}
