import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { checkPlatformAdminAccess } from "./platform-admin-access.mjs";
import { adminPerson, getAdminBusinessOwner, getAdminUserDetails, listAdminUsers } from "./admin-directory.mjs";

const page = readFileSync(new URL("../../app/admin/page.js", import.meta.url), "utf8");
const ownerProfileGrant = readFileSync(new URL("../../supabase/migrations/20261011000000_grant_admin_business_owner_profile_read.sql", import.meta.url), "utf8");

function adminFixture({ users, profiles = [], businesses = [], admins = [], errors = {} }) {
  const tables = { profiles, businesses, platform_admins: admins };
  return {
    auth: { admin: {
      listUsers: async () => ({ data: { users }, error: errors.listUsers ?? null }),
      getUserById: async (id) => ({ data: { user: users.find((user) => user.id === id) ?? null }, error: errors.getUserById ?? null }),
    } },
    from(table) {
      let rows = tables[table];
      return {
        select() { return this; },
        eq(column, value) { rows = rows.filter((row) => row[column] === value); return this; },
        in(column, values) { rows = rows.filter((row) => values.includes(row[column])); return this; },
        order(column) { rows = [...rows].sort((a, b) => String(a[column]).localeCompare(String(b[column]))); return this; },
        range(start, end) { rows = rows.slice(start, end + 1); return this; },
        maybeSingle: async () => ({ data: rows[0] ?? null, error: errors[table] ?? null }),
        then(resolve, reject) { return Promise.resolve({ data: rows, error: errors[table] ?? null }).then(resolve, reject); },
      };
    },
  };
}

test("authorized admin details use profile phone and auth email, separate from business public contact", async () => {
  const admin = adminFixture({
    users: [{ id: "owner", email: "owner@example.com", created_at: "2026-09-01", phone: "+47 111" }],
    profiles: [{ id: "owner", first_name: "Ada", last_name: "Lovelace", phone: "+47 222" }],
    businesses: [{ id: "business", owner_id: "owner", name: "Cafe" }],
  });
  const owner = await getAdminUserDetails(admin, "owner");
  assert.equal(owner.name, "Ada Lovelace");
  assert.equal(owner.email, "owner@example.com");
  assert.equal(owner.phone, "+47 222");
  assert.deepEqual(owner.businesses.map(({ name }) => name), ["Cafe"]);
  assert.match(page, /Business owner<\/h3>/);
  assert.match(page, /Business · public contact/);
  assert.match(page, /available\(detail\.data\.phone, "Phone not provided"\)/);
});

test("user list marks admin and business owner independently and counts every owned business", async () => {
  const businesses = Array.from({ length: 1001 }, (_, index) => ({
    id: String(index).padStart(4, "0"), owner_id: "owner", name: `Business ${index}`,
  }));
  const admin = adminFixture({
    users: [
      { id: "owner", email: "owner@example.com", created_at: "2026-09-01" },
      { id: "customer", email: "customer@example.com", created_at: "2026-09-02" },
    ],
    businesses,
    admins: [{ user_id: "owner" }],
  });
  const users = await listAdminUsers(admin);
  assert.equal(users[0].businesses.length, 1001);
  assert.equal((await getAdminUserDetails(admin, "owner")).businesses.length, 1001);
  assert.equal(users[0].isPlatformAdmin, true);
  assert.equal(users[1].businesses.length, 0);
  assert.equal(users[1].isPlatformAdmin, false);
  assert.equal((await listAdminUsers(admin, "customer@example.com"))[0].id, "customer");
  assert.match(page, /section === "users" \? rawQuery/);
  assert.match(page, /<UserKinds person=\{user\}/);
  assert.match(page, /<UserKinds person=\{detail\}/);
});

test("missing personal and business contact data have readable fallbacks", () => {
  const person = adminPerson({ id: "user" }, null);
  assert.equal(person.name, "Name unavailable");
  assert.equal(person.email, "Email unavailable");
  assert.equal(person.phone, "Phone not provided");
  assert.match(page, /available\(detail\.data\.address, "Address not provided"\)/);
  assert.match(page, /detail\.data\.owner_id \?\? "Unavailable"/);
});

test("personal contact reads stay behind platform admin guard and moderation actions remain", async () => {
  assert.equal(await checkPlatformAdminAccess({ id: "customer" }, async () => ({ data: null, error: null })), 403);
  assert.ok(page.indexOf("getPlatformAdmin()") < page.indexOf("<Businesses admin={access.admin}"));
  assert.match(page, /if \(access\.status !== 200\) notFound\(\)/);
  assert.match(page, /getAdminBusinessOwner\(admin, detail\.data\.owner_id\)/);
  assert.match(page, /getAdminUserDetails\(admin, selected\)/);
  assert.match(page, /BUSINESS_VERIFICATION_REMOVED/);
  assert.match(page, /BUSINESS_VERIFIED/);
  assert.match(page, /BUSINESS_RESTORED/);
  assert.match(page, /BUSINESS_SUSPENDED/);
});

