"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { getBusinessUrl } from "@/lib/business-url";

export function BusinessQrCode({ business }) {
  const [isOpen, setIsOpen] = useState(false);
  const [copyMessage, setCopyMessage] = useState(null);
  const [qrError, setQrError] = useState(null);
  const canvasRef = useRef(null);
  const closeButtonRef = useRef(null);
  const profileUrl = getBusinessUrl(business);
  const displayUrl = profileUrl.replace(/^https?:\/\//, "");

  useEffect(() => {
    if (!isOpen) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape") setIsOpen(false);
    }

    document.addEventListener("keydown", handleKeyDown);
    closeButtonRef.current?.focus();

    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !canvasRef.current) return;

    setQrError(null);
    QRCode.toCanvas(canvasRef.current, profileUrl, {
      errorCorrectionLevel: "M",
      margin: 4,
      width: 320,
      color: {
        dark: "#101217",
        light: "#ffffff",
      },
    }).catch(() => setQrError("Unable to generate the QR code."));
  }, [isOpen, profileUrl]);

  function openModal(event) {
    event.stopPropagation();
    setCopyMessage(null);
    setQrError(null);
    setIsOpen(true);
  }

  function closeModal(event) {
    event?.stopPropagation();
    setIsOpen(false);
  }

  async function copyProfileLink(event) {
    event.stopPropagation();

    try {
      await navigator.clipboard.writeText(profileUrl);
      setCopyMessage("Link copied");
    } catch {
      setCopyMessage("Unable to copy");
    }
  }

  async function downloadPng(event) {
    event.stopPropagation();

    try {
      const dataUrl = await QRCode.toDataURL(profileUrl, {
        errorCorrectionLevel: "M",
        margin: 4,
        width: 1600,
        color: {
          dark: "#101217",
          light: "#ffffff",
        },
      });
      const downloadLink = document.createElement("a");
      downloadLink.href = dataUrl;
      downloadLink.download = `spotnera-${business.slug || business.id}-qr.png`;
      downloadLink.click();
    } catch {
      setQrError("Unable to download the QR code.");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="spotnera-secondary-action inline-flex min-h-10 items-center justify-center px-4 text-xs"
      >
        QR code
      </button>

      {isOpen ? (
        <div
          className="spotnera-dialog-backdrop fixed inset-0 z-[90] flex items-end px-4 pb-4 pt-16 sm:items-center sm:justify-center"
          onClick={closeModal}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby={`business-qr-title-${business.id}`}
            aria-describedby={`business-qr-description-${business.id}`}
            className="spotnera-dialog-panel max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[30px] p-5 sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="spotnera-kicker text-[#72f0cc]">Business profile</p>
                <h2
                  id={`business-qr-title-${business.id}`}
                  className="mt-2 text-2xl font-semibold text-white"
                >
                  QR code for {business.name}
                </h2>
                <p
                  id={`business-qr-description-${business.id}`}
                  className="mt-2 text-sm leading-6 text-white/68"
                >
                  Scan to view this business on Spotnera.
                </p>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={closeModal}
                aria-label="Close QR code"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/14 bg-white/10 text-xl font-semibold text-white transition hover:bg-white/16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#72f0cc]"
              >
                ×
              </button>
            </div>

            <div className="mx-auto mt-5 grid w-full max-w-[352px] place-items-center rounded-[26px] bg-white p-4 shadow-[0_18px_50px_rgba(0,0,0,0.28)]">
              <canvas
                ref={canvasRef}
                aria-label={`QR code for ${business.name}`}
                className="h-auto w-full max-w-[320px]"
              />
            </div>

            <p className="mt-4 break-all text-center text-sm font-semibold text-white/68">
              {displayUrl}
            </p>
            {qrError ? (
              <p className="mt-3 rounded-2xl border border-red-300/24 bg-red-500/12 px-3 py-2 text-sm font-semibold text-red-100">
                {qrError}
              </p>
            ) : null}
            {copyMessage ? (
              <p className="mt-3 text-center text-xs font-semibold text-white/64" aria-live="polite">
                {copyMessage}
              </p>
            ) : null}

            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={downloadPng}
                disabled={Boolean(qrError)}
                className="spotnera-primary-action inline-flex min-h-12 items-center justify-center px-4 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                Download PNG
              </button>
              <button
                type="button"
                onClick={copyProfileLink}
                className="spotnera-secondary-action inline-flex min-h-12 items-center justify-center px-4 text-sm"
              >
                Copy profile link
              </button>
            </div>
            <button
              type="button"
              onClick={closeModal}
              className="mt-2 inline-flex min-h-12 w-full items-center justify-center rounded-2xl border border-white/16 bg-white/10 px-4 text-sm font-black text-white transition hover:bg-white/16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#72f0cc]"
            >
              Close
            </button>
          </section>
        </div>
      ) : null}
    </>
  );
}
