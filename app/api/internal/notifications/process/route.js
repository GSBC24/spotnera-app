import { Buffer } from "node:buffer";
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getVapidDetails, sendWebPush } from "@/lib/server/web-push";
import { discoverTimedOccurrences } from "@/lib/server/timed-discovery.mjs";
import { isTimedDeliveryDue, resolveTimedOccurrences, sameTimestampInstant, timedDeliveryTiming,
  TIMED_START, TIMED_END } from "@/lib/server/timed-notifications.mjs";
import { createAdminClient } from "@/utils/supabase/admin";

export const runtime = "nodejs";

const BATCH_SIZE = 10;
const TIMED_ENABLED = process.env.ENABLE_TIMED_DEAL_PUSH === "true";

function safeText(value, maximum) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, maximum);
}

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
    .select("event_type, deal_id, business_id")
    .eq("id", delivery.event_id)
    .maybeSingle();
  if (eventError) return { kind: "temporary" };
  if (!event || event.event_type !== "saved_business_new_deal") return { kind: "skip" };

  const [dealResult, businessResult, favoriteResult, preferenceResult, deviceResult] =
    await Promise.all([
      admin.from("deals")
        .select("id, business_id, title, is_active, status, availability_mode")
        .eq("id", event.deal_id).maybeSingle(),
      admin.from("businesses").select("id, slug, name, is_active").eq("id", event.business_id).maybeSingle(),
      admin.from("favorites").select("id, deal_notifications_enabled").eq("business_id", event.business_id)
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
      !business || favoriteResult.data?.deal_notifications_enabled !== true ||
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

  return { kind: "send", device, payload: {
    title: `New deal at ${safeText(business.name, 108)}`.slice(0, 120),
    body: safeText(deal.title, 140),
    url: `/business/${encodeURIComponent(business.slug || business.id)}`,
    tag: `spotnera-new-deal-${deal.id}`,
  } };
}

async function loadTimedContext(admin, delivery) {
  const { data: event, error: eventError } = await admin.from("notification_events")
    .select("event_type, deal_id, business_id, occurrence_key, occurrence_start_at, occurrence_end_at, source_fingerprint, source_observed_at, timed_edit_generation")
    .eq("id", delivery.event_id).maybeSingle();
  if (eventError) return { kind: "temporary" };
  if (!event || ![TIMED_START, TIMED_END].includes(event.event_type)) return { kind: "skip" };
  if (!event.source_observed_at ||
      Date.now() < Date.parse(event.source_observed_at) + 2 * 60_000) {
    return { kind: "temporary" };
  }
  const [dealResult, businessResult, favoriteResult, preferenceResult, deviceResult,
    deliveryResult] = await Promise.all([
    admin.from("deals").select("id, business_id, title, is_active, timed_edit_token_hash, timed_edit_generation, status, availability_mode, availability_timezone, starts_at, ends_at")
      .eq("id", event.deal_id).maybeSingle(),
    admin.from("businesses").select("id, slug, name, is_active")
      .eq("id", event.business_id).maybeSingle(),
    admin.from("favorites").select("id, deal_notifications_enabled").eq("business_id", event.business_id)
      .eq("user_id", delivery.user_id).maybeSingle(),
    admin.from("notification_preferences")
      .select("saved_business_deal_starting_soon, starting_soon_minutes, saved_business_deal_ending_soon, ending_soon_minutes")
      .eq("user_id", delivery.user_id).maybeSingle(),
    admin.from("notification_devices")
      .select("id, endpoint, p256dh, auth, expires_at, enabled, disabled_at")
      .eq("id", delivery.device_id).eq("user_id", delivery.user_id)
      .eq("provider", "webpush").eq("platform", "web").maybeSingle(),
    admin.from("notification_deliveries")
      .select("lead_minutes, intended_due_at, deadline_at, timed_edit_generation")
      .eq("id", delivery.delivery_id).eq("claim_token", delivery.claim_token)
      .eq("status", "sending").maybeSingle(),
  ]);
  if ([dealResult, businessResult, favoriteResult, preferenceResult, deviceResult,
    deliveryResult].some((result) => result.error)) return { kind: "temporary" };
  const deal = dealResult.data;
  const business = businessResult.data;
  const device = deviceResult.data;
  const persisted = deliveryResult.data;
  if (!deal || deal.business_id !== event.business_id || !deal.is_active ||
      deal.timed_edit_token_hash ||
      deal.timed_edit_generation !== event.timed_edit_generation ||
      deal.status === "paused" || deal.status === "ended" ||
      !business?.is_active || favoriteResult.data?.deal_notifications_enabled !== true || !device || !persisted ||
      !device.enabled || device.disabled_at ||
      (device.expires_at && Date.parse(device.expires_at) <= Date.now())) {
    return { kind: "skip" };
  }
  let schedules = [];
  if (deal.availability_mode === "weekly") {
    const { data, error } = await admin.from("deal_schedules")
      .select("id, day_of_week, start_time, end_time, spans_midnight")
      .eq("deal_id", deal.id).order("day_of_week").order("id").limit(21);
    if (error) return { kind: "temporary" };
    if (data.length > 20) return { kind: "skip" };
    schedules = data;
  }
  const { data: snapshot, error: snapshotError } = await admin.from("deals")
    .select("timed_edit_token_hash, timed_edit_generation")
    .eq("id", deal.id).maybeSingle();
  if (snapshotError) return { kind: "temporary" };
  if (!snapshot || snapshot.timed_edit_token_hash ||
      snapshot.timed_edit_generation !== deal.timed_edit_generation ||
      persisted.timed_edit_generation !== event.timed_edit_generation) return { kind: "skip" };
  const current = resolveTimedOccurrences(deal, schedules, new Date())
    .find((item) => item.event_type === event.event_type &&
      item.occurrence_key === event.occurrence_key);
  if (!current || current.source_fingerprint !== event.source_fingerprint ||
      !sameTimestampInstant(current.occurrence_start_at, event.occurrence_start_at) ||
      !sameTimestampInstant(current.occurrence_end_at, event.occurrence_end_at)) return { kind: "skip" };
  const timing = timedDeliveryTiming(current, preferenceResult.data);
  if (!timing || timing.leadMinutes !== persisted.lead_minutes ||
      !sameTimestampInstant(timing.intendedDueAt, persisted.intended_due_at) ||
      !sameTimestampInstant(timing.deadlineAt, persisted.deadline_at) ||
      !isTimedDeliveryDue(timing, new Date(), current)) return { kind: "skip" };
  const starting = event.event_type === TIMED_START;
  return { kind: "send", device, dealId: deal.id,
    timedEditGeneration: deal.timed_edit_generation,
    deadlineAt: timing.deadlineAt, payload: {
    title: `${starting ? "Starting" : "Ending"} soon at ${safeText(business.name, 100)}`.slice(0, 120),
    body: `${safeText(deal.title, 128)} ${starting ? "starts" : "ends"} soon.`.slice(0, 140),
    url: `/business/${encodeURIComponent(business.slug || business.id)}`,
    tag: `spotnera-${starting ? "start" : "end"}-${deal.id}-${event.occurrence_key}`,
  } };
}

async function processDelivery(admin, delivery, vapid, timed = false) {
  if (delivery.device_id === null) {
    return await updateDelivery(admin, delivery, { status: "skipped" })
      ? "skipped" : "uncertain";
  }

  let context;
  try {
    context = timed ? await loadTimedContext(admin, delivery) :
      await loadEligibleContext(admin, delivery);
  } catch {
    context = { kind: "temporary" };
  }

  if (context.kind === "skip") {
    return await updateDelivery(admin, delivery, { status: "skipped" })
      ? "skipped" : "uncertain";
  }

  let outcome = "temporary";
  if (context.kind === "send") {
    const { device } = context;
    if (timed) {
      const { data: lastSnapshot, error: lastError } = await admin.from("deals")
        .select("timed_edit_token_hash, timed_edit_generation")
        .eq("id", context.dealId).maybeSingle();
      if (lastError) {
        const retryAt = Date.now() + 60_000;
        if (retryAt >= Date.parse(context.deadlineAt)) {
          return await updateDelivery(admin, delivery, { status: "skipped" })
            ? "skipped" : "uncertain";
        }
        return await updateDelivery(admin, delivery, {
          status: "pending", next_attempt_at: new Date(retryAt).toISOString(),
        }) ? "retried" : "uncertain";
      }
      if (!lastSnapshot || lastSnapshot.timed_edit_token_hash ||
          lastSnapshot.timed_edit_generation !== context.timedEditGeneration) {
        return await updateDelivery(admin, delivery, { status: "skipped" })
          ? "skipped" : "uncertain";
      }
    }
    if (timed && Date.now() >= Date.parse(context.deadlineAt)) {
      return await updateDelivery(admin, delivery, { status: "skipped" })
        ? "skipped" : "uncertain";
    }
    outcome = await sendWebPush(device, context.payload, vapid);

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
  if (timed && context.deadlineAt &&
      Date.now() + delaySeconds * 1000 >= Date.parse(context.deadlineAt)) {
    return await updateDelivery(admin, delivery, { status: "skipped" })
      ? "skipped" : "uncertain";
  }
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
    p_limit: TIMED_ENABLED ? 5 : BATCH_SIZE,
  });
  if (scanError) {
    logRpcFailure("scan_audience", scanError);
    return NextResponse.json({ error: "Notification processing failed." }, { status: 500 });
  }

  const { data: newDeals, error: claimError } = await admin.rpc(
    "claim_new_deal_push_deliveries",
    { p_limit: TIMED_ENABLED ? 5 : BATCH_SIZE },
  );
  if (claimError) {
    logRpcFailure("claim_deliveries", claimError);
    return NextResponse.json({ error: "Notification processing failed." }, { status: 500 });
  }

  let timedDeliveries = [];
  let extraNewDeals = [];
  if (TIMED_ENABLED) {
    try {
      await discoverTimedOccurrences(admin);
      const { error: audienceError } = await admin.rpc("scan_timed_push_audience", { p_limit: 20 });
      if (audienceError) logRpcFailure("timed_audience", audienceError);
      const { error: expiryError } = await admin.rpc("skip_expired_timed_push_deliveries", { p_limit: 20 });
      if (expiryError) logRpcFailure("timed_expiry", expiryError);
      const { data, error } = await admin.rpc("claim_timed_push_deliveries", { p_limit: 5 });
      if (error) {
        logRpcFailure("timed_claim", error);
        const { data: extra, error: extraError } = await admin.rpc(
          "claim_new_deal_push_deliveries", { p_limit: 5 },
        );
        if (extraError) logRpcFailure("new_deal_lending", extraError);
        else extraNewDeals = extra ?? [];
      } else timedDeliveries = data ?? [];
      if (!error && timedDeliveries.length < 5) {
        const { data: extra, error: extraError } = await admin.rpc(
          "claim_new_deal_push_deliveries", { p_limit: 5 - timedDeliveries.length },
        );
        if (extraError) logRpcFailure("new_deal_lending", extraError);
        else extraNewDeals = extra ?? [];
      } else if (!error && (newDeals ?? []).length < 5) {
        const { data: extra, error: extraError } = await admin.rpc(
          "claim_timed_push_deliveries", { p_limit: 5 - (newDeals ?? []).length },
        );
        if (extraError) logRpcFailure("timed_lending", extraError);
        else timedDeliveries.push(...(extra ?? []));
      }
    } catch {
      console.error("[Spotnera notification worker] Timed discovery failed");
      const { data: extra, error: extraError } = await admin.rpc(
        "claim_new_deal_push_deliveries", { p_limit: 5 },
      );
      if (extraError) logRpcFailure("new_deal_lending", extraError);
      else extraNewDeals = extra ?? [];
    }
  }
  const work = [...(newDeals ?? []), ...extraNewDeals].map((delivery) =>
    processDelivery(admin, delivery, vapid).catch(() => "uncertain"));
  work.push(...timedDeliveries.map((delivery) =>
    processDelivery(admin, delivery, vapid, true).catch(() => "uncertain")));
  const outcomes = await Promise.all(work);
  const result = { processed: outcomes.length, sent: 0, retried: 0, removed: 0, stale: 0, skipped: 0, failed: 0, uncertain: 0 };
  for (const outcome of outcomes) {
    if (Object.hasOwn(result, outcome)) result[outcome] += 1;
  }

  return NextResponse.json(result);
}
