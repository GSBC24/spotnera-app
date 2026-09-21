import { Buffer } from "node:buffer";
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getVapidDetails, sendWebPush } from "@/lib/server/web-push";
import { createAdminClient } from "@/utils/supabase/admin";

export const runtime = "nodejs";

const BATCH_SIZE = 10;

function logRpcFailure(stage, error) {
  const code = typeof error?.code === "string" && /^[A-Za-z0-9_-]{1,16}$/.test(error.code)
    ? error.code : "unknown";
  console.error(`[Spotnera notification worker] RPC failure stage=${stage} code=${code}`);
}

function authorized(request) {
  const expected = process.env.NOTIFICATION_WORKER_SECRET;
  const supplied = request.headers.get("authorization");
  if (!expected || !supplied?.startsWith("Bearer ")) return false;
  const actualBytes = Buffer.from(supplied.slice(7));
  const expectedBytes = Buffer.from(expected);
  return actualBytes.length === expectedBytes.length &&
    timingSafeEqual(actualBytes, expectedBytes);
}

async function updateDelivery(admin, delivery, values) {
  const { data, error } = await admin
    .from("notification_deliveries")
    .update({ ...values, claim_token: null, lease_expires_at: null })
    .eq("id", delivery.delivery_id)
    .eq("claim_token", delivery.claim_token)
    .eq("status", "sending")
    .select("id");
  return !error && data?.length === 1;
}

async function loadEligibleContext(admin, delivery) {
  const { data: event, error: eventError } = await admin
    .from("notification_events")
    .select("deal_id, business_id")
    .eq("id", delivery.event_id)
    .maybeSingle();
  if (eventError) return { kind: "temporary" };
  if (!event) return { kind: "skip" };

  const [dealResult, businessResult, favoriteResult, preferenceResult, deviceResult] =
    await Promise.all([
      admin.from("deals")
        .select("id, business_id, title, is_active, status, availability_mode")
        .eq("id", event.deal_id).maybeSingle(),
      admin.from("businesses").select("id, slug, name, is_active").eq("id", event.business_id).maybeSingle(),
      admin.from("favorites").select("id").eq("business_id", event.business_id)
        .eq("user_id", delivery.user_id).maybeSingle(),
      admin.from("notification_preferences").select("saved_business_new_deals")
        .eq("user_id", delivery.user_id).maybeSingle(),
      admin.from("notification_devices")
        .select("id, endpoint, p256dh, auth, expires_at, enabled, disabled_at")
        .eq("id", delivery.device_id)
        .eq("user_id", delivery.user_id)
        .eq("provider", "webpush")
        .eq("platform", "web")
        .maybeSingle(),
    ]);

  if ([dealResult, businessResult, favoriteResult, preferenceResult, deviceResult]
    .some((result) => result.error)) return { kind: "temporary" };

  const deal = dealResult.data;
  const business = businessResult.data;
  const device = deviceResult.data;
  if (!deal || deal.business_id !== event.business_id ||
      !business || !favoriteResult.data ||
      preferenceResult.data?.saved_business_new_deals !== true ||
      !device || !device.enabled || device.disabled_at ||
      (device.expires_at && Date.parse(device.expires_at) <= Date.now()) ||
      !deal.is_active || deal.status === "paused" || deal.status === "ended" ||
      !business.is_active) {
    return { kind: "skip" };
  }

  if (deal.availability_mode === "weekly") {
    const { data: schedule, error: scheduleError } = await admin
      .from("deal_schedules")
      .select("id")
      .eq("deal_id", deal.id)
      .limit(1)
      .maybeSingle();
    if (scheduleError) return { kind: "temporary" };
    if (!schedule) return { kind: "skip" };
  }

  return { kind: "send", deal, business, device };
}

async function processDelivery(admin, delivery, vapid) {
  if (delivery.device_id === null) {
    return await updateDelivery(admin, delivery, { status: "skipped" })
      ? "skipped" : "uncertain";
  }

  let context;
  try {
    context = await loadEligibleContext(admin, delivery);
  } catch {
    context = { kind: "temporary" };
  }

  if (context.kind === "skip") {
    return await updateDelivery(admin, delivery, { status: "skipped" })
      ? "skipped" : "uncertain";
  }

  let outcome = "temporary";
  if (context.kind === "send") {
    const { business, deal, device } = context;
    outcome = await sendWebPush(device, {
      title: `New deal at ${business.name}`.slice(0, 120),
      body: deal.title.slice(0, 140),
      url: `/business/${encodeURIComponent(business.slug || business.id)}`,
      tag: `spotnera-new-deal-${deal.id}`,
    }, vapid);

    if (outcome === "stale") {
      // A lost claim must not finalize the delivery or delete its device.
      if (!await updateDelivery(admin, delivery, { status: "stale" })) {
        return "uncertain";
      }

      const { data: removed, error: removeError } = await admin
        .from("notification_devices")
        .delete()
        .eq("id", delivery.device_id)
        .eq("user_id", delivery.user_id)
        .eq("provider", "webpush")
        .eq("endpoint", device.endpoint)
        .eq("p256dh", device.p256dh)
        .eq("auth", device.auth)
        .select("id");
      return !removeError && removed?.length === 1 ? "removed" : "stale";
    }
  }

  if (outcome === "sent") {
    return await updateDelivery(admin, delivery, {
      status: "sent", sent_at: new Date().toISOString(),
    }) ? "sent" : "uncertain";
  }

  if (outcome === "uncertain") {
    await updateDelivery(admin, delivery, { status: "uncertain" });
    return "uncertain";
  }

  if (outcome === "invalid" || delivery.attempts >= 4) {
    return await updateDelivery(admin, delivery, { status: "failed" })
      ? "failed" : "uncertain";
  }

  const delaySeconds = Math.min(60 * 2 ** delivery.attempts, 900);
  return await updateDelivery(admin, delivery, {
    status: "pending",
    next_attempt_at: new Date(Date.now() + delaySeconds * 1000).toISOString(),
  }) ? "retried" : "uncertain";
}

export async function POST(request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const vapid = getVapidDetails();
  if (!vapid) {
    return NextResponse.json({ error: "Notification processing is unavailable." }, { status: 503 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Notification processing is unavailable." }, { status: 503 });
  }

  const { error: expireError } = await admin.rpc("expire_new_deal_push_claims", {
    p_limit: BATCH_SIZE,
  });
  if (expireError) {
    logRpcFailure("expire_claims", expireError);
    return NextResponse.json({ error: "Notification processing failed." }, { status: 500 });
  }

  const { error: scanError } = await admin.rpc("scan_new_deal_push_audience", {
    p_limit: BATCH_SIZE,
  });
  if (scanError) {
    logRpcFailure("scan_audience", scanError);
    return NextResponse.json({ error: "Notification processing failed." }, { status: 500 });
  }

  const { data: deliveries, error: claimError } = await admin.rpc(
    "claim_new_deal_push_deliveries",
    { p_limit: BATCH_SIZE },
  );
  if (claimError) {
    logRpcFailure("claim_deliveries", claimError);
    return NextResponse.json({ error: "Notification processing failed." }, { status: 500 });
  }

  const outcomes = await Promise.all((deliveries ?? []).map((delivery) =>
    processDelivery(admin, delivery, vapid).catch(() => "uncertain"),
  ));
  const result = { processed: outcomes.length, sent: 0, retried: 0, removed: 0, stale: 0, skipped: 0, failed: 0, uncertain: 0 };
  for (const outcome of outcomes) {
    if (Object.hasOwn(result, outcome)) result[outcome] += 1;
  }

  return NextResponse.json(result);
}
