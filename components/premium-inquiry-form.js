"use client";

import { useRef, useState } from "react";
import { submitPremiumInquiry } from "@/lib/premium-contact.mjs";

export function PremiumInquiryForm() {
  const formRef = useRef(null);
  const submissionLockRef = useRef(false);
  const [contactName, setContactName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState("idle");

  async function sendInquiry(event) {
    event.preventDefault();
    if (submissionLockRef.current || status === "success" || !formRef.current?.reportValidity()) return;
    submissionLockRef.current = true;
    setStatus("sending");
    const sent = await submitPremiumInquiry({ contactName, businessName, email,
      phone, message, website });
    if (sent) {
      setStatus("success");
    } else {
      setStatus("error");
      submissionLockRef.current = false;
    }
  }

  const inputClass = "min-h-11 rounded-2xl border border-white/16 bg-black/25 px-3 text-white outline-none focus-visible:ring-2 focus-visible:ring-[#72f0cc]";

  return <form ref={formRef} onSubmit={sendInquiry} className="mt-5 grid gap-4">
    <div className="absolute -left-[10000px] h-px w-px overflow-hidden" aria-hidden="true">
      <label>Leave this field empty<input type="text" name="website" tabIndex={-1}
        autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} /></label>
    </div>
    <fieldset disabled={status === "sending" || status === "success"}
      className="grid gap-4 disabled:opacity-60">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm font-semibold text-white/80">Contact name
          <input required maxLength={120} autoComplete="name" value={contactName}
            onChange={(event) => setContactName(event.target.value)} className={inputClass} />
        </label>
        <label className="grid gap-1.5 text-sm font-semibold text-white/80">Business name
          <input required maxLength={120} autoComplete="organization" value={businessName}
            onChange={(event) => setBusinessName(event.target.value)} className={inputClass} />
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm font-semibold text-white/80">Email
          <input type="email" required maxLength={254} autoComplete="email" value={email}
            onChange={(event) => setEmail(event.target.value)} className={inputClass} />
        </label>
        <label className="grid gap-1.5 text-sm font-semibold text-white/80">Phone number <span className="text-xs font-normal text-white/50">Optional</span>
          <input type="tel" maxLength={40} autoComplete="tel" value={phone}
            onChange={(event) => setPhone(event.target.value)} placeholder="+47 123 45 678"
            className={inputClass} />
        </label>
      </div>
      <label className="grid gap-1.5 text-sm font-semibold text-white/80">Message
        <textarea required maxLength={2000} rows={5} value={message}
          onChange={(event) => setMessage(event.target.value)}
          className="min-h-32 resize-y rounded-2xl border border-white/16 bg-black/25 p-3 text-white outline-none focus-visible:ring-2 focus-visible:ring-[#72f0cc]" />
      </label>
      <button type="submit" className="spotnera-brand-action min-h-11 rounded-2xl px-4 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#72f0cc] disabled:cursor-not-allowed disabled:opacity-60">{status === "sending" ? "Sending..." : "Send Premium inquiry"}</button>
    </fieldset>
    <div role="status" aria-live="polite" aria-atomic="true" className="min-h-5 text-sm">
      {status === "sending" ? <p className="text-white/70">Sending your inquiry...</p> : null}
      {status === "success" ? <p className="font-semibold text-[#a7f8de]">Thanks for your interest in Spotnera Premium. We&apos;ll get back to you soon.</p> : null}
      {status === "error" ? <p className="text-amber-100">We couldn&apos;t send your inquiry. Please try again or email support@spotnera.com directly.</p> : null}
    </div>
  </form>;
}
