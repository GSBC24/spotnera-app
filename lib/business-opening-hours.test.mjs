import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { formatBusinessDayHours, getBusinessOpeningStatus } from "./business-opening-hours.mjs";

const day = (day_of_week, open_time, close_time) => ({ day_of_week, is_closed: false, open_time, close_time, spans_midnight: close_time < open_time });
const closed = (day_of_week) => ({ day_of_week, is_closed: true, open_time: null, close_time: null, spans_midnight: false });
const status = (rows, instant) => getBusinessOpeningStatus(rows, new Date(instant));

test("same-day opening, before, after, and later-today opening", () => {
  const rows = [day(4, "09:00", "12:00"), day(4, "17:00", "20:00")];
  assert.equal(status([day(4, "09:00", "20:00")], "2026-09-24T10:00:00Z").label, "Open now · Closes at 20:00");
  assert.equal(status([day(4, "09:00", "20:00")], "2026-09-24T06:00:00Z").label, "Closed · Opens today at 09:00");
  assert.equal(status([day(4, "09:00", "20:00"), day(5, "10:00", "18:00")], "2026-09-24T19:00:00Z").label, "Closed · Opens tomorrow at 10:00");
  assert.equal(status([day(4, "17:00", "20:00")], "2026-09-24T12:00:00Z").label, "Closed · Opens today at 17:00");
  assert.equal(getBusinessOpeningStatus(rows).state, "unavailable"); // duplicate days fail closed
});

test("closed days, several days away, and Sunday to Monday wrap", () => {
  const rows = [closed(4), day(1, "09:00", "17:00")];
  assert.equal(status(rows, "2026-09-24T10:00:00Z").label, "Closed · Opens Monday at 09:00");
  assert.equal(status(rows, "2026-09-27T18:00:00Z").label, "Closed · Opens tomorrow at 09:00");
  assert.equal(status([day(1, "09:00", "17:00")], "2026-09-28T16:00:00Z").label, "Closed · Opens Monday at 09:00");
  assert.equal(status([closed(7)], "2026-09-27T10:00:00Z").state, "closed");
});

test("overnight opening continues after midnight and then closes", () => {
  const rows = [day(5, "18:00", "02:00"), closed(6)];
  assert.equal(status(rows, "2026-09-25T17:00:00Z").label, "Open now · Closes tomorrow at 02:00");
  assert.equal(status(rows, "2026-09-25T23:00:00Z").label, "Open now · Closes at 02:00");
  assert.equal(status(rows, "2026-09-26T01:00:00Z").state, "closed");
  assert.equal(formatBusinessDayHours(rows[0]), "18:00–02:00 (+1 day)");
  assert.equal(formatBusinessDayHours(rows[1]), "Closed");
});

test("no hours and malformed windows never claim open or closed", () => {
  assert.equal(status([], "2026-09-24T10:00:00Z").label, "Hours unavailable");
  assert.equal(status([day(1, "bad", "17:00")], "2026-09-28T10:00:00Z").state, "unavailable");
  assert.equal(status([{ ...day(1, "09:00", "17:00"), spans_midnight: true }], "2026-09-28T10:00:00Z").state, "unavailable");
  assert.equal(status([day(1, "09:00", "17:00")], "2026-09-28T10:00:00Z").state, "open");
});

test("Europe/Oslo spring gap and repeated autumn hour use zoned wall time", () => {
  const spring = [day(7, "03:00", "05:00")];
  assert.equal(status(spring, "2026-03-29T00:30:00Z").state, "closed");
  assert.equal(status(spring, "2026-03-29T01:30:00Z").state, "open");
  const autumn = [day(7, "02:00", "03:00")];
  assert.equal(status(autumn, "2026-10-25T00:30:00Z").state, "open");
  assert.equal(status(autumn, "2026-10-25T01:30:00Z").state, "open");
  const repeatedClose = [day(7, "01:00", "02:30")];
  assert.equal(status(repeatedClose, "2026-10-25T00:45:00Z").state, "open");
  assert.equal(status(repeatedClose, "2026-10-25T01:31:00Z").state, "closed");
  const gap = [day(7, "02:30", "04:00")];
  assert.equal(status(gap, "2026-03-29T00:30:00Z").label, "Closed · Opens today at 03:00");
  assert.equal(status(gap, "2026-03-29T01:00:00Z").state, "open");
});

test("migration keeps opening hours separate and owner writes guarded", () => {
  const sql = readFileSync(new URL("../supabase/migrations/20260924010000_add_business_opening_hours.sql", import.meta.url), "utf8");
  assert.match(sql, /create table public\.business_opening_hours/);
  assert.match(sql, /unique \(business_id, day_of_week\)/);
  assert.match(sql, /alter table public\.business_opening_hours enable row level security/);
  assert.match(sql, /businesses\.is_active or businesses\.owner_id = auth\.uid\(\)/);
  assert.equal((sql.match(/businesses\.owner_id = auth\.uid\(\)/g) ?? []).length, 5);
  assert.doesNotMatch(sql, /revoke[^;]*service_role|force row level security/i);
  assert.doesNotMatch(sql, /deal_schedules|notifications|favorites/);
});
