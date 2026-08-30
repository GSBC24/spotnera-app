"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { GA_MEASUREMENT_ID, trackPageView } from "@/lib/analytics";

function RouteChangeTracker({ isReady }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastTrackedPath = useRef(null);
  const path = useMemo(() => {
    const queryString = searchParams.toString();
    return queryString ? `${pathname}?${queryString}` : pathname;
  }, [pathname, searchParams]);

  useEffect(() => {
    if (!isReady || !GA_MEASUREMENT_ID || !path || lastTrackedPath.current === path) {
      return;
    }

    lastTrackedPath.current = path;
    trackPageView(path);
  }, [isReady, path]);

  return null;
}

export function GoogleAnalytics() {
  const [isReady, setIsReady] = useState(false);

  if (!GA_MEASUREMENT_ID) {
    return null;
  }

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script
        id="spotnera-google-analytics"
        strategy="afterInteractive"
        onReady={() => setIsReady(true)}
      >
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = window.gtag || gtag;
          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}', { send_page_view: false });
        `}
      </Script>
      <Suspense fallback={null}>
        <RouteChangeTracker isReady={isReady} />
      </Suspense>
    </>
  );
}
