import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { activationTime, buildNewDealEmail, buildWeeklyEmail, escapeEmailHtml,
  isEmailDiscoverable, osloWeeklyWindow, processCustomerEmail,
  processCustomerEmailBatch, selectWeeklyDeals, sendResendEmail,
  MAX_SUMMARY_DEALS } from "./customer-email.mjs";

const migration = readFileSync(new URL("../../supabase/migrations/20260928010000_phase5_customer_email_outbox.sql",
  import.meta.url), "utf8");
const worker = readFileSync(new URL("../../app/api/internal/notifications/process/route.js",
  import.meta.url), "utf8");
const now = new Date("2026-09-28T07:05:00Z");
const business = { id: "business-1", slug: "example-cafe", name: "Example <Cafe>", is_active: true };
const deal = { id: "deal-1", business_id: "business-1", title: "Coffee & cake", description: "Save <20%>",
  status: "active", is_active: true, starts_at: null, ends_at: null, availability_mode: "continuous" };
const delivery = { delivery_id: "delivery-1", event_id: "event-1", user_id: "user-1",
  kind: "new_deal", claim_token: "claim-1", attempts: 1 };

function mockAdmin({ preference = true, saved = true, perBusiness = true,
  activeBusiness = true, activeDeal = true, expired = false, weekly = false,
  email = "customer@example.org", confirmed = true, providerAccepts = true } = {}) {
  const updates = [];
  const tables = {
    notification_events: { event_type: "saved_business_new_deal", created_at: now.toISOString(), deal_id: deal.id,
      business_id: business.id },
    deals: { ...deal, is_active: activeDeal,
      ends_at: expired ? "2026-09-27T00:00:00Z" : null,
      availability_mode: weekly ? "weekly" : "continuous" },
    businesses: { ...business, is_active: activeBusiness },
    favorites: saved ? { id: "favorite-1", deal_notifications_enabled: perBusiness } : null,
    notification_preferences: { new_deal_email: preference, weekly_deals_email: preference },
    deal_schedules: weekly ? [{ day_of_week: 3, start_time: "10:00:00",
      end_time: "15:00:00", spans_midnight: false }] : [],
  };
  const client = {
    auth: { admin: { getUserById: async () => ({ data: { user: { email,
      email_confirmed_at: confirmed ? now.toISOString() : null } }, error: null }) } },
    from(table) {
      const query = { select() { return query; }, eq() { return query; },
        in() { return query; }, order() { return query; }, limit() { return query; },
        maybeSingle() { return Promise.resolve({ data: tables[table], error: null }); },
        update(values) { updates.push(values); return query; },
        then(resolve) { resolve({ data: table === "notification_email_deliveries"
          ? [{ id: delivery.delivery_id }] : tables[table], error: null }); },
      };
      return query;
    },
  };
  let sends = 0;
  const fetchImpl = async () => {
    sends += 1;
    return providerAccepts ? Response.json({ id: "resend-1" }) :
      Response.json({ error: "provider-secret" }, { status: 503 });
  };
  return { client, updates, fetchImpl, get sends() { return sends; } };
}

test("New Deal email honors opt-in, saved business, per-business toggle, deal and business eligibility", async () => {
  for (const [options, expected] of [
    [{}, "sent"], [{ preference: false }, "skipped"], [{ saved: false }, "skipped"],
    [{ perBusiness: false }, "skipped"], [{ activeBusiness: false }, "skipped"],
    [{ activeDeal: false }, "skipped"], [{ expired: true }, "skipped"],
    [{ weekly: true }, "sent"], [{ email: "" }, "skipped"],
    [{ confirmed: false }, "skipped"],
  ]) {
    const mock = mockAdmin(options);
    const result = await processCustomerEmail(mock.client, delivery, "test-key", now,
      mock.fetchImpl);
    assert.equal(result, expected, JSON.stringify(options));
    assert.equal(mock.sends, expected === "sent" ? 1 : 0);
  }
});

