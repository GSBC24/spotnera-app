// The resolved interval is shared deal timing data. Notification scheduling and
// any future user-initiated export should consume the same UTC boundaries.
const formatterCache = new Map();

function formatterFor(timeZone) {
  if (!formatterCache.has(timeZone)) {
    formatterCache.set(timeZone, new Intl.DateTimeFormat("en-GB", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }));
  }
  return formatterCache.get(timeZone);
}

function localParts(instant, formatter) {
  const parts = Object.fromEntries(
    formatter.formatToParts(instant).map(({ type, value }) => [type, value]),
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

function parseLocalDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? "");
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (year < 100 || date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month ||
      date.getUTCDate() !== day) return null;
  return { year, month, day, weekday: date.getUTCDay() || 7 };
}

function parseLocalTime(value) {
  const match = /^(\d{2}):(\d{2})(?::00(?:\.0+)?)?$/.exec(value ?? "");
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour < 24 && minute < 60 ? { hour, minute } : null;
}

function addLocalDay(date) {
  const next = new Date(Date.UTC(date.year, date.month - 1, date.day + 1));
  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
  };
}

function wallTime(date, time) {
  return `${String(date.year).padStart(4, "0")}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}T${String(time.hour).padStart(2, "0")}:${String(time.minute).padStart(2, "0")}`;
}

function matchingInstants(date, time, formatter) {
  const naiveUtc = Date.UTC(date.year, date.month - 1, date.day, time.hour, time.minute);
  const offsets = new Set();
  // Probe around the target date to include offsets on both sides of a DST
  // transition. Validate each candidate against the requested local minute.
  for (const hours of [-36, -24, -12, 0, 12, 24, 36]) {
    const probe = naiveUtc + hours * 3_600_000;
    const local = localParts(probe, formatter);
    const asUtc = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute);
    offsets.add(asUtc - probe);
  }
  return [...offsets]
    .map((offset) => naiveUtc - offset)
    .filter((instant) => {
      const local = localParts(instant, formatter);
      return local.year === date.year && local.month === date.month &&
        local.day === date.day && local.hour === time.hour && local.minute === time.minute;
    })
    .sort((a, b) => a - b);
}

function hasBackwardClockTransition(start, end, formatter) {
  let previous = null;
  for (let instant = start; instant <= end + 15 * 60_000; instant += 15 * 60_000) {
    const sample = Math.min(instant, end);
    const local = localParts(sample, formatter);
    const offset = Date.UTC(local.year, local.month - 1, local.day,
      local.hour, local.minute) - sample;
    if (previous !== null && offset < previous) return true;
    previous = offset;
    if (sample === end) break;
  }
  return false;
}

function parseBound(value) {
  if (!value) return null;
  const instant = Date.parse(value);
  return Number.isFinite(instant) ? instant : NaN;
}

/**
 * Resolve one weekly schedule on its local start date. Returns null for an
 * invalid schedule or an interval outside the deal. A nonexistent endpoint
 * returns a result with null UTC bounds and explicit endpoint status.
 * On a repeated DST hour, use the first start and last end so the entire
 * advertised local window is covered. No host-machine timezone is used.
 */
export function resolveWeeklyDealOccurrence(deal, schedule, localStartDate) {
  const date = parseLocalDate(localStartDate);
  const startTime = parseLocalTime(schedule?.start_time);
  const endTime = parseLocalTime(schedule?.end_time);
  const timeZone = deal?.availability_timezone || "Europe/Oslo";
  if (!date || !startTime || !endTime ||
      Number(schedule?.day_of_week) !== date.weekday) return null;

  const startMinutes = startTime.hour * 60 + startTime.minute;
  const endMinutes = endTime.hour * 60 + endTime.minute;
  const overnight = schedule.spans_midnight === true;
  if (overnight ? endMinutes >= startMinutes : endMinutes <= startMinutes) return null;

  let formatter;
  try {
    formatter = formatterFor(timeZone);
    formatter.format(new Date()); // Force validation of the IANA timezone.
  } catch {
    return null;
  }

  const endDate = overnight ? addLocalDay(date) : date;
  const starts = matchingInstants(date, startTime, formatter);
  const ends = matchingInstants(endDate, endTime, formatter);
  const startStatus = starts.length === 0 ? "nonexistent" :
    starts.length > 1 ? "ambiguous" : "valid";
  const endStatus = ends.length === 0 ? "nonexistent" :
    ends.length > 1 ? "ambiguous" : "valid";

  const startBound = parseBound(deal?.starts_at);
  const endBound = parseBound(deal?.ends_at);
  if (Number.isNaN(startBound) || Number.isNaN(endBound)) return null;
  const start = starts.length ? Math.max(starts[0], startBound ?? -Infinity) : null;
  const end = ends.length ? Math.min(ends.at(-1), endBound ?? Infinity) : null;
  if (start !== null && end !== null && end <= start) return null;
  const hasFold = start !== null && end !== null &&
    hasBackwardClockTransition(start, end, formatter);

  return {
    dealId: deal?.id ?? null,
    scheduleId: schedule?.id ?? null,
    localStartDate,
    timeZone,
    scheduledLocalStart: wallTime(date, startTime),
    scheduledLocalEnd: wallTime(endDate, endTime),
    startsAtUtc: start === null ? null : new Date(start).toISOString(),
    endsAtUtc: end === null ? null : new Date(end).toISOString(),
    startStatus,
    endStatus,
    hasFold,
    hasMultipleTransitions: hasFold,
  };
}
