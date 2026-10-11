import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { adminDealDate } from "./admin-deal-date.mjs";
import { checkPlatformAdminAccess } from "./server/platform-admin-access.mjs";

const page = readFileSync(new URL("../app/admin/page.js", import.meta.url), "utf8");
const api = readFileSync(new URL("../app/api/admin/action/route.js", import.meta.url), "utf8");
const dealsSection = page.split("async function Deals({ admin, query }) {")[1]?.split("async function Reviews(")[0];

test("Admin Deals selects and displays start and end dates in the deal timezone", () => {
  assert.ok(dealsSection);
  assert.match(dealsSection, /select\("[^"]*starts_at, ends_at, availability_timezone[^"]*"\)/);
  assert.match(dealsSection, /<Detail label="Start date" value=\{adminDealDate\(deal\.starts_at, deal\.availability_timezone\)\}/);
  assert.match(dealsSection, /<Detail label="End date" value=\{adminDealDate\(deal\.ends_at, deal\.availability_timezone\)\}/);
  const start = adminDealDate("2026-10-11T13:30:00Z", "Europe/Oslo");
  const end = adminDealDate("2026-10-12T14:45:00Z", "Europe/Oslo");
  assert.match(start, /11 Oct 2026/);
  assert.match(start, /15:30/);
  assert.match(end, /12 Oct 2026/);
  assert.match(end, /16:45/);
});

test("Admin Deals uses an honest fallback for missing or invalid dates", () => {
  for (const value of [null, "", "invalid"]) {
    assert.equal(adminDealDate(value, "Europe/Oslo"), "Not specified");
  }
  assert.match(adminDealDate("2026-10-11T13:30:00Z", "Invalid/Zone"), /15:30/);
});

test("business profile link is labeled accurately and deal moderation controls remain", () => {
  assert.match(dealsSection, /href=\{getBusinessPath\(\{ id: deal\.business_id, slug: deal\.businesses\.slug \}\)\}>View business profile<\/Link>/);
  assert.match(dealsSection, /if \(query\) list = list\.ilike\("title", `%\$\{query\}%`\)/);
  assert.match(dealsSection, /DEAL_RESTORED/);
  assert.match(dealsSection, /DEAL_DISABLED/);
  assert.match(dealsSection, /targetId=\{deal\.id\}/);
  assert.match(api, /access\.supabase\.rpc\("perform_admin_action"/);
});

test("Admin Deals remains behind the server-side platform administrator check", async () => {
  assert.ok(page.indexOf("getPlatformAdmin()") < page.indexOf("<Deals admin={access.admin}"));
  assert.match(page, /if \(access\.status !== 200\) notFound\(\)/);
  assert.equal(await checkPlatformAdminAccess({ id: "ordinary" }, async () => ({ data: null, error: null })), 403);
});
