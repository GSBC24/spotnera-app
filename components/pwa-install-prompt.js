"use client";

import { useEffect, useRef, useState } from "react";
import { getStoredConsent } from "@/lib/consent";

const DISMISSED_KEY = "spotnera-install-dismissed";
const CONTROLLER_RELOAD_KEY = "spotnera-sw-controller-reloaded";
const OPEN_INSTALL_PROMPT_EVENT = "spotnera-open-install-prompt";
const INSTALL_STATUS_EVENT = "spotnera-install-status";
const INSTALL_STATUS_REQUEST_EVENT = "spotnera-install-status-request";
const CONSENT_DIALOG_VISIBILITY_EVENT =
  "spotnera-consent-dialog-visibility";
const AUTO_PROMPT_DELAY_MS = 3500;
const DISMISS_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;
const UPDATE_THROTTLE_MS = 15 * 60 * 1000;
const UPDATE_INTERVAL_MS = 60 * 60 * 1000;

function isStandaloneMode() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

function isIosBrowser() {
  const userAgent = window.navigator.userAgent.toLowerCase();
  const isTouchEnabledIpad =
    window.navigator.platform === "MacIntel" &&
    window.navigator.maxTouchPoints > 1;

  return /iphone|ipad|ipod/.test(userAgent) || isTouchEnabledIpad;
}

function getDismissedAt() {
  try {
    const storedValue = window.localStorage.getItem(DISMISSED_KEY);

    if (!storedValue) {
      return null;
    }

    const dismissedAt = Number(storedValue);

    if (Number.isFinite(dismissedAt)) {
      return dismissedAt;
    }

    if (storedValue === "true") {
      const migratedDismissal = Date.now();
      window.localStorage.setItem(DISMISSED_KEY, String(migratedDismissal));
      return migratedDismissal;
    }
  } catch {
    return Date.now();
  }

  return null;
}

function isAutoPromptOnCooldown() {
  const dismissedAt = getDismissedAt();
  return dismissedAt !== null && Date.now() - dismissedAt < DISMISS_COOLDOWN_MS;
}

function storeDismissal() {
  try {
    window.localStorage.setItem(DISMISSED_KEY, String(Date.now()));
  } catch {
    // A dismissal still applies to the current page through component state.
  }
}

function publishInstallStatus({ available, installed }) {
  window.dispatchEvent(
    new CustomEvent(INSTALL_STATUS_EVENT, {
      detail: { available, installed },
    }),
  );
}

export function PwaInstallAction() {
  const [status, setStatus] = useState({
    available: false,
    installed: false,
  });

  useEffect(() => {
    const handleStatus = (event) => {
      setStatus({
        available: event.detail?.available === true,
        installed: event.detail?.installed === true,
      });
    };
    const initializeStatus = window.setTimeout(() => {
      setStatus((currentStatus) => ({
        ...currentStatus,
        installed: isStandaloneMode(),
      }));
      window.dispatchEvent(new Event(INSTALL_STATUS_REQUEST_EVENT));
    }, 0);

    window.addEventListener(INSTALL_STATUS_EVENT, handleStatus);

    return () => {
      window.clearTimeout(initializeStatus);
      window.removeEventListener(INSTALL_STATUS_EVENT, handleStatus);
    };
  }, []);

  if (status.installed || !status.available) {
    return null;
  }

  const openInstallPrompt = (event) => {
    window.dispatchEvent(
      new CustomEvent(OPEN_INSTALL_PROMPT_EVENT, {
        detail: { trigger: event.currentTarget },
      }),
    );
  };

  return (
    <section className="mt-4 rounded-[24px] border border-white/14 bg-white/10 p-4">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-white/60">
        Spotnera app
      </p>
      <p className="mt-2 text-sm font-semibold leading-6 text-white/68">
        Add Spotnera to your phone or computer for faster access.
      </p>
      <button
        type="button"
        onClick={openInstallPrompt}
        className="spotnera-secondary-action mt-3 inline-flex min-h-11 w-full items-center justify-center px-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#72f0cc] sm:w-auto"
      >
        Install Spotnera
      </button>
    </section>
  );
}

