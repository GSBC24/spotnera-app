import { NextResponse } from "next/server";
import { getVapidDetails, sendWebPush } from "@/lib/server/web-push";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

const TEST_PAYLOAD = {
  title: "Spotnera",
  body: "Push notifications are working on this device.",
  url: "/me",
  tag: "spotnera-test",
};

export async function POST(request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Request not allowed." }, { status: 403 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to send a test notification." }, { status: 401 });
  }

  const vapid = getVapidDetails();
  if (!vapid) {
    return NextResponse.json({ error: "Test notifications are unavailable." }, { status: 503 });
  }

  const { data: devices, error } = await supabase
    .from("notification_devices")
    .select("id, endpoint, p256dh, auth, expires_at")
    .eq("user_id", user.id)
    .eq("provider", "webpush")
    .eq("platform", "web")
    .eq("enabled", true)
    .is("disabled_at", null)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

  if (error) {
    return NextResponse.json({ error: "Could not send the test notification." }, { status: 500 });
  }

  if (!devices?.length) {
    return NextResponse.json({ ok: true, sent: 0, failed: 0, removed: 0, noDevices: true });
  }

  const result = { ok: true, sent: 0, failed: 0, removed: 0 };
  for (const device of devices) {
    const outcome = await sendWebPush(device, TEST_PAYLOAD, vapid);
    if (outcome === "sent") {
      result.sent += 1;
    } else {
      if (outcome === "stale") {
        try {
          const { data: removed, error: removalError } = await supabase
            .from("notification_devices")
            .delete()
            .eq("id", device.id)
            .eq("user_id", user.id)
            .eq("provider", "webpush")
            .eq("endpoint", device.endpoint)
            .select("id");
          if (!removalError && removed?.length === 1) {
            result.removed += 1;
          } else {
            result.failed += 1;
          }
        } catch {
          result.failed += 1;
        }
      } else {
        result.failed += 1;
      }
    }
  }

  return NextResponse.json(result);
}
