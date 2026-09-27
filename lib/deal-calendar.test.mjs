import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildDealIcs, getDealCalendarWindow, getGoogleCalendarUrl } from "./deal-calendar.mjs";

const business = {
  id: "public-business", slug: "corner-cafe", name: "Corner Cafe",
  address: "Storgata 1", city: "Oslo", country: "Norway", is_active: true,
  owner_id: "private-owner", email: "private-owner@example.org",
};
const base = { id: "public-deal", title: "Lunch deal", description: "Save on lunch", is_active: true };
const monday = { id: "schedule-1", day_of_week: 1, start_time: "09:00:00",
  end_time: "11:00:00", spans_midnight: false };

test("future continuous deal uses its actual bounded window; open-ended and expired deals have no action", () => {
  const now = new Date("2026-09-21T07:00:00Z");
  const future = { ...base, availability_mode: "continuous",
    starts_at: "2026-09-22T08:00:00Z", ends_at: "2026-09-22T10:00:00Z" };
  assert.deepEqual(getDealCalendarWindow(future, now), {
    start: "2026-09-22T08:00:00.000Z", end: "2026-09-22T10:00:00.000Z", kind: "future",
  });
  assert.equal(getDealCalendarWindow({ ...future, starts_at: null }, now), null);
  assert.equal(getDealCalendarWindow({ ...future, ends_at: null }, now), null);
  assert.equal(getDealCalendarWindow({ ...future, starts_at: "2026-09-20T08:00:00Z" }, now), null);
  assert.equal(getDealCalendarWindow({ ...future, ends_at: "2026-09-20T10:00:00Z" }, now), null);
  assert.equal(getDealCalendarWindow({ ...future, is_active: false }, now), null);
});

test("closed weekly deal chooses the next Oslo occurrence and clips to deal bounds", () => {
  const weekly = { ...base, availability_mode: "weekly", availability_timezone: "Europe/Oslo",
    deal_schedules: [monday] };
  assert.deepEqual(getDealCalendarWindow(weekly, new Date("2026-09-22T12:00:00Z")), {
    start: "2026-09-28T07:00:00.000Z", end: "2026-09-28T09:00:00.000Z", kind: "future",
  });
  const bounded = { ...weekly, starts_at: "2026-09-28T07:30:00Z", ends_at: "2026-09-28T08:30:00Z" };
  assert.deepEqual(getDealCalendarWindow(bounded, new Date("2026-09-22T12:00:00Z")), {
    start: "2026-09-28T07:30:00.000Z", end: "2026-09-28T08:30:00.000Z", kind: "future",
  });
});

test("open weekly deal uses the remaining window, including overnight after local midnight", () => {
  const weekly = { ...base, availability_mode: "weekly", availability_timezone: "Europe/Oslo",
    deal_schedules: [{ day_of_week: 6, start_time: "23:00:00", end_time: "02:00:00", spans_midnight: true }] };
  assert.deepEqual(getDealCalendarWindow(weekly, new Date("2026-09-19T18:00:00Z")), {
    start: "2026-09-19T21:00:00.000Z", end: "2026-09-20T00:00:00.000Z", kind: "future",
  });
  assert.deepEqual(getDealCalendarWindow(weekly, new Date("2026-09-19T22:30:00Z")), {
    start: "2026-09-19T22:30:00.000Z", end: "2026-09-20T00:00:00.000Z", kind: "remaining",
  });
});

test("Oslo spring gap skips invalid window; autumn fold retains resolver UTC boundaries", () => {
  const weekly = { ...base, availability_mode: "weekly", availability_timezone: "Europe/Oslo",
    deal_schedules: [{ day_of_week: 7, start_time: "02:30:00", end_time: "03:30:00", spans_midnight: false }] };
  assert.deepEqual(getDealCalendarWindow(weekly, new Date("2026-03-28T12:00:00Z")), {
    start: "2026-04-05T00:30:00.000Z", end: "2026-04-05T01:30:00.000Z", kind: "future",
  });
  const fold = { ...weekly, deal_schedules: [{ day_of_week: 7, start_time: "01:30:00",
    end_time: "02:30:00", spans_midnight: false }] };
  assert.deepEqual(getDealCalendarWindow(fold, new Date("2026-10-24T12:00:00Z")), {
    start: "2026-10-24T23:30:00.000Z", end: "2026-10-25T01:30:00.000Z", kind: "future",
  });
});

