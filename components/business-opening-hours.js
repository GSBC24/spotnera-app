"use client";

import { useEffect, useState } from "react";
import {
  BUSINESS_TIME_ZONE, BUSINESS_WEEKDAYS, formatBusinessDayHours,
  getBusinessOpeningStatus, getBusinessTodayIndex,
} from "@/lib/business-opening-hours.mjs";

export function BusinessOpeningStatus({ hours, className = "", currentTime }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (currentTime) return undefined;
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, [currentTime]);
  const status = getBusinessOpeningStatus(hours, currentTime ?? now, BUSINESS_TIME_ZONE);
  return <p className={`break-words text-sm font-semibold ${status.state === "open" ? "text-[#72f0cc]" : "text-white/70"} ${className}`}>{status.label}</p>;
}

export function BusinessOpeningHoursPanel({ hours }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const byDay = new Map((hours ?? []).map((row) => [Number(row.day_of_week), row]));
  const hasHours = Boolean(hours?.length);
  const todayIndex = getBusinessTodayIndex(now, BUSINESS_TIME_ZONE);
  return (
    <section className="spotnera-surface min-w-0 rounded-[30px] p-4 sm:p-5">
      <h2 className="spotnera-kicker text-white/42">Opening hours</h2>
      <BusinessOpeningStatus hours={hours} currentTime={now} className="mt-3" />
      {hasHours ? (
        <>
          <p className="mt-3 flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-xl bg-white/5 px-3 py-2 text-sm">
            <span className="font-semibold text-white/70">Today</span>
            <span className="font-bold text-white [overflow-wrap:anywhere]">{todayIndex ? formatBusinessDayHours(byDay.get(todayIndex)) : "Hours unavailable"}</span>
          </p>
          <details className="mt-2 min-w-0">
            <summary className="min-h-11 cursor-pointer rounded-xl py-3 text-sm font-semibold text-[#72f0cc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#72f0cc]">View all hours</summary>
            <dl className="grid min-w-0 gap-2 border-t border-white/10 pt-3">
              {BUSINESS_WEEKDAYS.map((day, index) => (
                <div key={day} className={`grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-2 rounded-xl px-2 py-1 text-sm ${todayIndex === index + 1 ? "bg-white/8" : ""}`}>
                  <dt className={`break-words font-medium ${todayIndex === index + 1 ? "text-[#72f0cc]" : "text-white/72"}`}>
                    {day}{todayIndex === index + 1 ? <span className="sr-only"> (today)</span> : null}
                  </dt>
                  <dd className="break-words text-right text-white/88">{formatBusinessDayHours(byDay.get(index + 1))}</dd>
                </div>
              ))}
            </dl>
          </details>
        </>
      ) : <p className="mt-2 text-sm text-white/56">Opening hours not provided.</p>}
    </section>
  );
}
