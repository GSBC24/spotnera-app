"use client";

import { useState } from "react";
import { copyPremiumEmail, getPremiumMailto } from "@/lib/premium-contact.mjs";

export function PremiumContactActions({ email }) {
  const [copyMessage, setCopyMessage] = useState("");

  async function handleCopy() {
    const copied = await copyPremiumEmail(email, navigator.clipboard);
    setCopyMessage(copied
      ? "Email copied."
      : "Couldn't copy automatically. Select the email above and copy it.");
  }

  return (
    <div className="mt-4">
      <p className="text-sm text-white/65">Email us at</p>
      <p className="mt-1 break-all select-text text-base font-semibold text-amber-200">{email}</p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <a href={getPremiumMailto(email)} className="spotnera-primary-action inline-flex min-h-11 items-center justify-center px-5 text-sm">Contact Spotnera</a>
        <button type="button" onClick={handleCopy} className="spotnera-secondary-action inline-flex min-h-11 items-center justify-center px-5 text-sm">Copy email</button>
      </div>
      <p role="status" aria-live="polite" className="mt-3 min-h-5 text-sm text-white/70">{copyMessage}</p>
    </div>
  );
}