test("Google draft encodes dates, public title, canonical URL, and real address only", () => {
  const deal = { ...base, title: "Soup & salad", description: "Line 1\nLine 2" };
  const window = { start: "2026-09-22T08:00:00.000Z", end: "2026-09-22T10:00:00.000Z" };
  const url = new URL(getGoogleCalendarUrl(deal, business, window));
  assert.equal(url.origin, "https://calendar.google.com");
  assert.equal(url.searchParams.get("action"), "TEMPLATE");
  assert.equal(url.searchParams.get("text"), "Soup & salad — Corner Cafe");
  assert.equal(url.searchParams.get("dates"), "20260922T080000Z/20260922T100000Z");
  assert.equal(url.searchParams.get("location"), "Storgata 1, Oslo, Norway");
  assert.match(url.searchParams.get("details"), /https:\/\/app\.spotnera\.com\/business\/corner-cafe/);
  assert.doesNotMatch(url.toString(), /private-owner|user_id|tracking/i);
  assert.equal(new URL(getGoogleCalendarUrl(deal, { ...business, address: "" }, window))
    .searchParams.has("location"), false);
});

test("ICS has UTC boundaries, required fields, escaped text, folded lines, and no private data", () => {
  const deal = { ...base, title: "Soup, salad; tea\\cake", description: "First line\nSecond; line, with \\ slash and a long description ".repeat(3) };
  const window = { start: "2026-09-22T08:00:00.000Z", end: "2026-09-22T10:00:00.000Z" };
  const ics = buildDealIcs(deal, business, window, { uid: "random-public-uid@spotnera.com", generatedAt: new Date("2026-09-21T12:00:00Z") });
  const unfolded = ics.replace(/\r\n /g, "");
  for (const field of ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:", "BEGIN:VEVENT",
    "UID:random-public-uid@spotnera.com", "DTSTAMP:20260921T120000Z",
    "DTSTART:20260922T080000Z", "DTEND:20260922T100000Z", "SUMMARY:",
    "DESCRIPTION:", "LOCATION:Storgata 1\\, Oslo\\, Norway", "END:VEVENT", "END:VCALENDAR"]) {
    assert.ok(unfolded.includes(field), field);
  }
  assert.match(unfolded, /Soup\\, salad\\; tea\\\\cake/);
  assert.match(unfolded, /First line\\nSecond\\; line\\, with \\\\ slash/);
  assert.doesNotMatch(ics, /private-owner|user_id|tracking/i);
  assert.ok(ics.endsWith("\r\n"));
  for (const line of ics.split("\r\n")) assert.ok(new TextEncoder().encode(line).length <= 75);
});

test("shared Deal Details uses one calendar action; Map Upcoming carries public address", () => {
  const dialog = readFileSync(new URL("../components/deal-details-dialog.js", import.meta.url), "utf8");
  const dashboard = readFileSync(new URL("../components/spotnera-dashboard.js", import.meta.url), "utf8");
  const actions = readFileSync(new URL("../components/deal-calendar-actions.js", import.meta.url), "utf8");
  assert.match(dialog, /<DealCalendarActions business=\{business\} deal=\{deal\}/);
  assert.match(dashboard, /address: business\.address, city: business\.city, country: business\.country/);
  assert.match(actions, /<summary[^>]*>Add to Calendar<\/summary>/);
  assert.match(actions, /Google Calendar/);
  assert.match(actions, /Other calendar \(\.ics\)/);
  assert.doesNotMatch(actions, /recordBusinessEvent|trackEvent|oauth|calendar\.events/i);
});
