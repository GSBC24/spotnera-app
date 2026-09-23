import { createHash } from "node:crypto";
import { resolveWeeklyDealOccurrence } from "../deal-occurrences.mjs";
import { timedPreference } from "../notification-preferences.mjs";

export const TIMED_START = "saved_business_deal_starting_soon";
export const TIMED_END = "saved_business_deal_ending_soon";
export const TIMED_GRACE_MS = 10 * 60_000;
export const TIMED_HORIZON_MS = 48 * 60 * 60_000;

function timestampNanoseconds(value) {
  if (typeof value !== "string") return null;
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) return null;
  const [year, month, day, hour, minute, second] = match[1].match(/\d+/g).map(Number);
  const wall = new Date(0);
  wall.setUTCFullYear(year, month - 1, day);
  wall.setUTCHours(hour, minute, second, 0);
  if (wall.getUTCFullYear() !== year || wall.getUTCMonth() + 1 !== month ||
      wall.getUTCDate() !== day || wall.getUTCHours() !== hour ||
      wall.getUTCMinutes() !== minute || wall.getUTCSeconds() !== second) return null;
  const secondsMs = Date.parse(`${match[1]}${match[3]}`);
  if (!Number.isFinite(secondsMs)) return null;
  return BigInt(secondsMs) * 1_000_000n +
    BigInt((match[2] ?? "").padEnd(9, "0") || "0");
}

export function sameTimestampInstant(expected, stored) {
  if (expected == null || stored == null) return expected == null && stored == null;
  const expectedNs = timestampNanoseconds(expected);
  const storedNs = timestampNanoseconds(stored);
  return expectedNs !== null && storedNs !== null && expectedNs === storedNs;
}

function fingerprint(source) {
  return createHash("sha256").update(JSON.stringify(source)).digest("hex");
}

function localDateAt(instant, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(instant);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function addDays(date, days) {
  const next = new Date(`${date}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

export function resolveTimedOccurrences(deal, schedules = [], now = new Date(), horizonMs = TIMED_HORIZON_MS) {
  if (!deal?.is_active || deal.timed_edit_token_hash != null ||
      deal.status === "paused" || deal.status === "ended") return [];
  const timeZone = deal.availability_timezone || "Europe/Oslo";
  const nowMs = now.getTime();
  const endMs = nowMs + horizonMs;
  const intervals = [];

  if (deal.availability_mode === "weekly") {
    let today;
    try { today = localDateAt(now, timeZone); } catch { return []; }
    for (let offset = -1; offset <= Math.ceil(horizonMs / 86_400_000) + 1; offset += 1) {
      const date = addDays(today, offset);
      const resolved = schedules.map((schedule) =>
        resolveWeeklyDealOccurrence(deal, schedule, date),
      ).filter((item) => item && item.startsAtUtc && item.endsAtUtc);
      // V1 has one logical weekly occurrence per deal and local date.
      if (resolved.length !== 1) continue;
      const item = resolved[0];
      if (Date.parse(item.endsAtUtc) <= nowMs ||
          Date.parse(item.startsAtUtc) > endMs) continue;
      intervals.push({ key: date, localDate: date, timeZone,
        start: item.startsAtUtc, end: item.endsAtUtc,
        safeStart: item.startStatus === "valid" && !item.hasFold,
        safeEnd: item.endStatus === "valid" && !item.hasFold,
        source: [deal.availability_mode, timeZone, deal.starts_at, deal.ends_at,
          ...schedules.map((schedule) => [schedule.day_of_week,
            schedule.start_time, schedule.end_time, schedule.spans_midnight])],
      });
    }
  } else if (deal.availability_mode === "continuous") {
    const start = deal.starts_at && Date.parse(deal.starts_at);
    const end = deal.ends_at && Date.parse(deal.ends_at);
    if ((start && !Number.isFinite(start)) || (end && !Number.isFinite(end))) return [];
    if (start && end && start >= end) return [];
    if (!start && !end) return [];
    let localDate;
    try { localDate = localDateAt(new Date(start || end), timeZone); }
    catch { return []; }
    intervals.push({ key: "continuous", localDate, timeZone,
      start: start ? new Date(start).toISOString() : null,
      end: end ? new Date(end).toISOString() : null,
      safeStart: true, safeEnd: true,
      source: [deal.availability_mode, deal.starts_at, deal.ends_at],
    });
  }

  const events = [];
  for (const interval of intervals) {
    for (const [eventType, boundary, safe] of [
      [TIMED_START, interval.start, interval.safeStart],
      [TIMED_END, interval.end, interval.safeEnd],
    ]) {
      if (!boundary || !safe) continue;
      const boundaryMs = Date.parse(boundary);
      if (boundaryMs <= nowMs || boundaryMs > endMs) continue;
      events.push({ event_type: eventType, deal_id: deal.id,
        business_id: deal.business_id, occurrence_key: interval.key,
        timed_edit_generation: deal.timed_edit_generation ?? 0,
        occurrence_local_date: interval.localDate,
        occurrence_timezone: interval.timeZone,
        occurrence_start_at: interval.start,
        occurrence_end_at: interval.end,
        source_fingerprint: fingerprint([interval.source, interval.start, interval.end]),
      });
    }
  }
  return events;
}

export function timedDeliveryTiming(event, preferences) {
  const kind = event.event_type === TIMED_START ? "starting" :
    event.event_type === TIMED_END ? "ending" : null;
  if (!kind) return null;
  const lead = timedPreference(preferences, kind);
  const boundary = Date.parse(kind === "starting" ?
    event.occurrence_start_at : event.occurrence_end_at);
  const start = Date.parse(event.occurrence_start_at);
  if (!lead || !Number.isFinite(boundary)) return null;
  const due = boundary - lead * 60_000;
  if (kind === "ending" && Number.isFinite(start) && due < start) return null;
  return { leadMinutes: lead, intendedDueAt: new Date(due).toISOString(),
    deadlineAt: new Date(Math.min(due + TIMED_GRACE_MS, boundary)).toISOString() };
}

export function isTimedDeliveryDue(timing, now, event) {
  const instant = now.getTime();
  if (!timing || instant < Date.parse(timing.intendedDueAt) ||
      instant >= Date.parse(timing.deadlineAt)) return false;
  const start = event.occurrence_start_at && Date.parse(event.occurrence_start_at);
  const end = event.occurrence_end_at && Date.parse(event.occurrence_end_at);
  return event.event_type === TIMED_START ? Boolean(start && instant < start) :
    Boolean(end && instant < end && (!start || instant >= start));
}