test("business inspect resolves owner through owner ID without unrelated directory queries", async () => {
  const calls = [];
  const admin = {
    auth: { admin: { getUserById: async (id) => {
      calls.push(["auth", id]);
      return { data: { user: { id, email: "owner@example.com" } }, error: null };
    } } },
    from(table) {
      calls.push(["table", table]);
      assert.equal(table, "profiles");
      return {
        select(columns) { assert.equal(columns, "id, first_name, last_name, phone"); return this; },
        eq(column, id) { assert.deepEqual([column, id], ["id", "owner"]); return this; },
        async maybeSingle() { return { data: { id: "owner", first_name: "Ada", last_name: "Lovelace", phone: null }, error: null }; },
      };
    },
  };
  const owner = await getAdminBusinessOwner(admin, "owner");
  assert.deepEqual([owner.name, owner.email, owner.phone], ["Ada Lovelace", "owner@example.com", "Phone not provided"]);
  assert.deepEqual(calls, [["auth", "owner"], ["table", "profiles"]]);
  assert.match(page, /<Detail label="Verification"/);
  assert.match(page, /<Detail label="Operational"/);
});

test("business inspect handles a missing profile and logs permission failures safely", async () => {
  const admin = adminFixture({ users: [{ id: "owner", email: "owner@example.com", user_metadata: { full_name: "Ada Lovelace" } }] });
  const owner = await getAdminBusinessOwner(admin, "owner");
  assert.deepEqual([owner.name, owner.email, owner.phone], ["Ada Lovelace", "owner@example.com", "Phone not provided"]);
  const logs = [];
  const original = console.error;
  console.error = (...entry) => logs.push(entry);
  try {
    const denied = adminFixture({ users: [{ id: "owner" }], errors: { profiles: { code: "42501", status: 403, message: "private data" } } });
    await assert.rejects(getAdminBusinessOwner(denied, "owner"));
  } finally {
    console.error = original;
  }
  assert.deepEqual(logs, [["Admin directory request failed", {
    operation: "Profiles query", code: "42501", status: 403, message: "Upstream authorization denied",
  }]]);
  assert.match(page, /catch \{ ownerLookupFailed = true; \}/);
  assert.match(page, /Owner details could not be loaded\. Check server logs\./);
});

test("business owner profile read has only the service-role column grant after admin authorization", async () => {
  const guard = readFileSync(new URL("./platform-admin.js", import.meta.url), "utf8");
  const adminClient = readFileSync(new URL("../../utils/supabase/admin.js", import.meta.url), "utf8");
  assert.match(guard, /const admin = createAdminClient\(\)/);
  assert.match(guard, /if \(status !== 200\) return \{ status \}/);
  assert.match(page, /<Businesses admin=\{access\.admin\}/);
  assert.match(adminClient, /const serviceRoleKey = process\.env\.SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(ownerProfileGrant, /grant select \(id, first_name, last_name, phone\)\s+on public\.profiles to service_role/i);
  assert.doesNotMatch(ownerProfileGrant, /to\s+(?:anon|authenticated|public)\b/i);
  const missing = await getAdminBusinessOwner(adminFixture({ users: [{ id: "owner", email: "owner@example.com" }] }), "owner");
  assert.deepEqual([missing.name, missing.email, missing.phone], ["Name unavailable", "owner@example.com", "Phone not provided"]);
});

test("each failed admin directory operation logs only safe diagnostics and keeps the browser error generic", async () => {
  const secret = "service-role-secret owner@example.com";
  const failure = { code: "42703", status: 400, message: `Missing column for ${secret}` };
  const cases = [
    ["getUserById", "Auth Admin getUserById", false],
    ["listUsers", "Auth Admin listUsers", true],
    ["profiles", "Profiles query", false],
    ["businesses", "Businesses query", false],
    ["platform_admins", "Platform admins query", false],
  ];
  for (const [source, operation, list] of cases) {
    const logs = [];
    const original = console.error;
    console.error = (...entry) => logs.push(entry);
    try {
      const admin = adminFixture({ users: [{ id: "owner", email: "owner@example.com" }], errors: { [source]: failure } });
      await assert.rejects(list ? listAdminUsers(admin) : getAdminUserDetails(admin, "owner"));
    } finally {
      console.error = original;
    }
    assert.deepEqual(logs, [["Admin directory request failed", {
      operation, code: "42703", status: 400, message: "Database column unavailable",
    }]]);
    assert.doesNotMatch(JSON.stringify(logs), /service-role-secret|owner@example\.com/);
  }
  assert.match(page, /catch \{ return <ErrorNotice \/>; \}/);
  assert.match(page, /Admin data could not be loaded\. Please refresh and try again\./);
});

test("malicious codes and raw upstream messages never enter the diagnostic log", async () => {
  const logs = [];
  const original = console.error;
  console.error = (...entry) => logs.push(entry);
  try {
    const admin = adminFixture({ users: [], errors: {
      listUsers: { code: "token=secret", status: "401", message: "password=secret" },
    } });
    await assert.rejects(listAdminUsers(admin));
  } finally {
    console.error = original;
  }
  assert.deepEqual(logs, [["Admin directory request failed", {
    operation: "Auth Admin listUsers", code: null, status: null, message: "Auth Admin API request failed",
  }]]);
});