export function PwaInstallPrompt() {
  const [installEvent, setInstallEvent] = useState(null);
  const [isIos, setIsIos] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [hasConsentChoice, setHasConsentChoice] = useState(false);
  const [isConsentDialogVisible, setIsConsentDialogVisible] = useState(true);
  const [isAutoPromptReady, setIsAutoPromptReady] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [installError, setInstallError] = useState(null);
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const returnFocusRef = useRef(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return undefined;
    }

    let registration;
    let updateInProgress = false;
    let lastUpdateCheckAt = 0;
    let hasController = Boolean(navigator.serviceWorker.controller);
    let isReloading = false;
    let isDisposed = false;

    const checkForUpdate = async ({ force = false } = {}) => {
      if (isDisposed || !registration?.active || updateInProgress) {
        return;
      }

      const now = Date.now();

      if (!force && now - lastUpdateCheckAt < UPDATE_THROTTLE_MS) {
        return;
      }

      updateInProgress = true;
      lastUpdateCheckAt = now;

      try {
        await registration.update();
      } catch (error) {
        console.error("Spotnera service worker update check failed", error);
      } finally {
        updateInProgress = false;
      }
    };

    const registerServiceWorker = async () => {
      try {
        const nextRegistration = await navigator.serviceWorker.register("/sw.js", {
          updateViaCache: "none",
        });

        if (isDisposed) {
          return;
        }

        registration = nextRegistration;
        await checkForUpdate({ force: true });
      } catch (error) {
        if (isDisposed) {
          return;
        }

        console.error("Spotnera service worker registration failed", error);
      }
    };

    const reserveControllerReload = () => {
      try {
        if (window.sessionStorage.getItem(CONTROLLER_RELOAD_KEY) === "true") {
          return false;
        }

        window.sessionStorage.setItem(CONTROLLER_RELOAD_KEY, "true");
        return true;
      } catch {
        return false;
      }
    };

    const handleControllerChange = () => {
      if (!hasController) {
        hasController = true;
        return;
      }

      if (isReloading || !reserveControllerReload()) {
        return;
      }

      isReloading = true;
      window.location.reload();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void checkForUpdate();
      }
    };

    const handleOnline = () => void checkForUpdate();
    const updateInterval = window.setInterval(
      () => void checkForUpdate(),
      UPDATE_INTERVAL_MS,
    );

    navigator.serviceWorker.addEventListener(
      "controllerchange",
      handleControllerChange,
    );
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("online", handleOnline);

    if (document.readyState === "complete") {
      void registerServiceWorker();
    } else {
      window.addEventListener("load", registerServiceWorker);
    }

    return () => {
      isDisposed = true;
      window.removeEventListener("load", registerServiceWorker);
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        handleControllerChange,
      );
      window.clearInterval(updateInterval);
    };
  }, []);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setInstallEvent(event);
    };
    const handleAppInstalled = () => {
      setInstallEvent(null);
      setIsInstalled(true);
      setIsOpen(false);
    };
    const handleConsentChange = () => setHasConsentChoice(true);
    const handleConsentDialogVisibility = (event) => {
      const isVisible = event.detail?.visible === true;
      setIsConsentDialogVisible(isVisible);

      if (isVisible) {
        setIsOpen(false);
      }
    };
    const initializeInstallState = window.setTimeout(() => {
      const storedConsent = Boolean(getStoredConsent());
      setIsIos(isIosBrowser());
      setIsInstalled(isStandaloneMode());
      setHasConsentChoice(storedConsent);
      setIsConsentDialogVisible(!storedConsent);
    }, 0);

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    window.addEventListener("spotnera-consent-change", handleConsentChange);
    window.addEventListener(
      CONSENT_DIALOG_VISIBILITY_EVENT,
      handleConsentDialogVisibility,
    );

    return () => {
      window.clearTimeout(initializeInstallState);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      window.removeEventListener("spotnera-consent-change", handleConsentChange);
      window.removeEventListener(
        CONSENT_DIALOG_VISIBILITY_EVENT,
        handleConsentDialogVisibility,
      );
    };
  }, []);

  const installAvailable = Boolean(installEvent) || isIos;

  useEffect(() => {
    const promptDelay = window.setTimeout(
      () =>
        setIsAutoPromptReady(
          hasConsentChoice && !isConsentDialogVisible,
        ),
      hasConsentChoice && !isConsentDialogVisible ? AUTO_PROMPT_DELAY_MS : 0,
    );

    return () => window.clearTimeout(promptDelay);
  }, [hasConsentChoice, isConsentDialogVisible]);

  useEffect(() => {
    const shouldOpenAutomatically =
      isAutoPromptReady &&
      installAvailable &&
      !isInstalled &&
      !isConsentDialogVisible &&
      !isAutoPromptOnCooldown();

    if (!shouldOpenAutomatically) {
      return undefined;
    }

    const openPrompt = window.setTimeout(() => setIsOpen(true), 0);

    return () => window.clearTimeout(openPrompt);
  }, [
    installAvailable,
    isAutoPromptReady,
    isConsentDialogVisible,
    isInstalled,
  ]);

  useEffect(() => {
    const status = {
      available: installAvailable,
      installed: isInstalled,
    };
    const handleStatusRequest = () => publishInstallStatus(status);
    const handleManualOpen = (event) => {
      if (
        !status.available ||
        status.installed ||
        isConsentDialogVisible ||
        !hasConsentChoice
      ) {
        return;
      }

      returnFocusRef.current = event.detail?.trigger ?? null;
      setInstallError(null);
      setIsOpen(true);
    };

    publishInstallStatus(status);
    window.addEventListener(INSTALL_STATUS_REQUEST_EVENT, handleStatusRequest);
    window.addEventListener(OPEN_INSTALL_PROMPT_EVENT, handleManualOpen);

    return () => {
      window.removeEventListener(INSTALL_STATUS_REQUEST_EVENT, handleStatusRequest);
      window.removeEventListener(OPEN_INSTALL_PROMPT_EVENT, handleManualOpen);
    };
  }, [
    hasConsentChoice,
    installAvailable,
    isConsentDialogVisible,
    isInstalled,
  ]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        storeDismissal();
        setIsOpen(false);
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusableElements = dialogRef.current?.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );

      if (!focusableElements?.length) {
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      returnFocusRef.current?.focus?.();
      returnFocusRef.current = null;
    };
  }, [isOpen]);

  const handleInstall = async () => {
    if (!installEvent) {
      return;
    }

    setIsInstalling(true);
    setInstallError(null);

    try {
      await installEvent.prompt();
      const choice = await installEvent.userChoice;
      setInstallEvent(null);
      setIsOpen(false);

      if (choice.outcome !== "accepted") {
        storeDismissal();
      }
    } catch (error) {
      console.error("Spotnera installation prompt failed", error);
      setInstallError(
        "Spotnera could not open the installation prompt. Try your browser's install option instead.",
      );
    } finally {
      setIsInstalling(false);
    }
  };

  const dismissPrompt = () => {
    storeDismissal();
    setIsOpen(false);
  };

  if (!isOpen || isInstalled || !installAvailable) {
    return null;
  }

  const showIosInstructions = isIos && !installEvent;

  return (
    <div
      className="spotnera-dialog-backdrop fixed inset-0 z-[95] flex items-end px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-16 sm:items-center sm:justify-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          dismissPrompt();
        }
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="spotnera-install-title"
        aria-describedby="spotnera-install-description"
        className="w-full max-w-md rounded-t-[30px] border border-white/14 bg-[#151821] p-5 text-white shadow-[0_30px_90px_rgba(0,0,0,0.58)] sm:rounded-[30px] sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <div
              aria-hidden="true"
              className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#33d6a6] text-xl font-black text-[#07130f] shadow-[0_12px_30px_rgba(51,214,166,0.2)]"
            >
              S
            </div>
            <div className="min-w-0">
              <p className="spotnera-kicker text-[#72f0cc]">Install app</p>
              <h2
                id="spotnera-install-title"
                className="mt-1 text-2xl font-semibold tracking-tight"
              >
                Spotnera on your phone
              </h2>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={dismissPrompt}
            aria-label="Close installation prompt"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/14 bg-white/10 text-xl font-semibold text-white transition hover:bg-white/16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#72f0cc]"
          >
            {"\u00d7"}
          </button>
        </div>

        <p
          id="spotnera-install-description"
          className="mt-4 text-sm font-semibold leading-6 text-white/70"
        >
          Install Spotnera for faster access to nearby businesses and deals.
        </p>

        {showIosInstructions ? (
          <div className="mt-4 rounded-[22px] border border-white/12 bg-white/8 p-4">
            <p className="text-sm font-bold text-white">Add to your Home Screen</p>
            <ol className="mt-2 grid gap-2 text-sm leading-6 text-white/68">
              <li>1. Open the Share menu in your browser.</li>
              <li>2. Choose Add to Home Screen.</li>
              <li>3. Confirm by tapping Add.</li>
            </ol>
          </div>
        ) : null}

        {installError ? (
          <p
            className="mt-4 rounded-2xl border border-red-300/24 bg-red-500/12 px-3 py-2 text-sm font-semibold text-red-100"
            role="alert"
          >
            {installError}
          </p>
        ) : null}

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          {installEvent ? (
            <button
              type="button"
              onClick={handleInstall}
              disabled={isInstalling}
              className="spotnera-brand-action min-h-12 rounded-2xl px-4 text-sm font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#72f0cc] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isInstalling ? "Opening installer..." : "Install Spotnera"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={dismissPrompt}
            className={`min-h-12 rounded-2xl border border-white/16 bg-white/10 px-4 text-sm font-black text-white transition hover:bg-white/16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#72f0cc] ${showIosInstructions ? "sm:col-span-2" : ""}`}
          >
            Maybe later
          </button>
        </div>
      </section>
    </div>
  );
}
