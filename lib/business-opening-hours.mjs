export const BUSINESS_TIME_ZONE = "Europe/Oslo";
export const BUSINESS_WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d(?::00)?$/;

function minutes(value) {
  if (!TIME.test(String(value ?? ""))) return null;
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function timeLabel(value) {
  return String(value).slice(0, 5);
}

const DAY_MS = 86_400_000;

function makeZonedParts(timeZone) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  });
  return (instant) => {
    const parts = Object.fromEntries(formatter.formatToParts(instant).map((part) => [part.type, part.value]));
    const date = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
    const minute = Number(parts.hour) * 60 + Number(parts.minute);
    return { date, minute, wall: date + minute * 60_000 };
  };
}

function resolveBoundary(date, minute, zoned, latest = false) {
  const target = date + minute * 60_000;
  const offsets = new Set();
  for (let sample = target - 36 * 3_600_000; sample <= target + 36 * 3_600_000; sample += 6 * 3_600_000) {
    offsets.add(zoned(new Date(sample)).wall - sample);
  }
  const candidates = [...offsets].map((offset) => target - offset);
  const matches = candidates.filter((instant) => zoned(new Date(instant)).wall === target);
  if (matches.length) return latest ? Math.max(...matches) : Math.min(...matches);

  // A spring-forward gap has no matching instant. Move to its first real minute.
  const before = candidates.filter((instant) => zoned(new Date(instant)).wall < target);
  const after = candidates.filter((instant) => zoned(new Date(instant)).wall > target);
  if (!before.length || !after.length) return null;
  let low = Math.max(...before);
  let high = Math.min(...after);
  if (low >= high) return null;
  while (high - low > 60_000) {
    const middle = Math.floor((low + high) / 120_000) * 60_000;
    if (zoned(new Date(middle)).wall >= target) high = middle;
    else low = middle;
  }
  return high;
}

export function validateOpeningHours(rows) {
  if (!Array.isArray(rows)) return false;
  const seen = new Set();
  for (const row of rows) {
    const day = Number(row.day_of_week);
    if (!Number.isInteger(day) || day < 1 || day > 7 || seen.has(day)) return false;
    seen.add(day);
    if (row.is_closed === true) {
      if (row.open_time != null || row.close_time != null || row.spans_midnight === true) return false;
      continue;
    }
    const open = minutes(row.open_time);
    const close = minutes(row.close_time);
    if (open === null || close === null || open === close || Boolean(row.spans_midnight) !== (close < open)) return false;
  }
  return true;
}

export function getBusinessOpeningStatus(rows, now = new Date(), timeZone = BUSINESS_TIME_ZONE) {
  if (!rows?.length || !validateOpeningHours(rows)) return { state: "unavailable", label: "Hours unavailable" };
  let zoned;
  let current;
  try {
    zoned = makeZonedParts(timeZone);
    current = zoned(now);
  } catch {
    return { state: "unavailable", label: "Hours unavailable" };
  }
  const byDay = new Map(rows.map((row) => [Number(row.day_of_week), row]));
  const closing = [];
  const upcoming = [];
  for (let offset = -1; offset <= 7; offset += 1) {
    const date = current.date + offset * DAY_MS;
    const weekday = (new Date(date).getUTCDay() + 6) % 7 + 1;
    const row = byDay.get(weekday);
    if (!row || row.is_closed) continue;
    const start = resolveBoundary(date, minutes(row.open_time), zoned);
    const end = resolveBoundary(date + (row.spans_midnight ? DAY_MS : 0), minutes(row.close_time), zoned, true);
    if (start === null || end === null || end <= start) continue;
    if (now.getTime() >= start && now.getTime() < end) closing.push(end);
    else if (start > now.getTime()) upcoming.push(start);
  }
  if (closing.length) {
    const end = zoned(new Date(Math.max(...closing)));
    const clock = `${String(Math.floor(end.minute / 60)).padStart(2, "0")}:${String(end.minute % 60).padStart(2, "0")}`;
    return { state: "open", label: `Open now · Closes ${end.date > current.date ? "tomorrow " : ""}at ${clock}` };
  }
  if (upcoming.length) {
    const opening = zoned(new Date(Math.min(...upcoming)));
    const offset = Math.round((opening.date - current.date) / DAY_MS);
    const weekday = (new Date(opening.date).getUTCDay() + 6) % 7;
    const when = offset === 0 ? "today" : offset === 1 ? "tomorrow" : BUSINESS_WEEKDAYS[weekday];
    const clock = `${String(Math.floor(opening.minute / 60)).padStart(2, "0")}:${String(opening.minute % 60).padStart(2, "0")}`;
    return { state: "closed", label: `Closed · Opens ${when} at ${clock}` };
  }
  return { state: "closed", label: "Closed · No upcoming opening hours" };
}

export function formatBusinessDayHours(row) {
  if (!row || row.is_closed) return "Closed";
  if (!validateOpeningHours([row])) return "Hours unavailable";
  return `${timeLabel(row.open_time)}–${timeLabel(row.close_time)}${row.spans_midnight ? " (+1 day)" : ""}`;
}
