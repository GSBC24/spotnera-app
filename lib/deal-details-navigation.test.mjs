import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getBusinessPath } from "./business-url.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("Deal Details View business keeps the canonical slug and closes on client navigation", () => {
  const dialog = read("../components/deal-details-dialog.js");
  const link = dialog.match(/<Link href=\{getBusinessPath\(business\)\}[\s\S]*?>\s*View business\s*<\/Link>/)?.[0];

  assert.equal(getBusinessPath({ id: "11111111-1111-4111-8111-111111111111", slug: "tatatata" }),
    "/business/tatatata");
  assert.ok(link, "View business must use the shared canonical business path");
  assert.match(link, /onNavigate=\{onClose\}/);
  assert.doesNotMatch(link, /preventDefault|stopPropagation/);
  assert.match(dialog, /event\.target === event\.currentTarget\) onClose\(\)/,
    "the backdrop must not close on a click inside the dialog");
});

test("Map, Deals, Saved, Search, and profile use the shared Deal Details dialog", () => {
  const dashboard = read("../components/spotnera-dashboard.js");
  const profile = read("../components/business-profile-deals.js");

  assert.match(dashboard, /<DealDetailsDialog business=\{selectedDeal\.business\}/);
  assert.match(profile, /<DealDetailsDialog business=\{business\}/);
});
