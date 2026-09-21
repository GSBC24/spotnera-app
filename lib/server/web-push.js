import "server-only";
import { Buffer } from "node:buffer";
import webpush from "web-push";

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

export function getVapidDetails() {
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

export function isStoredSubscriptionUsable(device) {
  return isAllowedPushEndpoint(device.endpoint) &&
    validBase64Url(device.p256dh, 65, 0x04) &&
    validBase64Url(device.auth, 16);
}

export async function sendWebPush(device, payload, vapid) {
  if (!isStoredSubscriptionUsable(device)) return "invalid";

  try {
    await webpush.sendNotification(
      {
        endpoint: device.endpoint,
        keys: { p256dh: device.p256dh, auth: device.auth },
        expirationTime: device.expires_at ? Date.parse(device.expires_at) : null,
      },
      JSON.stringify(payload),
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
    return "sent";
  } catch (error) {
    if (error?.statusCode === 404 || error?.statusCode === 410) return "stale";
    // An explicit provider timeout/rate limit/server response can be retried.
    if (error?.statusCode === 408 || error?.statusCode === 429 || error?.statusCode >= 500) {
      return "temporary";
    }
    if (error?.statusCode) {
      return "invalid";
    }
    // With no provider response, delivery acceptance is unknown. Avoid an
    // automatic retry that could show the same deal twice.
    return "uncertain";
  }
}
