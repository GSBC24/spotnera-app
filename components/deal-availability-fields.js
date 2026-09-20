"use client";

import { useMemo, useState } from "react";
import {
  DEAL_AVAILABILITY_MODE,
  DEAL_WEEKDAYS,
  DEFAULT_DEAL_AVAILABILITY_TIMEZONE,
} from "@/lib/deals";

function toTimeInputValue(value, fallback) {
  const match = String(value ?? "").match(/^(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : fallback;
}

export function DealAvailabilityFields({
  initialMode = DEAL_AVAILABILITY_MODE.CONTINUOUS,
  initialSchedules = [],
  initialTimezone = DEFAULT_DEAL_AVAILABILITY_TIMEZONE,
}) {
  const [mode, setMode] = useState(initialMode);
  const scheduleByDay = useMemo(
    () => new Map(initialSchedules.map((schedule) => [schedule.day_of_week, schedule])),
    [initialSchedules],
  );
  const [enabledDays, setEnabledDays] = useState(
    () => new Set(initialSchedules.map((schedule) => schedule.day_of_week)),
  );

  return (
    <fieldset className="grid gap-3 rounded-[24px] border border-white/12 bg-black/18 p-3 sm:p-4">
      <legend className="px-1 text-[11px] font-bold uppercase tracking-[0.18em] text-white/60">
        Availability
      </legend>

      <input
        type="hidden"
        name="availability_timezone"
        value={initialTimezone || DEFAULT_DEAL_AVAILABILITY_TIMEZONE}
      />

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl border border-white/12 bg-white/8 px-3 text-sm font-bold text-white">
          <input
            type="radio"
            name="availability_mode"
            value={DEAL_AVAILABILITY_MODE.CONTINUOUS}
            checked={mode === DEAL_AVAILABILITY_MODE.CONTINUOUS}
            onChange={() => setMode(DEAL_AVAILABILITY_MODE.CONTINUOUS)}
            className="h-4 w-4 accent-[#33d6a6]"
          />
          All the time
        </label>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl border border-white/12 bg-white/8 px-3 text-sm font-bold text-white">
          <input
            type="radio"
            name="availability_mode"
            value={DEAL_AVAILABILITY_MODE.WEEKLY}
            checked={mode === DEAL_AVAILABILITY_MODE.WEEKLY}
            onChange={() => setMode(DEAL_AVAILABILITY_MODE.WEEKLY)}
            className="h-4 w-4 accent-[#33d6a6]"
          />
          Selected days and hours
        </label>
      </div>

      {mode === DEAL_AVAILABILITY_MODE.WEEKLY ? (
        <div className="grid gap-2">
          {DEAL_WEEKDAYS.map((weekday) => {
            const schedule = scheduleByDay.get(weekday.value);
            const defaultStart = toTimeInputValue(schedule?.start_time, "09:00");
            const defaultEnd = toTimeInputValue(schedule?.end_time, "17:00");
            const isEnabled = enabledDays.has(weekday.value);

            return (
              <div
                key={weekday.value}
                className="grid gap-2 rounded-2xl border border-white/10 bg-white/7 p-3 sm:grid-cols-[minmax(110px,1fr)_minmax(100px,0.7fr)_minmax(100px,0.7fr)] sm:items-end"
              >
                <label className="flex min-h-10 cursor-pointer items-center gap-2 text-sm font-bold text-white">
                  <input
                    type="checkbox"
                    name={`schedule_${weekday.value}_enabled`}
                    checked={isEnabled}
                    onChange={(event) => {
                      setEnabledDays((currentDays) => {
                        const nextDays = new Set(currentDays);
                        if (event.target.checked) nextDays.add(weekday.value);
                        else nextDays.delete(weekday.value);
                        return nextDays;
                      });
                    }}
                    className="h-4 w-4 accent-[#33d6a6]"
                  />
                  {weekday.label}
                </label>
                {isEnabled ? (
                  <>
                    <label className="grid gap-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white/60">
                      From
                      <input
                        type="time"
                        name={`schedule_${weekday.value}_start`}
                        defaultValue={defaultStart}
                        required
                        className="spotnera-input h-10 w-full px-3 text-sm font-semibold"
                      />
                    </label>
                    <label className="grid gap-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white/60">
                      To
                      <input
                        type="time"
                        name={`schedule_${weekday.value}_end`}
                        defaultValue={defaultEnd}
                        required
                        className="spotnera-input h-10 w-full px-3 text-sm font-semibold"
                      />
                    </label>
                  </>
                ) : (
                  <p className="text-xs font-semibold text-white/42 sm:col-span-2 sm:self-center">
                    Not selected
                  </p>
                )}
              </div>
            );
          })}
          <p className="text-xs font-semibold leading-5 text-white/58">
            Times use {initialTimezone || DEFAULT_DEAL_AVAILABILITY_TIMEZONE}. An end time earlier than the start time continues into the next day.
          </p>
        </div>
      ) : (
        <p className="text-xs font-semibold leading-5 text-white/58">
          Available throughout the deal&apos;s overall start and end period.
        </p>
      )}
    </fieldset>
  );
}
