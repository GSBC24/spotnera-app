"use client";

import { useEffect, useRef, useState } from "react";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() ?? "";
const SERVICE_WORKER_READY_TIMEOUT_MS = 10000;

class PushActionError extends Error {}

function supportsWebPush() {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

function urlBase64ToUint8Array(value) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const decoded = window.atob(base64);

  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}

async function getReadyRegistration() {
  let timeoutId;
  try {
    return await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((resolve, reject) => {
        timeoutId = window.setTimeout(
          () => reject(new Error("Service worker was not ready in time.")),
          SERVICE_WORKER_READY_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    if (timeoutId) window.clearTimeout(timeoutId);
  }
}

async function readResponseError(response, fallback) {
  try {
    const data = await response.json();
    return typeof data?.error === "string" ? data.error : fallback;
  } catch {
    return fallback;
  }
}

export function PushNotificationControl() {
  const [status, setStatus] = useState("checking");
  const [subscription, setSubscription] = useState(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [message, setMessage] = useState("");
  const [testStatus, setTestStatus] = useState("idle");
  const actionLockRef = useRef(false);
  const testLockRef = useRef(false);
  const testCooldownTimerRef = useRef(null);

  useEffect(() => {
    let disposed = false;
    const timerId = window.setTimeout(() => {
      async function inspectCurrentDevice() {
        if (!supportsWebPush()) {
          if (!disposed) setStatus("unsupported");
          return;
        }

        try {
          const registration = await getReadyRegistration();
          if (disposed) return;

          const currentSubscription = await registration.pushManager.getSubscription();
          if (disposed) return;

          setSubscription(currentSubscription);
          if (currentSubscription) {
            const response = await fetch(
              "/api/notifications/subscriptions",
              {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ endpoint: currentSubscription.endpoint }),
                cache: "no-store",
              },
            );
            if (!response.ok) {
              throw new Error("Subscription ownership check failed.");
            }

            const data = await response.json();
            if (disposed) return;
            setStatus(data?.ownedByCurrentUser === true ? "enabled" : "unlinked");
          } else if (Notification.permission === "denied") {
            setStatus("denied");
          } else if (!VAPID_PUBLIC_KEY) {
            setStatus("missing-configuration");
          } else {
            setStatus("disabled");
          }
        } catch {
          if (!disposed) {
            setMessage("Unable to check push availability on this device.");
            setStatus("check-error");
          }
        }
      }

      void inspectCurrentDevice();
    }, 0);

    return () => {
      disposed = true;
      window.clearTimeout(timerId);
      if (testCooldownTimerRef.current) window.clearTimeout(testCooldownTimerRef.current);
    };
  }, []);

  async function sendTestNotification() {
    if (status !== "enabled" || !subscription || testLockRef.current || testCooldownTimerRef.current) return;
    testLockRef.current = true;
    setTestStatus("sending");

    try {
      const ownershipResponse = await fetch("/api/notifications/subscriptions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
        cache: "no-store",
      });
      if (!ownershipResponse.ok) throw new Error("Subscription ownership check failed.");
      const ownership = await ownershipResponse.json();
      if (ownership?.ownedByCurrentUser !== true) {
        setStatus("unlinked");
        throw new Error("Subscription is not linked to this account.");
      }

      const response = await fetch("/api/notifications/test", { method: "POST" });
      if (!response.ok) throw new Error("Test send failed.");
      const result = await response.json();
      setTestStatus(
        result?.sent > 0 ? "sent" : result?.noDevices === true ? "no-devices" : "error",
      );
    } catch {
      setTestStatus("error");
    } finally {
      testLockRef.current = false;
      testCooldownTimerRef.current = window.setTimeout(() => {
        testCooldownTimerRef.current = null;
        setTestStatus("idle");
      }, 10000);
    }
  }

  function beginEnable() {
    setMessage("");
    if (Notification.permission === "denied") {
      setStatus("denied");
      return;
    }
    setShowExplanation(true);
  }

  async function enablePush() {
    if (actionLockRef.current) return;
    actionLockRef.current = true;
    setShowExplanation(false);
    setMessage("");
    setStatus("enabling");

    let newSubscription = null;
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        if (permission === "denied") {
          setStatus("denied");
        } else {
          setMessage("Notification permission was not granted. You can try again when ready.");
          setStatus("disabled");
        }
        return;
      }

      if (!VAPID_PUBLIC_KEY) {
        setStatus("missing-configuration");
        return;
      }

      const registration = await getReadyRegistration();
      newSubscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        }));

      const response = await fetch("/api/notifications/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSubscription.toJSON()),
      });

      if (!response.ok) {
        const responseMessage = await readResponseError(
          response,
          "Unable to enable push on this device. Please try again.",
        );
        const unsubscribed = await newSubscription.unsubscribe().catch(() => false);
        if (unsubscribed) newSubscription = null;
        throw new PushActionError(responseMessage);
      }

      setSubscription(newSubscription);
      setMessage("Push is enabled on this device.");
      setStatus("enabled");
    } catch (error) {
      setSubscription(newSubscription);
      setMessage(
        error instanceof PushActionError
          ? error.message
          : "Unable to enable push on this device. Please try again.",
      );
      setStatus(
        Notification.permission === "denied"
          ? "denied"
          : newSubscription
            ? "unlinked"
            : "disabled",
      );
    } finally {
      actionLockRef.current = false;
    }
  }

  async function disablePush() {
    if (actionLockRef.current || !subscription) return;
    actionLockRef.current = true;
    setMessage("");
    setStatus("disabling");

    let databaseRowRemoved = false;
    try {
      const response = await fetch("/api/notifications/subscriptions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });

      if (!response.ok) {
        throw new PushActionError(
          await readResponseError(
            response,
            "Unable to disable push on this device. Please try again.",
          ),
        );
      }
      databaseRowRemoved = true;

      const unsubscribed = await subscription.unsubscribe();
      if (!unsubscribed) {
        throw new PushActionError(
          "The browser could not remove this subscription. Please try again.",
        );
      }

      setSubscription(null);
      setMessage("Push is disabled on this device.");
      setStatus(VAPID_PUBLIC_KEY ? "disabled" : "missing-configuration");
    } catch (error) {
      setMessage(
        error instanceof PushActionError
          ? error.message
          : "Unable to disable push on this device. Please try again.",
      );
      setStatus(databaseRowRemoved ? "unlinked" : "enabled");
    } finally {
      actionLockRef.current = false;
    }
  }

  async function resetLocalSubscription() {
    if (actionLockRef.current || !subscription) return;
    actionLockRef.current = true;
    setMessage("");
    setStatus("resetting");

    try {
      const unsubscribed = await subscription.unsubscribe();
      if (!unsubscribed) {
        throw new PushActionError(
          "The browser could not reset this subscription. Please try again.",
        );
      }

      setSubscription(null);
      setMessage("The previous browser subscription was reset. You can enable push for this account when ready.");
      setStatus(VAPID_PUBLIC_KEY ? "disabled" : "missing-configuration");
    } catch (error) {
      setMessage(
        error instanceof PushActionError
          ? error.message
          : "Unable to reset this browser subscription. Please try again.",
      );
      setStatus("unlinked");
    } finally {
      actionLockRef.current = false;
    }
  }

  const isBusy =
    status === "checking" ||
    status === "enabling" ||
    status === "disabling" ||
    status === "resetting";

  return (
    <section className="rounded-[20px] border border-white/12 bg-black/24 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-white">Push on this device</p>
          <p className="mt-1 text-xs leading-5 text-white/60">
            Enroll this browser for New Deal alerts from businesses you save when the New Deals preference is on. Other deal alerts are not live yet.
          </p>
        </div>
        <span className="rounded-full border border-white/12 bg-white/8 px-3 py-1 text-[11px] font-bold text-white/70">
          {status === "enabled" || status === "disabling"
            ? "Enabled"
            : status === "checking" || status === "resetting"
              ? "Checking"
              : "Not enabled"}
        </span>
      </div>

      {status === "checking" ? (
        <p className="mt-3 text-sm text-white/60" role="status">
          Checking this device...
        </p>
      ) : null}

      {status === "unsupported" ? (
        <p className="mt-3 rounded-2xl border border-amber-300/25 bg-amber-500/14 px-3 py-2 text-sm text-amber-50">
          This browser does not support Web Push.
        </p>
      ) : null}

      {status === "missing-configuration" ? (
        <p className="mt-3 rounded-2xl border border-amber-300/25 bg-amber-500/14 px-3 py-2 text-sm text-amber-50">
          Push enrollment is not configured for this environment yet.
        </p>
      ) : null}

      {status === "denied" ? (
        <p className="mt-3 rounded-2xl border border-amber-300/25 bg-amber-500/14 px-3 py-2 text-sm text-amber-50">
          Notification permission is blocked. You can allow it in this browser or device&apos;s site settings.
        </p>
      ) : null}

      {status === "unlinked" || status === "resetting" ? (
        <p className="mt-3 rounded-2xl border border-amber-300/25 bg-amber-500/14 px-3 py-2 text-sm text-amber-50">
          This browser has a notification subscription linked to another or previous Spotnera session. Reset it locally before enabling push for this account.
        </p>
      ) : null}

      {status === "check-error" ? (
        <p className="mt-3 rounded-2xl border border-amber-300/25 bg-amber-500/14 px-3 py-2 text-sm text-amber-50">
          Spotnera could not verify which account this browser subscription belongs to. Reload and try again.
        </p>
      ) : null}

      {showExplanation ? (
        <div className="mt-3 rounded-2xl border border-[#33d6a6]/25 bg-[#33d6a6]/10 p-3">
          <p className="text-sm leading-6 text-white">
            Allow Spotnera to notify you about deals from businesses you save. Your browser will ask for permission next.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={enablePush}
              className="spotnera-brand-action min-h-11 rounded-2xl px-4 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#72f0cc]"
            >
              Continue
            </button>
            <button
              type="button"
              onClick={() => setShowExplanation(false)}
              className="spotnera-secondary-action min-h-11 px-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <div aria-live="polite" aria-atomic="true">
        {message ? (
          <p className="mt-3 rounded-2xl border border-white/12 bg-white/8 px-3 py-2 text-sm text-white/75">
            {message}
          </p>
        ) : null}
      </div>

      {!showExplanation && status === "disabled" ? (
        <button
          type="button"
          onClick={beginEnable}
          disabled={isBusy}
          className="spotnera-brand-action mt-3 min-h-11 rounded-2xl px-4 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-60"
        >
          Enable push on this device
        </button>
      ) : null}

      {status === "enabled" || status === "disabling" ? (
        <button
          type="button"
          onClick={disablePush}
          disabled={isBusy}
          className="spotnera-secondary-action mt-3 min-h-11 px-4 text-sm disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === "disabling" ? "Disabling..." : "Disable push on this device"}
        </button>
      ) : null}

      {status === "enabled" ? (
        <div className="mt-3 border-t border-white/10 pt-3">
          <p className="text-xs leading-5 text-white/60">
            Send a test notification to your enrolled Spotnera devices. This does not change your deal alert settings.
          </p>
          <button
            type="button"
            onClick={sendTestNotification}
            disabled={testStatus !== "idle"}
            className="spotnera-secondary-action mt-2 min-h-11 px-4 text-sm disabled:cursor-not-allowed disabled:opacity-60"
          >
            {testStatus === "sending" ? "Sending..." : "Send test notification"}
          </button>
          <p className="mt-2 text-xs text-white/70" role="status" aria-live="polite">
            {testStatus === "sent" ? "Test notification sent." :
              testStatus === "no-devices" ? "No enrolled push device found." :
                testStatus === "error" ? "Could not send the test notification." : ""}
          </p>
        </div>
      ) : null}

      {status === "unlinked" || status === "resetting" ? (
        <button
          type="button"
          onClick={resetLocalSubscription}
          disabled={isBusy}
          className="spotnera-secondary-action mt-3 min-h-11 px-4 text-sm disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === "resetting" ? "Resetting..." : "Reset notification subscription"}
        </button>
      ) : null}
    </section>
  );
}
