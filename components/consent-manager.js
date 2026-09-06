"use client";

import { useEffect, useState } from "react";
import { CONSENT_VERSION, getStoredConsent, storeConsent } from "@/lib/consent";

function updateGoogleConsent(analytics) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") {
    return;
  }

  window.gtag("consent", "update", {
    analytics_storage: analytics ? "granted" : "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  });
}

function clearGoogleAnalyticsCookies() {
  if (typeof document === "undefined") {
    return;
  }

  const cookieNames = document.cookie
    .split(";")
    .map((cookie) => cookie.split("=")[0]?.trim())
    .filter((name) => name === "_ga" || name?.startsWith("_ga_"));

  for (const name of cookieNames) {
    document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax`;
    document.cookie = `${name}=; Max-Age=0; path=/; domain=${window.location.hostname}; SameSite=Lax`;
  }
}

export function ConsentManager() {
  const [consent, setConsent] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const shouldShowBanner = isLoaded && !consent && !isSettingsOpen;
  const analyticsEnabled = consent?.analytics === true;

  useEffect(() => {
    const loadConsentId = window.setTimeout(() => {
      const storedConsent = getStoredConsent();
      setConsent(storedConsent);
      setIsLoaded(true);

      if (storedConsent) {
        updateGoogleConsent(storedConsent.analytics);
      }
    }, 0);

    function handleConsentChange(event) {
      setConsent(event.detail);
      updateGoogleConsent(event.detail.analytics);
    }

    function handleOpenSettings() {
      setIsSettingsOpen(true);
    }

    window.addEventListener("spotnera-consent-change", handleConsentChange);
    window.addEventListener("spotnera-open-privacy-settings", handleOpenSettings);

    return () => {
      window.clearTimeout(loadConsentId);
      window.removeEventListener("spotnera-consent-change", handleConsentChange);
      window.removeEventListener("spotnera-open-privacy-settings", handleOpenSettings);
    };
  }, []);

  function saveChoice(analytics) {
    const nextConsent = storeConsent({ analytics });
    setConsent(nextConsent);
    updateGoogleConsent(analytics);
    if (!analytics) {
      clearGoogleAnalyticsCookies();
    }
    setIsSettingsOpen(false);
  }

  if (!shouldShowBanner && !isSettingsOpen) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-[80] px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-4">
      <section className="mx-auto w-full max-w-2xl rounded-[28px] border border-white/14 bg-zinc-950/92 p-4 text-white shadow-[0_28px_90px_rgba(0,0,0,0.42)] backdrop-blur-2xl sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="spotnera-kicker text-[#72f0cc]">Privacy choices</p>
            <h2 className="mt-2 text-xl font-semibold">Choose analytics settings</h2>
          </div>
          {isSettingsOpen ? (
            <button
              type="button"
              onClick={() => setIsSettingsOpen(false)}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/8 text-sm font-black text-white/72 transition hover:bg-white/14"
              aria-label="Close privacy settings"
            >
              X
            </button>
          ) : null}
        </div>

        <p className="mt-3 text-sm leading-6 text-white/70">
          Spotnera uses necessary technologies to keep the service working. With your permission, we also use analytics to understand how Spotnera is used and improve the experience.
        </p>

        {isSettingsOpen ? (
          <div className="mt-4 grid gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/8 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-white">Necessary</p>
                  <p className="mt-1 text-xs leading-5 text-white/58">
                    Required for authentication, security, PWA caching, and core Spotnera features.
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-white/12 px-3 py-1 text-xs font-black text-white/72">
                  Always active
                </span>
              </div>
            </div>
            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/8 p-3">
              <span>
                <span className="block text-sm font-bold text-white">Analytics</span>
                <span className="mt-1 block text-xs leading-5 text-white/58">
                  Allows Google Analytics 4 events after consent. You can turn this off again at any time.
                </span>
              </span>
              <input
                type="checkbox"
                checked={analyticsEnabled}
                onChange={(event) => saveChoice(event.target.checked)}
                className="h-5 w-5 shrink-0 accent-[#33d6a6]"
              />
            </label>
          </div>
        ) : null}

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => saveChoice(false)}
            className="min-h-12 rounded-[18px] border border-white/18 bg-white/10 px-4 text-sm font-black text-white transition hover:bg-white/16"
          >
            Reject analytics
          </button>
          <button
            type="button"
            onClick={() => saveChoice(true)}
            className="min-h-12 rounded-[18px] border border-white/18 bg-white/10 px-4 text-sm font-black text-white transition hover:bg-white/16"
          >
            Accept analytics
          </button>
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="min-h-12 rounded-[18px] border border-white/10 bg-white px-4 text-sm font-black text-zinc-950 transition hover:bg-white/90"
          >
            Privacy settings
          </button>
        </div>

        <p className="mt-3 text-[11px] font-semibold text-white/44">
          Consent version {CONSENT_VERSION}
        </p>
      </section>
    </div>
  );
}