test("public discoverability uses current live period but allows closed weekly windows", () => {
  assert.equal(isEmailDiscoverable({ ...deal, availability_mode: "weekly",
    deal_schedules: [{ day_of_week: 3 }] }, business, now), true);
  assert.equal(isEmailDiscoverable({ ...deal, starts_at: "2026-10-01T00:00:00Z" }, business, now), false);
  assert.equal(isEmailDiscoverable({ ...deal, ends_at: "2026-09-27T00:00:00Z" }, business, now), false);
  assert.equal(isEmailDiscoverable({ ...deal, availability_mode: "weekly", deal_schedules: [] },
    business, now), false);
  assert.equal(isEmailDiscoverable({ ...deal, status: "paused" }, business, now), false);
});

test("email content has canonical links, plain text, safe HTML and no customer profile data", () => {
  const message = buildNewDealEmail({ business, deal, to: "customer@example.org" }, now);
  assert.match(message.subject, /^New deal from Example <Cafe>: Coffee & cake$/);
  assert.match(message.text, /https:\/\/app\.spotnera\.com\/business\/example-cafe/);
  assert.match(message.text, /https:\/\/app\.spotnera\.com\/me/);
  assert.match(message.html, /Example &lt;Cafe&gt;/);
  assert.match(message.html, /Save &lt;20%&gt;/);
  assert.doesNotMatch(message.html, /customer@example\.org|Spotnera®/);
  assert.equal(escapeEmailHtml(`'"<&`), "&#39;&quot;&lt;&amp;");
});

