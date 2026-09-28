import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { normalizeNotificationPreferenceState, parseTimedPreference,
  resolveNotificationPreferenceState } from "./notification-preferences.mjs";

function savedForm({ newDeals = true, starting = null, ending = null,
  newDealEmail = false, weeklyEmail = false } = {}) {
  const form = new FormData();
  if (newDeals) form.set("saved_business_new_deals", "on");
  if (starting !== null) {
    form.set("saved_business_deal_starting_soon", "on");
    form.set("starting_soon_minutes", String(starting));
  }
  if (ending !== null) {
    form.set("saved_business_deal_ending_soon", "on");
    form.set("ending_soon_minutes", String(ending));
  }
  if (newDealEmail) form.set("new_deal_email", "on");
  if (weeklyEmail) form.set("weekly_deals_email", "on");
  return normalizeNotificationPreferenceState({
    saved_business_new_deals: form.has("saved_business_new_deals"),
    ...parseTimedPreference(form, "starting", null),
    ...parseTimedPreference(form, "ending", null),
    new_deal_email: form.has("new_deal_email"),
    weekly_deals_email: form.has("weekly_deals_email"),
  });
}

test("saved timed leads remain exact for both allowed combinations", () => {
  for (const [starting, ending] of [[60, 30], [120, 60]]) {
    const state = savedForm({ starting, ending });
    assert.equal(state.saved_business_deal_starting_soon, true);
    assert.equal(state.starting_soon_minutes, starting);
    assert.equal(state.saved_business_deal_ending_soon, true);
    assert.equal(state.ending_soon_minutes, ending);
  }
});

test("turning Starting soon off stays off, then a new saved lead stays on", () => {
  const off = savedForm({ starting: null });
  assert.equal(off.saved_business_deal_starting_soon, false);
  assert.equal(off.starting_soon_minutes, null);

  const on = savedForm({ starting: 30 });
  assert.equal(on.saved_business_deal_starting_soon, true);
  assert.equal(on.starting_soon_minutes, 30);
});

test("New Deal Push and both email toggles retain their saved boolean values", () => {
  const on = savedForm({ newDeals: true, newDealEmail: true, weeklyEmail: true });
  const off = savedForm({ newDeals: false, newDealEmail: false, weeklyEmail: false });
  for (const name of ["saved_business_new_deals", "new_deal_email", "weekly_deals_email"]) {
    assert.equal(on[name], true);
    assert.equal(off[name], false);
  }
});

test("null or legacy invalid leads cannot visually enable timed alerts", () => {
  assert.deepEqual(normalizeNotificationPreferenceState({
    saved_business_deal_starting_soon: true,
    starting_soon_minutes: null,
    saved_business_deal_ending_soon: true,
    ending_soon_minutes: 120,
  }), {
    saved_business_new_deals: false,
    saved_business_deal_starting_soon: false,
    starting_soon_minutes: null,
    saved_business_deal_ending_soon: false,
    ending_soon_minutes: null,
    weekly_deals_email: false,
    new_deal_email: false,
  });
});

test("success displays saved values; error retains the submitted draft", () => {
  const initial = savedForm({ newDeals: false });
  const saved = savedForm({ starting: 120, ending: 60,
    newDealEmail: true, weeklyEmail: true });
  const success = { success: true, preferences: saved };
  assert.deepEqual(resolveNotificationPreferenceState(success,
    { values: initial, baseActionState: null }), saved);

  const draft = { values: saved, baseActionState: success };
  assert.deepEqual(resolveNotificationPreferenceState(success, draft), saved);
  assert.deepEqual(resolveNotificationPreferenceState({ error: "Save failed" }, draft), saved);
});

test("UI applies persisted action values only on success and keeps controls owned by state", () => {
  const component = readFileSync(new URL("../components/notification-preferences.js", import.meta.url), "utf8");
  const page = readFileSync(new URL("../app/me/page.js", import.meta.url), "utf8");
  assert.match(component, /resolveNotificationPreferenceState\(state, draft\)/);
  assert.match(component, /setDraft\(\{ values: \{ \.\.\.preferences, \[name\]: value \}, baseActionState: state \}\)/);
  assert.match(component, /setDraft\(\{ values: preferences, baseActionState: state \}\)/);
  assert.match(component, /checked=\{preferences\[preference\.name\]\}/);
  assert.match(component, /checked=\{enabled\}/);
  assert.match(component, /checked=\{minutes === value\}/);
  assert.doesNotMatch(component, /defaultChecked=/);
  assert.match(page, /if \(error\) \{\s*return \{ error:/);
  assert.match(page, /return \{ success: true, savedAt: new Date\(\)\.toISOString\(\),\s*preferences: savedPreferences \}/);
});
