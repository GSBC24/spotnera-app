import { getCopyableBusinessAddress } from "./business-address.mjs";
import { getBusinessUrl } from "./business-url.js";
import { resolveWeeklyDealOccurrence } from "./deal-occurrences.mjs";
import { DEAL_AVAILABILITY_MODE, DEAL_STATUS, getDealStatus } from "./deals.js";

function localDateAt(instant, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(instant);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function addLocalDays(date, days) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function validInstant(value) {
  if (!value) return null;
  const instant = Date.parse(value);
  return Number.isFinite(instant) ? instant : NaN;
}

export function getDealCalendarWindow(deal, now = new Date()) {
  const nowMs = now.getTime();
  if (!Number.isFinite(nowMs) || !deal?.id ||
    [DEAL_STATUS.DISABLED, DEAL_STATUS.EXPIRED].includes(getDealStatus(deal, now))) return null;

  if (deal.availability_mode !== DEAL_AVAILABILITY_MODE.WEEKLY) {
    const start = validInstant(deal.starts_at);
    const end = validInstant(deal.ends_at);
    return Number.isFinite(start) && Number.isFinite(end) && start > nowMs && end > start
      ? { start: new Date(start).toISOString(), end: new Date(end).toISOString(), kind: "future" }
      : null;
  }

  const schedules = Array.isArray(deal.deal_schedules) ? deal.deal_schedules : [];
  if (!schedules.length) return null;
  const boundStart = validInstant(deal.starts_at);
  if (Number.isNaN(boundStart)) return null;
  const anchor = new Date(Math.max(nowMs, boundStart ?? nowMs));
  let anchorDate;
  try {
    anchorDate = localDateAt(anchor, deal.availability_timezone || "Europe/Oslo");
  } catch {
    return null;
  }

  const windows = [];
  // A previous local start may still be open after midnight. Eight forward
  // dates cover the next occurrence of every weekly weekday.
  for (let offset = -1; offset <= 8; offset += 1) {
    const localDate = addLocalDays(anchorDate, offset);
    for (const schedule of schedules) {
      const occurrence = resolveWeeklyDealOccurrence(deal, schedule, localDate);
      if (!occurrence?.startsAtUtc || !occurrence.endsAtUtc) continue;
      const start = Date.parse(occurrence.startsAtUtc);
      const end = Date.parse(occurrence.endsAtUtc);
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= nowMs || end <= start) continue;
      windows.push({
        start: new Date(Math.max(start, nowMs)).toISOString(),
        end: new Date(end).toISOString(),
        kind: start <= nowMs ? "remaining" : "future",
      });
    }
  }
  windows.sort((left, right) => Date.parse(left.start) - Date.parse(right.start) ||
    Date.parse(left.end) - Date.parse(right.end));
  return windows[0] ?? null;
}

function calendarContent(deal, business, window) {
  const location = getCopyableBusinessAddress(business);
  const description = [
    String(deal.description ?? "").trim(),
    `Business: ${business.name}`,
    `View on Spotnera: ${getBusinessUrl(business)}`,
  ].filter(Boolean).join("\n\n");
  return { title: `${deal.title} — ${business.name}`, description, location,
    start: window.start, end: window.end };
}

function utcStamp(value) {
  return new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export function getGoogleCalendarUrl(deal, business, window) {
  const event = calendarContent(deal, business, window);
  const url = new URL("https://calendar.google.com/calendar/render");
  url.searchParams.set("action", "TEMPLATE");
  url.searchParams.set("text", event.title);
  url.searchParams.set("dates", `${utcStamp(event.start)}/${utcStamp(event.end)}`);
  url.searchParams.set("details", event.description);
  if (event.location) url.searchParams.set("location", event.location);
  return url.toString();
}

function escapeIcsText(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/\r\n|\r|\n/g, "\\n")
    .replace(/;/g, "\\;").replace(/,/g, "\\,");
}

function foldIcsLine(line) {
  const result = [];
  const encoder = new TextEncoder();
  let segment = "";
  let bytes = 0;
  for (const character of line) {
    const size = encoder.encode(character).length;
    if (bytes + size > 75) {
      result.push(segment);
      segment = " ";
      bytes = 1;
    }
    segment += character;
    bytes += size;
  }
  result.push(segment);
  return result.join("\r\n");
}

export function buildDealIcs(deal, business, window, { uid, generatedAt = new Date() } = {}) {
  const event = calendarContent(deal, business, window);
  const eventUid = uid || `${globalThis.crypto.randomUUID()}@spotnera.com`;
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Spotnera//Deal Calendar//EN",
    "CALSCALE:GREGORIAN", "BEGIN:VEVENT",
    `UID:${eventUid}`, `DTSTAMP:${utcStamp(generatedAt)}`,
    `DTSTART:${utcStamp(event.start)}`, `DTEND:${utcStamp(event.end)}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
    `DESCRIPTION:${escapeIcsText(event.description)}`,
    ...(event.location ? [`LOCATION:${escapeIcsText(event.location)}`] : []),
    "END:VEVENT", "END:VCALENDAR",
  ];
  return `${lines.map(foldIcsLine).join("\r\n")}\r\n`;
}
