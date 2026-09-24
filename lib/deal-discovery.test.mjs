import assert from "node:assert/strict";
import test from "node:test";
import { getDealAvailabilityLabel } from "./deals.js";
import { getDiscoverableDeals, partitionDiscoveryDeals } from "./deal-discovery.mjs";

const now = new Date("2026-09-24T12:00:00Z");
const live = { id: "live", is_active: true, starts_at: "2026-09-01T00:00:00Z", ends_at: "2026-09-30T23:00:00Z" };
const weekly = { ...live, id: "weekly", availability_mode: "weekly", availability_timezone: "Europe/Oslo",
  deal_schedules: [{ day_of_week: 5, start_time: "18:00:00", end_time: "22:00:00", spans_midnight: false }] };
const expired = { ...live, id: "expired", ends_at: "2026-09-23T00:00:00Z" };
const disabled = { ...live, id: "disabled", is_active: false };

test("saved deals are prioritized once while general discovery stays available", () => {
  const businesses = [
    { id: "saved", isFavorite: true, deals: [live, weekly, expired, disabled] },
    { id: "other", isFavorite: false, deals: [{ ...live, id: "other-live" }, live] },
  ];
  const result = partitionDiscoveryDeals(businesses, "user", now);
  assert.deepEqual(result.saved.map(({ deal }) => deal.id), ["live", "weekly"]);
  assert.deepEqual(result.general.map(({ deal }) => deal.id), ["other-live"]);
  assert.deepEqual(partitionDiscoveryDeals([...businesses].reverse(), "user", now).saved.map(({ deal }) => deal.id), ["live", "weekly"]);
  assert.equal(getDiscoverableDeals(businesses[0], now).length, 2);
  assert.notEqual(getDealAvailabilityLabel(weekly, now), "Available now");
});

test("guests and users without qualifying saved deals see only general discovery", () => {
  const businesses = [{ id: "saved", isFavorite: true, deals: [live] }, { id: "empty", isFavorite: true, deals: [expired] }];
  assert.equal(partitionDiscoveryDeals(businesses, null, now).saved.length, 0);
  assert.equal(partitionDiscoveryDeals(businesses, "user", now).saved.length, 1);
  assert.equal(partitionDiscoveryDeals([businesses[1]], "user", now).saved.length, 0);
  assert.equal(getDiscoverableDeals(businesses[1], now).length, 0);
  businesses[0].isFavorite = false;
  assert.equal(partitionDiscoveryDeals(businesses, "user", now).saved.length, 0);
});
