"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { getBusinessPath } from "@/lib/business-url";
import {
  DEAL_AVAILABILITY_MODE,
  DEAL_STATUS_META,
  DEAL_WEEKDAYS,
  DEFAULT_DEAL_AVAILABILITY_TIMEZONE,
  formatScheduleTime,
  getDealAvailabilityLabel,
  getDealStatus,
} from "@/lib/deals";

function formatValidity(value, timeZone) {
  if (!value) return null;
  const instant = new Date(value);
  if (!Number.isFinite(instant.getTime())) return null;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(instant);
}

export function DealDetailsDialog({ business, deal, onClose }) {
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const timeZone = deal.availability_timezone || DEFAULT_DEAL_AVAILABILITY_TIMEZONE;
  const status = getDealStatus(deal);
  const schedules = [...(deal.deal_schedules ?? [])].sort((left, right) =>
    Number(left.day_of_week) - Number(right.day_of_week) ||
    String(left.start_time).localeCompare(String(right.start_time)),
  );
  const startsAt = formatValidity(deal.starts_at, timeZone);
  const endsAt = formatValidity(deal.ends_at, timeZone);

  useEffect(() => {
    const opener = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      } else if (event.key === "Tab") {
        const focusable = [...dialogRef.current.querySelectorAll(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        )];
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (opener?.isConnected) opener.focus();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 px-3 pb-3 pt-12 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="deal-details-title"
        aria-describedby="deal-details-summary"
        className="max-h-[min(90vh,800px)] w-full max-w-xl overflow-y-auto rounded-[30px] border border-white/16 bg-[#151821] p-5 text-white shadow-[0_30px_90px_rgba(0,0,0,0.6)] sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#72f0cc]">{business.name}</p>
            <h2 id="deal-details-title" className="mt-2 text-2xl font-semibold leading-tight">{deal.title}</h2>
          </div>
          <button ref={closeButtonRef} type="button" onClick={onClose} aria-label="Close deal details"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/16 bg-white/10 text-2xl text-white transition hover:bg-white/16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#72f0cc]">
            &times;
          </button>
        </div>

        <div id="deal-details-summary" className="mt-5 flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-[#33d6a6]/30 bg-[#33d6a6]/12 px-3 py-1.5 text-xs font-bold text-[#72f0cc]">
            {getDealAvailabilityLabel(deal)}
          </span>
          <span className="rounded-full border border-white/14 bg-white/8 px-3 py-1.5 text-xs font-semibold text-white/70">
            {DEAL_STATUS_META[status].label}
          </span>
        </div>

        {deal.description ? (
          <div className="mt-5 rounded-[22px] border border-white/10 bg-white/6 p-4">
            <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-white/58">About this deal</h3>
            <p className="mt-2 whitespace-pre-line text-sm leading-6 text-white/82">{deal.description}</p>
          </div>
        ) : null}

        <div className="mt-4 rounded-[22px] border border-white/10 bg-white/6 p-4">
          <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-white/58">Availability</h3>
          {deal.availability_mode === DEAL_AVAILABILITY_MODE.WEEKLY ? (
            <>
              <p className="mt-2 text-sm font-semibold text-white">Weekly schedule</p>
              <p className="mt-1 text-xs text-white/58">Local time in {timeZone}</p>
              {schedules.length ? (
                <ul className="mt-3 grid gap-2">
                  {schedules.map((schedule) => {
                    const weekday = DEAL_WEEKDAYS.find((day) => day.value === Number(schedule.day_of_week));
                    const start = formatScheduleTime(schedule.start_time);
                    const end = formatScheduleTime(schedule.end_time);
                    return (
                      <li key={schedule.id ?? `${schedule.day_of_week}-${schedule.start_time}`}
                        className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-xl bg-black/24 px-3 py-2 text-sm">
                        <span className="font-semibold text-white/86">{weekday?.label ?? "Weekday"}</span>
                        <span className="text-white/72">{start}–{end}{schedule.spans_midnight ? " (ends next day)" : ""}</span>
                      </li>
                    );
                  })}
                </ul>
              ) : <p className="mt-3 text-sm text-white/58">No weekly hours set.</p>}
            </>
          ) : (
            <>
              <p className="mt-2 text-sm font-semibold text-white">Continuous availability</p>
              <p className="mt-1 text-sm leading-6 text-white/70">
                Available continuously while this deal is active{startsAt || endsAt ? " within the validity period below" : ""}.
              </p>
            </>
          )}
        </div>

        {startsAt || endsAt ? (
          <div className="mt-4 rounded-[22px] border border-white/10 bg-white/6 p-4">
            <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-white/58">Validity</h3>
            <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
              {startsAt ? <div><dt className="text-white/52">Starts</dt><dd className="mt-1 font-semibold text-white/86">{startsAt}</dd></div> : null}
              {endsAt ? <div><dt className="text-white/52">Ends</dt><dd className="mt-1 font-semibold text-white/86">{endsAt}</dd></div> : null}
            </dl>
          </div>
        ) : null}

        <Link href={getBusinessPath(business)}
          className="spotnera-brand-action mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-2xl px-4 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#72f0cc]">
          View business
        </Link>
      </section>
    </div>
  );
}