test("branded New Deal HTML has the public logo, deal card, CTA and useful text", () => {
  const message = buildNewDealEmail({ business, deal, to: "customer@example.org" }, now);
  assert.match(message.html, /<html lang="en">/);
  assert.match(message.html, /src="https:\/\/app\.spotnera\.com\/icons\/spotnera-icon-192\.png"/);
  assert.match(message.html, /width="48" height="48" alt="Spotnera"/);
  assert.match(message.html, /Spotnera<span[^>]*>™<\/span>/);
  assert.match(message.html, /background-color:#080b0a/);
  assert.match(message.html, /background-color:#1b2420/);
  assert.match(message.html, /background-color:#33d6a6/);
  assert.match(message.html, /New deal from Example &lt;Cafe&gt;/);
  assert.match(message.html, /Coffee &amp; cake/);
  assert.match(message.html, /Save &lt;20%&gt;/);
  assert.match(message.html, /href="https:\/\/app\.spotnera\.com\/business\/example-cafe"[^>]*>View deal/);
  assert.match(message.html, /href="https:\/\/app\.spotnera\.com\/me"[^>]*>Manage notifications/);
  assert.match(message.html, /href="https:\/\/app\.spotnera\.com\/help#contact-support"/);
  assert.match(message.html, /© 2026 Spotnera/);
  assert.match(message.text, /New deal from Example <Cafe>/);
  assert.match(message.text, /View deal: https:\/\/app\.spotnera\.com\/business\/example-cafe/);
  assert.match(message.text, /Contact support:/);
  assert.doesNotMatch(message.html, /®|&reg;|&#174;|customer@example\.org/i);
  assert.equal((message.html.match(/<img\b/g) ?? []).length, 1);
  assert.doesNotMatch(message.html, /<script|<link\b|class=|data:image|localhost/i);
});

test("Weekly Summary cards escape names, retain ten-deal limit and work without business logos", () => {
  const items = Array.from({ length: 12 }, (_, index) => ({
    business: { ...business, logo_url: "https://private.example/logo.png" },
    deal: { ...deal, id: `deal-${index}`, title: `Tea & <cake> ${index}` },
  }));
  const message = buildWeeklyEmail({ items, to: "customer@example.org" }, now);
  assert.match(message.html, /Your weekly deals/);
  assert.match(message.html, /Fresh deals from businesses you saved/);
  assert.match(message.html, /Example &lt;Cafe&gt;/);
  assert.match(message.html, /Tea &amp; &lt;cake&gt;/);
  assert.equal((message.html.match(/>View deal<\/a>/g) ?? []).length, MAX_SUMMARY_DEALS);
  assert.match(message.html, /Explore more deals/);
  assert.match(message.text, /Your weekly deals/);
  assert.match(message.text, /Tea & <cake>/);
  assert.match(message.text, /Manage notifications:/);
  assert.equal((message.html.match(/<img\b/g) ?? []).length, 1);
  assert.doesNotMatch(message.html, /private\.example|®|&reg;|&#174;/i);
});

test("weekly summary omits ineligible deals, limits size and sorts deterministically", () => {
  const items = Array.from({ length: 15 }, (_, index) => ({ business,
    deal: { ...deal, id: `deal-${String(index).padStart(2, "0")}`,
      title: `Deal ${index}`, ends_at: `2026-10-${String(index + 1).padStart(2, "0")}T00:00:00Z` } }));
  items.push({ business, deal: { ...deal, id: "expired", ends_at: "2026-09-27T00:00:00Z" } });
  const sorted = selectWeeklyDeals(items.reverse(), now);
  assert.equal(sorted.length, 15);
  assert.equal(sorted[0].deal.id, "deal-00");
  const email = buildWeeklyEmail({ items, to: "customer@example.org" }, now);
  assert.equal((email.html.match(/View deal/g) ?? []).length, MAX_SUMMARY_DEALS);
  assert.match(email.text, /Explore more deals/);
  assert.match(email.text, /Manage notifications: https:\/\/app\.spotnera\.com\/me/);
  assert.equal(buildWeeklyEmail({ items: [], to: "customer@example.org" }, now), null);
});

test("weekly processing includes multiple saved businesses and rechecks the global preference", async () => {
  const secondBusiness = { ...business, id: "business-2", slug: "second-cafe", name: "Second cafe" };
  const secondDeal = { ...deal, id: "deal-2", business_id: secondBusiness.id, title: "Lunch" };
  for (const enabled of [true, false]) {
    const tables = { notification_preferences: { weekly_deals_email: enabled },
      favorites: [{ business_id: business.id }, { business_id: secondBusiness.id }],
      businesses: [business, secondBusiness], deals: [deal, secondDeal] };
    const calls = [];
    const admin = { auth: { admin: { getUserById: async () => ({
      data: { user: { email: "customer@example.org",
        email_confirmed_at: now.toISOString() } }, error: null }) } },
      from(table) {
        const query = { select() { return query; }, eq(key, value) {
          calls.push([table, key, value]); return query; },
        in() { return query; }, order() { return query; }, limit() { return query; },
        maybeSingle() { return Promise.resolve({ data: tables[table], error: null }); },
        update(value) { calls.push([table, "update", value]); return query; },
        then(resolve) { resolve({ data: table === "notification_email_deliveries"
          ? [{ id: "delivery-2" }] : tables[table], error: null }); } };
        return query;
      } };
    let sent;
    const fetchImpl = async (_url, options) => {
      sent = JSON.parse(options.body);
      return Response.json({ id: "resend-2" });
    };
    const result = await processCustomerEmail(admin, { ...delivery,
      kind: "weekly_summary", delivery_id: "delivery-2", event_id: null,
      week_start: "2026-09-28" }, "test-key", now, fetchImpl);
    assert.equal(result, enabled ? "sent" : "skipped");
    if (enabled) {
      assert.match(sent.text, /example-cafe/);
      assert.match(sent.text, /second-cafe/);
      assert.ok(calls.some(([table, key, value]) => table === "favorites" &&
        key === "deal_notifications_enabled" && value === true));
    } else assert.equal(sent, undefined);
  }
});

test("provider uses stable idempotency key; failures avoid unsafe automatic resend", async () => {
  let headers;
  const accepted = await sendResendEmail({ from: "x", to: ["y"], text: "z" },
    "delivery-1", "test-key", async (_url, options) => {
      headers = options.headers;
      return Response.json({ id: "accepted" });
    });
  assert.deepEqual(accepted, { kind: "sent", id: "accepted" });
  assert.equal(headers["Idempotency-Key"], "spotnera-email-delivery-1");
  assert.deepEqual(await sendResendEmail({}, "delivery-1", "test-key",
    async () => Response.json({ error: "secret" }, { status: 503 })), { kind: "uncertain" });
  assert.deepEqual(await sendResendEmail({}, "delivery-1", "test-key",
    async () => Response.json({ error: "rate limit" }, { status: 429 })), { kind: "retry" });
  assert.deepEqual(await sendResendEmail({}, "delivery-1", "test-key",
    async () => { throw new Error("provider secret"); }), { kind: "uncertain" });
  const mock = mockAdmin({ providerAccepts: false });
  assert.equal(await processCustomerEmail(mock.client, delivery, "test-key", now,
    mock.fetchImpl), "uncertain");
  assert.equal(mock.updates.at(-1).status, "uncertain");
});

test("Norway Monday morning follows DST and activation must be explicit UTC", () => {
  assert.equal(osloWeeklyWindow(new Date("2026-01-05T07:00:00Z")), null);
  assert.equal(osloWeeklyWindow(new Date("2026-01-05T08:00:00Z")), "2026-01-05");
  assert.equal(osloWeeklyWindow(new Date("2026-06-01T06:00:00Z")), null);
  assert.equal(osloWeeklyWindow(new Date("2026-06-01T07:00:00Z")), "2026-06-01");
  assert.equal(osloWeeklyWindow(new Date("2026-06-02T07:00:00Z")), null);
  assert.equal(activationTime("2026-09-28T07:00:00Z"), "2026-09-28T07:00:00.000Z");
  assert.equal(activationTime(""), null);
});

test("batch stays disabled without key/start timestamp, and weekly enqueue is period keyed", async () => {
  let rpcCalls = 0;
  const admin = { rpc: async () => { rpcCalls += 1; return { data: [], error: null }; } };
  assert.deepEqual(await processCustomerEmailBatch(admin, { apiKey: "", startAt: "", now }),
    { disabled: true });
  assert.equal(rpcCalls, 0);
  await processCustomerEmailBatch(admin, { apiKey: "test-key",
    startAt: "2026-09-28T07:00:00Z", now });
  assert.equal(rpcCalls, 3);
});

test("repeated worker batches do not resend a claimed and finalized New Deal email", async () => {
  const mock = mockAdmin();
  let claimed = false;
  const admin = { ...mock.client, rpc: async (name) => {
    if (name === "claim_customer_email_deliveries") {
      if (claimed) return { data: [], error: null };
      claimed = true;
      return { data: [delivery], error: null };
    }
    return { data: 0, error: null };
  } };
  const options = { apiKey: "test-key", startAt: "2026-09-28T07:00:00Z",
    now, fetchImpl: mock.fetchImpl };
  assert.equal((await processCustomerEmailBatch(admin, options)).sent, 1);
  assert.equal((await processCustomerEmailBatch(admin, options)).processed, 0);
  assert.equal(mock.sends, 1);
});

test("migration isolates email RLS and deduplicates per event and weekly period", () => {
  assert.match(migration, /unique index notification_email_new_deal_once_idx[\s\S]*?\(event_id, user_id\)/);
  assert.match(migration, /unique index notification_email_weekly_once_idx[\s\S]*?\(user_id, week_start\)/);
  assert.match(migration, /alter table public\.notification_email_deliveries enable row level security/);
  assert.match(migration, /revoke all on public\.notification_email_deliveries from public, anon, authenticated/);
  assert.match(migration, /p\.new_deal_email = true/);
  assert.match(migration, /p\.weekly_deals_email = true/);
  assert.equal((migration.match(/f\.deal_notifications_enabled = true/g) ?? []).length, 2);
  assert.match(migration, /join public\.businesses b on b\.id = f\.business_id and b\.is_active = true/);
  assert.match(migration, /d\.is_active = true and d\.status not in \('paused', 'ended'\)/);
  assert.match(migration, /p_week_start <> \(now\(\) at time zone 'Europe\/Oslo'\)::date/);
  assert.match(migration, /for update skip locked/);
  assert.match(migration, /status = 'uncertain'/);
  assert.match(worker, /ENABLE_EMAIL_NOTIFICATIONS === "true"/);
  assert.match(worker, /EMAIL_NOTIFICATIONS_START_AT/);
  assert.match(worker, /Email errors must never roll back or hide successful push processing/);
});
