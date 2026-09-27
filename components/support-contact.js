"use client";

import { useRef, useState } from "react";
import { copySupportText, submitSupportForm, SUPPORT_CATEGORIES, SUPPORT_EMAIL } from "@/lib/support-contact.mjs";

export function SupportContact() {
  const formRef = useRef(null);
  const submissionLockRef = useRef(false);
  const [category, setCategory] = useState("Customer");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState("idle");
  const [copyFeedback, setCopyFeedback] = useState("");

  async function sendMessage(event) {
    event.preventDefault();
    if (submissionLockRef.current || status === "success" || !formRef.current?.reportValidity()) return;
    submissionLockRef.current = true;
    setStatus("sending");
    const sent = await submitSupportForm({ category, subject, message, email, website });
    if (sent) {
      setStatus("success");
      setSubject("");
      setMessage("");
    } else {
      setStatus("error");
      submissionLockRef.current = false;
    }
  }

  async function copyEmail() {
    const copied = await copySupportText(SUPPORT_EMAIL, navigator.clipboard);
    setCopyFeedback(copied ? "Support email copied." : "Could not copy automatically. Select the address above and copy it.");
  }

  return <section id="contact-support" aria-labelledby="contact-support-title"
    className="spotnera-card mt-8 scroll-mt-5 rounded-[28px] border border-[#72f0cc]/20 p-5 sm:p-7">
    <p className="spotnera-kicker text-[#72f0cc]">Need more help?</p>
    <h2 id="contact-support-title" className="mt-2 text-xl font-semibold">Contact Support</h2>
    <p className="mt-2 text-sm leading-6 text-white/65">Send us a message and we&apos;ll reply by email. You can also use the address below directly.</p>
    <p className="mt-3 select-text break-all text-base font-semibold text-[#a7f8de]">{SUPPORT_EMAIL}</p>
    <form ref={formRef} onSubmit={sendMessage} className="mt-5 grid gap-4">
      <div className="absolute -left-[10000px] h-px w-px overflow-hidden" aria-hidden="true">
        <label>Leave this field empty<input type="text" name="website" tabIndex={-1} autoComplete="off"
          value={website} onChange={(event) => setWebsite(event.target.value)} /></label>
      </div>
      <fieldset disabled={status === "sending" || status === "success"} className="grid gap-4 disabled:opacity-60">
      <label className="grid gap-1.5 text-sm font-semibold text-white/80">Topic
        <select value={category} onChange={(event) => setCategory(event.target.value)}
          className="min-h-11 rounded-2xl border border-white/16 bg-[#20242b] px-3 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#72f0cc]">
          {SUPPORT_CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </label>
      <label className="grid gap-1.5 text-sm font-semibold text-white/80">Subject
        <input required maxLength={140} value={subject} onChange={(event) => setSubject(event.target.value)}
          className="min-h-11 rounded-2xl border border-white/16 bg-black/25 px-3 text-white outline-none focus-visible:ring-2 focus-visible:ring-[#72f0cc]" />
      </label>
      <label className="grid gap-1.5 text-sm font-semibold text-white/80">Message
        <textarea required maxLength={2000} rows={5} value={message} onChange={(event) => setMessage(event.target.value)}
          className="min-h-32 resize-y rounded-2xl border border-white/16 bg-black/25 p-3 text-white outline-none focus-visible:ring-2 focus-visible:ring-[#72f0cc]" />
      </label>
      <label className="grid gap-1.5 text-sm font-semibold text-white/80">Your email
        <input type="email" required autoComplete="email" maxLength={254} value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="min-h-11 rounded-2xl border border-white/16 bg-black/25 px-3 text-white outline-none focus-visible:ring-2 focus-visible:ring-[#72f0cc]" />
      </label>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button type="submit" className="spotnera-brand-action min-h-11 rounded-2xl px-4 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#72f0cc] disabled:cursor-not-allowed disabled:opacity-60">{status === "sending" ? "Sending..." : "Send message"}</button>
      </div>
      </fieldset>
      <div role="status" aria-live="polite" aria-atomic="true" className="min-h-5 text-sm">
        {status === "sending" ? <p className="text-white/70">Sending your message...</p> : null}
        {status === "success" ? <p className="font-semibold text-[#a7f8de]">Message sent. Thanks for contacting Spotnera. We&apos;ll get back to you as soon as possible.</p> : null}
        {status === "error" ? <p className="text-amber-100">We couldn&apos;t send your message. Please try again or email {SUPPORT_EMAIL} directly.</p> : null}
      </div>
    </form>
    <button type="button" onClick={copyEmail} className="spotnera-secondary-action mt-3 min-h-11 rounded-2xl px-4 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#72f0cc]">Copy email</button>
    <p role="status" aria-live="polite" className="mt-2 min-h-5 text-sm text-white/70">{copyFeedback}</p>
  </section>;
}
