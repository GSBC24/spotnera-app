import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { compensateFailedOpeningHoursCreate } from "./business-opening-hours-compensation.mjs";

const request = { businessId: "new-business", userId: "owner", uploadedPaths: ["owner/new-business/logo.png"] };

function fakeClient({ deletion = { data: [{ id: request.businessId }], error: null }, storageError = null, throwOnDelete = false, throwOnStorage = false } = {}) {
  const calls = [];
  const query = {
    delete() { calls.push(["delete"]); return this; },
    eq(field, value) { calls.push(["eq", field, value]); return this; },
    select(columns) {
      calls.push(["select", columns]);
      if (throwOnDelete) throw new Error("Delete request failed");
      return Promise.resolve(deletion);
    },
  };
  return {
    calls,
    client: {
      from(table) { calls.push(["from", table]); return query; },
      storage: { from(bucket) {
        calls.push(["storage", bucket]);
        return { remove(paths) {
          calls.push(["remove", paths]);
          if (throwOnStorage) throw new Error("Storage request failed");
          return Promise.resolve({ error: storageError });
        } };
      } },
    },
  };
}

test("confirmed exact-row deletion precedes cleanup of only this create's images", async () => {
  const { client, calls } = fakeClient();
  assert.deepEqual(await compensateFailedOpeningHoursCreate(client, request), { outcome: "deleted" });
  assert.deepEqual(calls, [
    ["from", "businesses"], ["delete"], ["eq", "id", request.businessId],
    ["eq", "owner_id", request.userId], ["select", "id"],
    ["storage", "business-assets"], ["remove", request.uploadedPaths],
  ]);
});

test("storage failure after confirmed deletion leaves the business deleted", async () => {
  for (const options of [{ storageError: new Error("Storage failed") }, { throwOnStorage: true }]) {
    const { client, calls } = fakeClient(options);
    const result = await compensateFailedOpeningHoursCreate(client, request);
    assert.equal(result.outcome, "deleted_images_remain");
    assert.equal(calls.filter(([name]) => name === "delete").length, 1);
    assert.equal(calls.filter(([name]) => name === "remove").length, 1);
  }
});

test("failed or ambiguous deletion keeps images and never confirms rollback", async () => {
  for (const options of [
    { deletion: { data: null, error: new Error("Delete failed") } },
    { deletion: { data: [], error: null } },
    { deletion: { data: [{ id: "different-business" }], error: null } },
    { deletion: null },
    { throwOnDelete: true },
  ]) {
    const { client, calls } = fakeClient(options);
    const result = await compensateFailedOpeningHoursCreate(client, request);
    assert.equal(result.outcome, "deletion_unconfirmed");
    assert.equal(calls.some(([name]) => name === "remove"), false);
  }
});

test("successful creation, optional hours, and active-request submission lock remain gated", () => {
  const owner = readFileSync(new URL("../app/owner/page.js", import.meta.url), "utf8");
  const analyticsForm = readFileSync(new URL("../components/owner-analytics.js", import.meta.url), "utf8");
  assert.match(owner, /if \(openingHours\.rows\.length\) \{[\s\S]*?if \(hoursError\) \{[\s\S]*?compensateFailedOpeningHoursCreate/);
  assert.match(owner, /redirect\("\/owner\?section=businesses&businessCreated=1"\)/);
  assert.match(owner, /preventDuplicateSubmissions=\{!business\}/);
  assert.match(analyticsForm, /if \(preventDuplicateSubmissions && submissionLockRef\.current\) \{\s*event\.preventDefault\(\)/);
});
