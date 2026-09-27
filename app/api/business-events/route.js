import { NextResponse } from "next/server";
import { validateBusinessEvent, isEligibleEventBusiness, isEligibleEventDeal } from "@/lib/business-event-validation.mjs";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";

function safeInsertError(error) {
  const message = typeof error?.message === "string" ? error.message : "";
  const constraint = message.match(/\bconstraint ["'](business_events_[a-z0-9_]+)["']/i)?.[1];
  const column = message.match(/\bcolumn ["']([a-z_]+)["'] of relation ["']business_events["']/i)?.[1]
    ?? message.match(/\bthe ["']([a-z_]+)["'] column of ["']business_events["'] in the schema cache/i)?.[1];
  const reason = /permission denied for (?:table|relation) business_events/i.test(message) ? "table_permission"
    : /violates check constraint/i.test(message) ? "check_constraint"
      : /violates not-null constraint/i.test(message) ? "not_null"
        : /violates foreign key constraint/i.test(message) ? "foreign_key"
          : /schema cache/i.test(message) ? "schema_cache" : "other";
  return {
    code: typeof error?.code === "string" && /^(?:[0-9A-Z]{5}|PGRST\d{3})$/.test(error.code)
      ? error.code : "unknown",
    reason,
    ...(constraint && { constraint }),
    ...(column && { column }),
  };
}

export async function POST(request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return new NextResponse(null, { status: 403 });
  }
  let event;
  try {
    const body = await request.text();
    if (body.length > 512) return new NextResponse(null, { status: 400 });
    event = validateBusinessEvent(JSON.parse(body));
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  // Individual deal saving does not exist yet; never infer it from Save business.
  if (!event || event.eventType === "deal_save") {
    return new NextResponse(null, { status: 400 });
  }
  let stage = "business_lookup";
  try {
    const admin = createAdminClient();
    const { data: business, error: businessError } = await admin.from("businesses")
      .select("id, is_active, website_url, phone, latitude, longitude, address")
      .eq("id", event.businessId).maybeSingle();
    if (businessError || !isEligibleEventBusiness(business, event.eventType)) {
      return new NextResponse(null, { status: 400 });
    }
    if (event.dealId) {
      const { data: deal, error: dealError } = await admin.from("deals")
        .select("business_id, is_active, ends_at")
        .eq("id", event.dealId).eq("business_id", event.businessId).maybeSingle();
      if (dealError || !isEligibleEventDeal(deal, event.businessId)) {
        return new NextResponse(null, { status: 400 });
      }
    }
    if (event.eventType === "favorite_add" || event.eventType === "favorite_remove") {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return new NextResponse(null, { status: 401 });
      if (event.eventType === "favorite_add") {
        const { data: favorite } = await admin.from("favorites")
          .select("business_id").eq("business_id", event.businessId)
          .eq("user_id", user.id).maybeSingle();
        if (!favorite) return new NextResponse(null, { status: 400 });
      }
    }
    stage = "business_events_insert";
    const { error } = await admin.from("business_events").insert({
      business_id: event.businessId,
      event_type: event.eventType,
      deal_id: event.dealId,
      source: event.source,
    });
    if (error) {
      console.error("business_events insert failed", safeInsertError(error));
      return new NextResponse(null, { status: 503 });
    }
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("business_events route exception", { stage, ...safeInsertError(error) });
    return new NextResponse(null, { status: 503 });
  }
}
