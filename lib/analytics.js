export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim();

export function isAnalyticsEnabled() {
  return Boolean(GA_MEASUREMENT_ID);
}

function canUseGtag() {
  return (
    isAnalyticsEnabled() &&
    typeof window !== "undefined" &&
    typeof window.gtag === "function"
  );
}

function getSafeParameters(parameters) {
  return Object.fromEntries(
    Object.entries(parameters).filter(([, value]) => value !== undefined && value !== null),
  );
}

export function trackPageView(path) {
  if (!canUseGtag() || !path) {
    return;
  }

  try {
    window.gtag("event", "page_view", {
      page_path: path,
      page_location: window.location.href,
      page_title: document.title,
    });
  } catch (error) {
    console.warn("GA page view tracking failed", error);
  }
}

export function trackEvent(name, parameters = {}) {
  if (!canUseGtag() || !name) {
    return;
  }

  try {
    window.gtag("event", name, getSafeParameters(parameters));
  } catch (error) {
    console.warn(`GA event tracking failed: ${name}`, error);
  }
}
