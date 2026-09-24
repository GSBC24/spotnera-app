"use client";

import { useState } from "react";
import { BUSINESS_WEEKDAYS } from "@/lib/business-opening-hours.mjs";

export function BusinessOpeningHoursFields({ hours = [] }) {
  const [configured, setConfigured] = useState(hours.length > 0);
  const [openDays, setOpenDays] = useState(() => Object.fromEntries(
    BUSINESS_WEEKDAYS.map((_, index) => [index + 1, Boolean(hours.find((row) => Number(row.day_of_week) === index + 1 && !row.is_closed))]),
  ));
  const [times, setTimes] = useState(() => Object.fromEntries(BUSINESS_WEEKDAYS.map((_, index) => {
    const row = hours.find((item) => Number(item.day_of_week) === index + 1);
    return [index + 1, { open: row?.open_time?.slice(0, 5) ?? "09:00", close: row?.close_time?.slice(0, 5) ?? "17:00" }];
  })));
  return (
    <section className="min-w-0 rounded-3xl border border-zinc-200 bg-zinc-50 p-3">
      <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-500">Opening hours</h3>
      <p className="mt-1 text-xs leading-5 text-zinc-600">Optional business hours in Europe/Oslo. Separate from deal availability.</p>
      <label className="mt-3 flex min-h-11 items-center gap-3 text-sm font-semibold text-zinc-800">
        <input className="h-5 w-5 shrink-0 accent-zinc-950" type="checkbox" name="opening_hours_configured" checked={configured} onChange={(event) => setConfigured(event.target.checked)} />
        Provide opening hours
      </label>
      {configured ? <div className="mt-2 grid min-w-0 gap-2">
        {BUSINESS_WEEKDAYS.map((day, index) => {
          const number = index + 1;
          return <div key={day} className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-bold text-zinc-800">{day}</span>
              <label className="flex min-h-10 items-center gap-2 text-xs font-semibold text-zinc-700">
                <input type="checkbox" name={`opening_day_${number}_open`} checked={openDays[number]} onChange={(event) => setOpenDays((current) => ({ ...current, [number]: event.target.checked }))} className="h-5 w-5 accent-zinc-950" />Open
              </label>
            </div>
            {openDays[number] ? <div className="mt-2 grid min-w-0 grid-cols-2 gap-2">
              <label className="min-w-0 text-xs font-medium text-zinc-600">Opens
                <input type="time" name={`opening_day_${number}_start`} required value={times[number].open} onChange={(event) => setTimes((current) => ({ ...current, [number]: { ...current[number], open: event.target.value } }))} className="mt-1 min-h-11 w-full min-w-0 rounded-xl border border-zinc-200 bg-white px-2 text-sm text-zinc-900" />
              </label>
              <label className="min-w-0 text-xs font-medium text-zinc-600">Closes
                <input type="time" name={`opening_day_${number}_end`} required value={times[number].close} onChange={(event) => setTimes((current) => ({ ...current, [number]: { ...current[number], close: event.target.value } }))} className="mt-1 min-h-11 w-full min-w-0 rounded-xl border border-zinc-200 bg-white px-2 text-sm text-zinc-900" />
              </label>
            </div> : <p className="text-xs text-zinc-500">Closed</p>}
          </div>;
        })}
        <p className="text-xs text-zinc-600">A closing time earlier than opening time means closing the next day.</p>
      </div> : null}
    </section>
  );
}
