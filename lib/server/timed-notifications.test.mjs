import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseTimedPreference, timedPreference } from "../notification-preferences.mjs";
import { isTimedDeliveryDue, resolveTimedOccurrences, sameTimestampInstant, timedDeliveryTiming,
  TIMED_START, TIMED_END } from "./timed-notifications.mjs";

const base = { id: "deal", business_id: "business", is_active: true, status: "active",
  availability_mode: "weekly", availability_timezone: "Europe/Oslo" };
const monday = { id: "schedule", day_of_week: 1, start_time: "17:00:00",
  end_time: "19:00:00", spans_midnight: false };

function events(deal, schedules, now = "2026-09-21T10:00:00Z") {
  return resolveTimedOccurrences(deal, schedules, new Date(now));
}

test("timed boundary comparison uses instants and rejects missing or invalid values", () => {
  const iso = "2026-09-23T10:00:00.000Z";
  assert.equal(sameTimestampInstant(iso, iso), true);
  assert.equal(sameTimestampInstant(iso, "2026-09-23T12:00:00+02:00"), true);
  assert.equal(sameTimestampInstant(iso, "2026-09-23T10:00:00Z"), true);
  assert.equal(sameTimestampInstant(iso, "2026-09-23T10:00:01Z"), false);
  assert.equal(sameTimestampInstant("2026-09-23T10:00:00.000001Z",
    "2026-09-23T10:00:00.000002Z"), false);
  assert.equal(sameTimestampInstant("2026-09-23T10:00:00.000001Z",
    "2026-09-23T12:00:00.000001+02:00"), true);
  assert.equal(sameTimestampInstant(null, null), true);
  assert.equal(sameTimestampInstant(null, iso), false);
  assert.equal(sameTimestampInstant(iso, null), false);
  assert.equal(sameTimestampInstant("invalid", "invalid"), false);
  assert.equal(sameTimestampInstant(iso, "invalid"), false);
  assert.equal(sameTimestampInstant(iso, "2026-09-23T10:00:00"), false);
  assert.equal(sameTimestampInstant("2026-02-30T10:00:00Z",
    "2026-02-30T10:00:00Z"), false);
});

test("timed worker uses instant comparison for occurrence and delivery boundaries", () => {
  const worker = readFileSync(new URL(
    "../../app/api/internal/notifications/process/route.js", import.meta.url,
  ), "utf8");
  assert.match(worker, /sameTimestampInstant\(current\.occurrence_start_at, event\.occurrence_start_at\)/);
  assert.match(worker, /sameTimestampInstant\(current\.occurrence_end_at, event\.occurrence_end_at\)/);
  assert.match(worker, /sameTimestampInstant\(timing\.intendedDueAt, persisted\.intended_due_at\)/);
  assert.match(worker, /sameTimestampInstant\(timing\.deadlineAt, persisted\.deadline_at\)/);
  assert.doesNotMatch(worker, /(?:occurrence_start_at|occurrence_end_at|intendedDueAt|deadlineAt)\s*!==\s*(?:event|persisted)\./);
});

