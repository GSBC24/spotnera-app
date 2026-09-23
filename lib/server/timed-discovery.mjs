import { resolveTimedOccurrences } from "./timed-notifications.mjs";

const DISCOVERY_BATCH = 10;

export async function discoverTimedOccurrences(admin, now = new Date()) {
  const { data: batch, error: batchError } = await admin.rpc(
    "next_timed_discovery_deals", { p_limit: DISCOVERY_BATCH },
  );
  if (batchError) throw batchError;
  let discovered = 0;
  for (const { deal_id: dealId } of batch ?? []) {
    const { data: deal, error: dealError } = await admin.from("deals")
      .select("id, business_id, is_active, timed_edit_token_hash, timed_edit_generation, status, availability_mode, availability_timezone, starts_at, ends_at")
      .eq("id", dealId).maybeSingle();
    if (dealError) throw dealError;
    if (!deal?.is_active || deal.timed_edit_token_hash ||
        deal.status === "paused" || deal.status === "ended") continue;
    const { data: business, error: businessError } = await admin.from("businesses")
      .select("id, is_active").eq("id", deal.business_id).maybeSingle();
    if (businessError) throw businessError;
    if (!business?.is_active) continue;
    let schedules = [];
    if (deal.availability_mode === "weekly") {
      const { data, error } = await admin.from("deal_schedules")
        .select("id, day_of_week, start_time, end_time, spans_midnight")
        .eq("deal_id", deal.id).order("day_of_week").order("id").limit(21);
      if (error) throw error;
      if (data.length > 20) continue;
      schedules = data;
    }
    // Separate PostgREST reads can straddle a committed owner save. A changed
    // generation or active lease invalidates this discovery snapshot.
    const { data: snapshot, error: snapshotError } = await admin.from("deals")
      .select("timed_edit_token_hash, timed_edit_generation")
      .eq("id", deal.id).maybeSingle();
    if (snapshotError) throw snapshotError;
    if (!snapshot || snapshot.timed_edit_token_hash ||
        snapshot.timed_edit_generation !== deal.timed_edit_generation) continue;
    for (const occurrence of resolveTimedOccurrences(deal, schedules, now)) {
      const { data: existing, error: lookupError } = await admin
        .from("notification_events").select("id, source_fingerprint, timed_edit_generation")
        .eq("event_type", occurrence.event_type).eq("deal_id", deal.id)
        .eq("occurrence_key", occurrence.occurrence_key).maybeSingle();
      if (lookupError) throw lookupError;
      if (existing?.source_fingerprint === occurrence.source_fingerprint &&
          existing.timed_edit_generation === occurrence.timed_edit_generation) continue;
      const payload = { ...occurrence, source_observed_at: now.toISOString(),
        next_scan_at: now.toISOString(),
        scan_complete: false, cursor_user_id: null, cursor_device_id: null };
      const result = existing
        ? await admin.from("notification_events").update(payload).eq("id", existing.id)
        : await admin.from("notification_events").insert(payload);
      // A concurrent discovery can win the unique insert. Its next pass will
      // reconcile the snapshot; no send can pass the live fingerprint check.
      if (result.error && result.error.code !== "23505") throw result.error;
      discovered += 1;
    }
  }
  return discovered;
}
