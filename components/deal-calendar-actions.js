"use client";

import { useEffect, useState } from "react";
import { buildDealIcs, getDealCalendarWindow, getGoogleCalendarUrl } from "@/lib/deal-calendar.mjs";

export function DealCalendarActions({ business, deal }) {
  const [now, setNow] = useState(null);
  const [message, setMessage] = useState("");
  useEffect(() => {
    const initial = window.setTimeout(() => setNow(new Date()), 0);
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, []);

  const calendarWindow = now && business?.is_active !== false ? getDealCalendarWindow(deal, now) : null;
  if (!calendarWindow) return null;

  function downloadIcs() {
    const currentWindow = getDealCalendarWindow(deal);
    if (!currentWindow) {
      setMessage("This deal no longer has a future calendar window.");
      return;
    }
    try {
      const file = new Blob([buildDealIcs(deal, business, currentWindow)], { type: "text/calendar;charset=utf-8" });
      const url = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = url;
      link.download = "spotnera-deal.ics";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setMessage("Calendar file downloaded. Open it to review and save the event.");
    } catch {
      setMessage("Could not download the calendar file. Please try again.");
    }
  }

  return (
    <details className="mt-4 rounded-[22px] border border-white/10 bg-white/6 p-4">
      <summary className="cursor-pointer text-sm font-semibold text-[#72f0cc] focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#72f0cc]">Add to Calendar</summary>
      <p className="mt-3 text-xs leading-5 text-white/60">
        {calendarWindow.kind === "remaining" ? "Current remaining availability window." :
          deal.availability_mode === "weekly" ? "Next weekly availability window." : "Scheduled deal window."}
        {" "}Review the event in your calendar before saving it.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <a href={getGoogleCalendarUrl(deal, business, calendarWindow)} target="_blank" rel="noopener noreferrer"
          className="spotnera-brand-action inline-flex min-h-11 items-center justify-center rounded-2xl px-4 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#72f0cc]">
          Google Calendar
        </a>
        <button type="button" onClick={downloadIcs}
          className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-white/16 bg-white/10 px-4 text-sm font-bold text-white/82 hover:bg-white/16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#72f0cc]">
          Other calendar (.ics)
        </button>
      </div>
      {message ? <p role="status" aria-live="polite" className="mt-3 text-xs text-white/70">{message}</p> : null}
    </details>
  );
}