test("legacy Starting Soon true without minutes is not consent; form validates allowed values", () => {
  assert.equal(timedPreference({ saved_business_deal_starting_soon: true,
    starting_soon_minutes: null }, "starting"), null);
  assert.equal(timedPreference({ saved_business_deal_starting_soon: false,
    starting_soon_minutes: 60 }, "starting"), null);
  const form = new FormData();
  form.set("saved_business_deal_starting_soon", "on");
  form.set("starting_soon_minutes", "60");
  assert.deepEqual(parseTimedPreference(form, "starting", null), {
    saved_business_deal_starting_soon: true, starting_soon_minutes: 60,
  });
  form.set("starting_soon_minutes", "90");
  assert.equal(parseTimedPreference(form, "starting", null), null);
  form.set("ending_soon_minutes", "120");
  form.set("saved_business_deal_ending_soon", "on");
  assert.equal(parseTimedPreference(form, "ending", null), null);
  for (const invalid of ["6e1", "060", "60.0", "+60", " 60 ", "30minutes",
    "NaN", "Infinity", "-60", "15", "45", "90", "999"]) {
    form.set("starting_soon_minutes", invalid);
    assert.equal(parseTimedPreference(form, "starting", null), null, invalid);
    form.delete("saved_business_deal_starting_soon");
    assert.equal(parseTimedPreference(form, "starting", 60), null, `off: ${invalid}`);
    form.set("saved_business_deal_starting_soon", "on");
  }
  form.set("starting_soon_minutes", "120");
  assert.equal(parseTimedPreference(form, "starting", null).starting_soon_minutes, 120);
  form.set("starting_soon_minutes", "30");
  assert.equal(parseTimedPreference(form, "starting", null).starting_soon_minutes, 30);
  form.set("ending_soon_minutes", "60");
  assert.equal(parseTimedPreference(form, "ending", null).ending_soon_minutes, 60);
});

test("one occurrence has one boundary event, with different delivery due times", () => {
  const [start, end] = events(base, [monday]);
  assert.equal(start.event_type, TIMED_START);
  assert.equal(end.event_type, TIMED_END);
  assert.equal(start.occurrence_key, "2026-09-21");
  const a = timedDeliveryTiming(start, { saved_business_deal_starting_soon: true,
    starting_soon_minutes: 120 });
  const b = timedDeliveryTiming(start, { saved_business_deal_starting_soon: true,
    starting_soon_minutes: 60 });
  const c = timedDeliveryTiming(start, { saved_business_deal_starting_soon: true,
    starting_soon_minutes: 30 });
  assert.equal(a.intendedDueAt, "2026-09-21T13:00:00.000Z");
  assert.equal(b.intendedDueAt, "2026-09-21T14:00:00.000Z");
  assert.equal(c.intendedDueAt, "2026-09-21T14:30:00.000Z");
  assert.equal(b.deadlineAt, "2026-09-21T14:10:00.000Z");
  assert.equal(isTimedDeliveryDue(b, new Date("2026-09-21T14:04:00Z"), start), true);
  assert.equal(isTimedDeliveryDue(b, new Date("2026-09-21T14:10:00Z"), start), false);
  assert.equal(timedDeliveryTiming(end, { saved_business_deal_ending_soon: true,
    ending_soon_minutes: 30 }).intendedDueAt, "2026-09-21T16:30:00.000Z");
});

test("continuous null boundaries, short ending windows, and edits", () => {
  assert.equal(events({ ...base, timed_edit_token_hash: "active-edit" }, [monday]).length, 0);
  const continuous = { ...base, availability_mode: "continuous", starts_at: null,
    ends_at: "2026-09-21T17:00:00Z" };
  const onlyEnd = events(continuous, []);
  assert.equal(onlyEnd.length, 1);
  assert.equal(onlyEnd[0].event_type, TIMED_END);
  assert.equal(onlyEnd[0].occurrence_local_date, "2026-09-21");
  const endingTiming = timedDeliveryTiming(onlyEnd[0], {
    saved_business_deal_ending_soon: true, ending_soon_minutes: 30,
  });
  assert.equal(isTimedDeliveryDue(endingTiming,
    new Date("2026-09-21T16:34:00Z"), onlyEnd[0]), true);
  assert.equal(events({ ...continuous, ends_at: null }, []).length, 0);
  const short = events({ ...continuous, starts_at: "2026-09-21T16:45:00Z" }, [])[1];
  assert.equal(timedDeliveryTiming(short, { saved_business_deal_ending_soon: true,
    ending_soon_minutes: 30 }), null);
  const first = events(base, [monday])[0];
  const edited = events(base, [{ ...monday, start_time: "18:00:00" }])[0];
  assert.equal(first.occurrence_key, edited.occurrence_key);
  assert.notEqual(first.source_fingerprint, edited.source_fingerprint);
});

