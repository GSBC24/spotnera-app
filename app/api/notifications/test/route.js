import { Buffer } from "node:buffer";
import { NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

const TEST_PAYLOAD = JSON.stringify({
  title: "Spotnera",
  body: "Push notifications are working on this device.",
  url: "/me",
  tag: "spotnera-test",
});

function validBase64Url(value, byteLength, firstByte) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/.test(value)) return false;
  try {
    const decoded = Buffer.from(value, "base64url");
    return decoded.length === byteLength &&
      (firstByte === undefined || decoded[0] === firstByte) &&
      decoded.toString("base64url") === value;
  } catch {
    return false;
  }
}

function getVapidDetails() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim();

  if (!validBase64Url(publicKey, 65, 0x04) ||
      !validBase64Url(privateKey, 32) ||
      !subject || !/^mailto:[^@\s]+@[^@\s]+$/.test(subject)) {
    return null;
  }

  return { publicKey, privateKey, subject };
}

function isAllowedPushEndpoint(value) {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    return url.protocol === "https:" && !url.username && !url.password &&
      !url.hash && !url.port &&
      (hostname === "fcm.googleapis.com" ||
        hostname === "updates.push.services.mozilla.com" ||
        hostname === "push.services.mozilla.com" ||
        hostname === "push.apple.com" ||
        hostname.endsWith(".push.apple.com"));
  } catch {
    return false;
  }
}

function isStoredSubscriptionUsable(device) {
  return isAllowedPushEndpoint(device.endpoint) &&
    validBase64Url(device.p256dh, 65, 0x04) &&
    validBase64Url(device.auth, 16);
}

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
    if (!isStoredSubscriptionUsable(device)) {
      result.failed += 1;
      continue;
    }

    try {
      await webpush.sendNotification(
        {
          endpoint: device.endpoint,
          keys: { p256dh: device.p256dh, auth: device.auth },
          expirationTime: device.expires_at ? Date.parse(device.expires_at) : null,
        },
        TEST_PAYLOAD,
        {
          TTL: 60,
          timeout: 10000,
          vapidDetails: {
            subject: vapid.subject,
            publicKey: vapid.publicKey,
            privateKey: vapid.privateKey,
          },
        },
      );
      result.sent += 1;
    } catch (sendError) {
      if (sendError?.statusCode === 404 || sendError?.statusCode === 410) {
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
