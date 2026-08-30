"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { trackPageView } from "@/lib/analytics";

const GA_MEASUREMENT_ID = "G-ZM6VRS3E8M";

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
  const measurementId = GA_MEASUREMENT_ID;

  return (
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
          window.gtag = function gtag() {
            window.dataLayer.push(arguments);
          };
          window.gtag('js', new Date());
          window.gtag('config', '${measurementId}', { send_page_view: false });
        `}
      </Script>
      <Suspense fallback={null}>
        <RouteChangeTracker isReady={isReady} measurementId={measurementId} />
      </Suspense>
    </>
  );
}
