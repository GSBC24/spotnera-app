export const CONSENT_VERSION = "2026-09-06";
export const CONSENT_STORAGE_KEY = "spotnera-consent";

export function getStoredConsent() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(CONSENT_STORAGE_KEY) ?? "null");

    if (!parsed || parsed.version !== CONSENT_VERSION) {
      return null;
    }

    return {
      necessary: true,
      analytics: parsed.analytics === true,
      version: CONSENT_VERSION,
      timestamp: parsed.timestamp,
    };
  } catch {
    return null;
  }
}

export function hasAnalyticsConsent() {
  return getStoredConsent()?.analytics === true;
}

export function storeConsent({ analytics }) {
  if (typeof window === "undefined") {
    return null;
  }

  const consent = {
    necessary: true,
    analytics: analytics === true,
    version: CONSENT_VERSION,
    timestamp: new Date().toISOString(),
  };

  window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(consent));
  window.dispatchEvent(new CustomEvent("spotnera-consent-change", { detail: consent }));
  return consent;
}

export function openPrivacySettings() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event("spotnera-open-privacy-settings"));
}
