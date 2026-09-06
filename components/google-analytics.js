"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { trackPageView } from "@/lib/analytics";
import { getStoredConsent } from "@/lib/consent";

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() ?? "";

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

function RouteChangeTracker({ isReady, measurementId }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastTrackedPath = useRef(null);
  const path = useMemo(() => {
    const queryString = searchParams.toString();
    return queryString ? `${pathname}?${queryString}` : pathname;
  }, [pathname, searchParams]);

  useEffect(() => {
    if (!isReady || !measurementId || !path || lastTrackedPath.current === path) {
      return;
    }

    lastTrackedPath.current = path;
    trackPageView(path);
  }, [isReady, measurementId, path]);

  return null;
}

export function GoogleAnalytics() {
  const [isReady, setIsReady] = useState(false);
  const [hasConsent, setHasConsent] = useState(false);
  const measurementId = GA_MEASUREMENT_ID;

  useEffect(() => {
    const loadConsentId = window.setTimeout(() => {
      setHasConsent(getStoredConsent()?.analytics === true);
    }, 0);

    function handleConsentChange(event) {
      const analyticsGranted = event.detail?.analytics === true;
      setHasConsent(analyticsGranted);

      if (typeof window.gtag === "function") {
        window.gtag("consent", "update", {
          analytics_storage: analyticsGranted ? "granted" : "denied",
          ad_storage: "denied",
          ad_user_data: "denied",
          ad_personalization: "denied",
        });
      }

      if (!analyticsGranted) {
        setIsReady(false);
        clearGoogleAnalyticsCookies();
      }
    }

    window.addEventListener("spotnera-consent-change", handleConsentChange);

    return () => {
      window.clearTimeout(loadConsentId);
      window.removeEventListener("spotnera-consent-change", handleConsentChange);
    };
  }, []);

  return (
    <>
      <Script
        id="spotnera-google-consent-default"
        strategy="afterInteractive"
      >
        {`
          window.dataLayer = window.dataLayer || [];
          window.gtag = function gtag() {
            window.dataLayer.push(arguments);
          };
          window.gtag('consent', 'default', {
            analytics_storage: 'denied',
            ad_storage: 'denied',
            ad_user_data: 'denied',
            ad_personalization: 'denied'
          });
        `}
      </Script>
      {measurementId && hasConsent ? (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
            strategy="afterInteractive"
          />
          <Script
            id="spotnera-google-analytics"
            strategy="afterInteractive"
            onReady={() => setIsReady(true)}
          >
            {`
              window.dataLayer = window.dataLayer || [];
              window.gtag = window.gtag || function gtag() {
                window.dataLayer.push(arguments);
              };
              window.gtag('consent', 'update', {
                analytics_storage: 'granted',
                ad_storage: 'denied',
                ad_user_data: 'denied',
                ad_personalization: 'denied'
              });
              window.gtag('js', new Date());
              window.gtag('config', '${measurementId}', { send_page_view: false });
            `}
          </Script>
        </>
      ) : null}
      <Suspense fallback={null}>
        <RouteChangeTracker
          isReady={isReady && hasConsent}
          measurementId={measurementId}
        />
      </Suspense>
    </>
  );
}
