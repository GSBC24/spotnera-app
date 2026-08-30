"use client";

import { useEffect, useMemo, useState } from "react";

const DISMISSED_KEY = "spotnera-install-dismissed";

function isStandaloneMode() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

function isIosBrowser() {
  const userAgent = window.navigator.userAgent.toLowerCase();
  const isIos = /iphone|ipad|ipod/.test(userAgent);
  const isWebKit = /webkit/.test(userAgent);
  const isOtherIosBrowser = /crios|fxios|edgios/.test(userAgent);

  return isIos && isWebKit && !isOtherIosBrowser;
}

export function PwaInstallPrompt() {
  const [installEvent, setInstallEvent] = useState(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [isDismissed, setIsDismissed] = useState(true);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return undefined;
    }

    const registerServiceWorker = () => {
      navigator.serviceWorker.register("/sw.js").catch((error) => {
        console.error("Spotnera service worker registration failed", error);
      });
    };

    if (document.readyState === "complete") {
      registerServiceWorker();
      return undefined;
    }

    window.addEventListener("load", registerServiceWorker);

    return () => {
      window.removeEventListener("load", registerServiceWorker);
    };
  }, []);

  useEffect(() => {
    const setupPrompt = window.setTimeout(() => {
      const hasDismissedPrompt = window.localStorage.getItem(DISMISSED_KEY) === "true";

      if (hasDismissedPrompt || isStandaloneMode()) {
        setIsDismissed(true);
        return;
      }

      setIsDismissed(false);
      setShowIosHint(isIosBrowser());
    }, 0);

    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setInstallEvent(event);
      setShowIosHint(false);
    };
    const handleAppInstalled = () => {
      setInstallEvent(null);
      setShowIosHint(false);
      setIsDismissed(true);
      window.localStorage.setItem(DISMISSED_KEY, "true");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.clearTimeout(setupPrompt);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const promptLabel = useMemo(() => {
    if (installEvent) {
      return "Install Spotnera";
    }

    if (showIosHint) {
      return "Install: Share -> Add to Home Screen";
    }

    return null;
  }, [installEvent, showIosHint]);

  if (isDismissed || !promptLabel) {
    return null;
  }

  const handleInstall = async () => {
    if (!installEvent) {
      return;
    }

    installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    window.localStorage.setItem(DISMISSED_KEY, "true");
  };

  return (
    <div className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-[448px] items-center gap-2 rounded-[22px] border border-white/12 bg-zinc-950/78 p-2 text-white shadow-[0_22px_70px_rgba(0,0,0,0.42)] backdrop-blur-2xl">
      <button
        type="button"
        onClick={handleInstall}
        disabled={!installEvent}
        className="min-h-11 flex-1 rounded-2xl bg-white px-4 text-sm font-bold text-zinc-950 transition hover:bg-white/90 disabled:cursor-default disabled:bg-white/10 disabled:text-white/76"
      >
        {promptLabel}
      </button>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss install prompt"
        className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/8 text-sm font-bold text-white/72 transition hover:bg-white/14"
      >
        X
      </button>
    </div>
  );
}
