"use client";

import { useRef, useState } from "react";
import { copySupportText, prepareSupportMessage, SUPPORT_CATEGORIES, SUPPORT_EMAIL } from "@/lib/support-contact.mjs";

export function SupportContact() {
  const formRef = useRef(null);
  const [category, setCategory] = useState("Customer");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [replyEmail, setReplyEmail] = useState("");
  const [feedback, setFeedback] = useState("");
  const prepared = () => prepareSupportMessage({ category, subject, message, replyEmail });

  function openEmail(event) {
    event.preventDefault();
    if (!formRef.current?.reportValidity()) return;
    setFeedback("Your email app should open with a draft. Spotnera has not received a message yet. If nothing opens, copy the address or your message below.");
    window.location.href = prepared().mailto;
  }

  async function copyEmail() {
    const copied = await copySupportText(SUPPORT_EMAIL, navigator.clipboard);
    setFeedback(copied ? "Support email copied." : "Could not copy automatically. Select the address above and copy it.");
  }

  async function copyMessage() {
    if (!formRef.current?.reportValidity()) {
      setFeedback("Complete the subject and message before copying your draft.");
      return;
    }
    const copied = await copySupportText(prepared().copyText, navigator.clipboard);
    setFeedback(copied ? "Message copied. Paste it into your email app and send it to the address above." :
      "Could not copy automatically. Your text is still in the form for you to select and copy.");
  }

  return <section id="contact-support" aria-labelledby="contact-support-title"
    className="spotnera-card mt-8 scroll-mt-5 rounded-[28px] border border-[#72f0cc]/20 p-5 sm:p-7">
    <p className="spotnera-kicker text-[#72f0cc]">Need more help?</p>
    <h2 id="contact-support-title" className="mt-2 text-xl font-semibold">Contact Support</h2>
    <p className="mt-2 text-sm leading-6 text-white/65">Prepare a message for your email app, or use the address directly. Sending remains your choice.</p>
    <p className="mt-3 select-text break-all text-base font-semibold text-[#a7f8de]">{SUPPORT_EMAIL}</p>
    <form ref={formRef} onSubmit={openEmail} className="mt-5 grid gap-4">
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
      <label className="grid gap-1.5 text-sm font-semibold text-white/80">Your email (optional)
        <input type="email" autoComplete="email" maxLength={254} value={replyEmail}
          onChange={(event) => setReplyEmail(event.target.value)}
          className="min-h-11 rounded-2xl border border-white/16 bg-black/25 px-3 text-white outline-none focus-visible:ring-2 focus-visible:ring-[#72f0cc]" />
      </label>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button type="submit" className="spotnera-brand-action min-h-11 rounded-2xl px-4 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#72f0cc]">Open email app</button>
        <button type="button" onClick={copyEmail} className="spotnera-secondary-action min-h-11 rounded-2xl px-4 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#72f0cc]">Copy email</button>
        <button type="button" onClick={copyMessage} className="spotnera-secondary-action min-h-11 rounded-2xl px-4 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#72f0cc]">Copy message</button>
      </div>
      <p role="status" aria-live="polite" className="min-h-5 text-sm text-white/70">{feedback}</p>
    </form>
  </section>;
}
