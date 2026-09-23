import assert from "node:assert/strict";
import test from "node:test";
import { resolveWeeklyDealOccurrence } from "./deal-occurrences.mjs";

const deal = { id: "deal-1", availability_timezone: "Europe/Oslo" };

test("resolves an ordinary and an overnight Oslo occurrence", () => {
  assert.deepEqual(resolveWeeklyDealOccurrence(deal, {
    id: "schedule-1", day_of_week: 1, start_time: "09:00:00",
    end_time: "10:30:00", spans_midnight: false,
  }, "2026-09-21"), {
    dealId: "deal-1", scheduleId: "schedule-1", localStartDate: "2026-09-21",
    timeZone: "Europe/Oslo",
    scheduledLocalStart: "2026-09-21T09:00",
    scheduledLocalEnd: "2026-09-21T10:30",
    startsAtUtc: "2026-09-21T07:00:00.000Z",
    endsAtUtc: "2026-09-21T08:30:00.000Z",
    startStatus: "valid", endStatus: "valid",
    hasFold: false, hasMultipleTransitions: false,
  });

  const overnight = resolveWeeklyDealOccurrence(deal, {
    day_of_week: 6, start_time: "23:00:00", end_time: "02:00:00",
    spans_midnight: true,
  }, "2026-09-19");
  assert.equal(overnight.startsAtUtc, "2026-09-19T21:00:00.000Z");
  assert.equal(overnight.endsAtUtc, "2026-09-20T00:00:00.000Z");
});

test("handles Oslo spring gap and autumn repeated hour deterministically", () => {
  const sunday = { day_of_week: 7, start_time: "02:30:00",
    end_time: "03:30:00", spans_midnight: false };
  const missing = resolveWeeklyDealOccurrence(deal, sunday, "2026-03-29");
  assert.equal(missing.startStatus, "nonexistent");
  assert.equal(missing.startsAtUtc, null);

  const repeated = resolveWeeklyDealOccurrence(deal, {
    ...sunday, start_time: "01:30:00", end_time: "02:30:00",
  }, "2026-10-25");
  assert.equal(repeated.startsAtUtc, "2026-10-24T23:30:00.000Z");
  assert.equal(repeated.endsAtUtc, "2026-10-25T01:30:00.000Z");
  assert.equal(repeated.endStatus, "ambiguous");
  assert.equal(repeated.hasFold, true);
});

test("clips occurrences to deal bounds and rejects invalid windows", () => {
  const schedule = { day_of_week: 1, start_time: "09:00:00",
    end_time: "11:00:00", spans_midnight: false };
  const clipped = resolveWeeklyDealOccurrence({
    ...deal, starts_at: "2026-09-21T07:30:00Z", ends_at: "2026-09-21T08:30:00Z",
  }, schedule, "2026-09-21");
  assert.equal(clipped.startsAtUtc, "2026-09-21T07:30:00.000Z");
  assert.equal(clipped.endsAtUtc, "2026-09-21T08:30:00.000Z");
  assert.equal(resolveWeeklyDealOccurrence(deal, schedule, "2026-09-22"), null);
  assert.equal(resolveWeeklyDealOccurrence({ ...deal, availability_timezone: "Invalid/Zone" },
    schedule, "2026-09-21"), null);
});