test("weekly overnight, clipping, and multiple same-day windows", () => {
  const saturday = { id: "overnight", day_of_week: 6, start_time: "23:00:00",
    end_time: "02:00:00", spans_midnight: true };
  const overnight = events({ ...base, starts_at: "2026-09-19T21:30:00Z",
    ends_at: "2026-09-20T00:30:00Z" }, [saturday], "2026-09-19T18:00:00Z");
  assert.equal(overnight[0].occurrence_start_at, "2026-09-19T21:30:00.000Z");
  assert.equal(overnight[1].occurrence_end_at, "2026-09-20T00:00:00.000Z");
  assert.equal(events(base, [monday, { ...monday, id: "second",
    start_time: "20:00:00", end_time: "21:00:00" }]).length, 0);
});

test("DST gaps, repeated boundaries, and a fold inside the interval suppress timed alerts", () => {
  const sunday = { id: "sunday", day_of_week: 7, start_time: "02:30:00",
    end_time: "03:30:00", spans_midnight: false };
  assert.equal(events(base, [sunday], "2026-03-28T12:00:00Z").length, 0);
  assert.equal(events(base, [{ ...sunday, start_time: "01:30:00" }],
    "2026-10-24T12:00:00Z").length, 0);
  assert.equal(events(base, [{ ...sunday, start_time: "01:30:00",
    end_time: "03:30:00" }], "2026-10-24T12:00:00Z").length, 0);
});

test("edit snapshots preserve logical weekly keys and expose generation changes", () => {
  const original = events({ ...base, timed_edit_generation: 1 }, [monday])[0];
  const timezone = events({ ...base, availability_timezone: "UTC",
    timed_edit_generation: 2 }, [monday])[0];
  const hours = events({ ...base, timed_edit_generation: 2 },
    [{ ...monday, start_time: "18:00:00" }])[0];
  const replacedRow = events({ ...base, timed_edit_generation: 1 },
    [{ ...monday, id: "replacement" }])[0];
  assert.equal(original.occurrence_key, timezone.occurrence_key);
  assert.equal(original.occurrence_key, hours.occurrence_key);
  assert.equal(original.source_fingerprint, replacedRow.source_fingerprint);
  assert.notEqual(original.source_fingerprint, timezone.source_fingerprint);
  assert.notEqual(original.source_fingerprint, hours.source_fingerprint);
  assert.equal(timezone.timed_edit_generation, 2);
  const nextWeek = events({ ...base, timed_edit_generation: 2 }, [monday],
    "2026-09-28T10:00:00Z")[0];
  assert.equal(nextWeek.occurrence_key, "2026-09-28");
  assert.notEqual(nextWeek.occurrence_key, original.occurrence_key);
});

test("continuous and availability-mode edits retain a conservative boundary path", () => {
  const continuous = { ...base, availability_mode: "continuous",
    starts_at: "2026-09-21T15:00:00Z", ends_at: "2026-09-21T17:00:00Z",
    timed_edit_generation: 3 };
  const before = events(continuous, []);
  const shifted = events({ ...continuous, starts_at: "2026-09-22T15:00:00Z",
    ends_at: "2026-09-22T17:00:00Z", timed_edit_generation: 4 }, [],
  "2026-09-21T10:00:00Z");
  assert.equal(before[0].occurrence_key, "continuous");
  assert.equal(shifted[0].occurrence_key, "continuous");
  assert.notEqual(before[0].occurrence_local_date, shifted[0].occurrence_local_date);
  assert.notEqual(before[0].source_fingerprint, shifted[0].source_fingerprint);
  const weekly = events({ ...base, timed_edit_generation: 4 }, [monday]);
  assert.notEqual(before[0].occurrence_key, weekly[0].occurrence_key);
  assert.equal(weekly[0].timed_edit_generation, 4);
});
