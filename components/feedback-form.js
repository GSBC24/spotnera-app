"use client";

import { useRef, useState } from "react";
import { FEEDBACK_QUESTIONS, submitFeedback } from "@/lib/feedback.mjs";

const inputClass = "min-h-11 rounded-2xl border border-white/16 bg-black/25 px-3 text-white outline-none focus-visible:ring-2 focus-visible:ring-[#72f0cc]";
const textareaClass = "min-h-24 resize-y rounded-2xl border border-white/16 bg-black/25 p-3 text-white outline-none focus-visible:ring-2 focus-visible:ring-[#72f0cc]";

export function FeedbackForm() {
  const formRef = useRef(null);
  const submissionLockRef = useRef(false);
  const [businessName, setBusinessName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [answers, setAnswers] = useState({});
  const [status, setStatus] = useState("idle");

  async function sendFeedback(event) {
    event.preventDefault();
    if (submissionLockRef.current || status === "success" || !formRef.current?.reportValidity()) return;
    submissionLockRef.current = true;
    setStatus("sending");
    const sent = await submitFeedback({ businessName, contactName, email, phone, website, answers });
    if (sent) {
      setStatus("success");
    } else {
      setStatus("error");
      submissionLockRef.current = false;
    }
  }

  if (status === "success") {
    return <section className="spotnera-card mt-5 rounded-[30px] border border-[#72f0cc]/30 p-6 sm:p-9" role="status" aria-live="polite">
      <h2 className="text-2xl font-semibold text-[#a7f8de]">Thank you!</h2>
      <p className="mt-2 text-white/80">Your feedback has been sent successfully.</p>
    </section>;
  }

  return <form ref={formRef} onSubmit={sendFeedback} className="spotnera-card mt-5 grid gap-6 rounded-[30px] border border-white/10 p-6 sm:p-9">
    <div className="absolute -left-[10000px] h-px w-px overflow-hidden" aria-hidden="true">
      <label>Leave this field empty<input type="text" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} /></label>
    </div>
    <fieldset disabled={status === "sending"} className="grid gap-6 disabled:opacity-60">
      <div className="grid gap-4">
        <div><h2 className="text-xl font-semibold">Your business</h2><p className="mt-1 text-sm text-white/60">Only your business name is required here.</p></div>
        <label className="grid gap-1.5 text-sm font-semibold text-white/80">Business name
          <input required maxLength={120} autoComplete="organization" value={businessName} onChange={(event) => setBusinessName(event.target.value)} className={inputClass} />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-semibold text-white/80">Contact name <span className="text-xs font-normal text-white/50">Optional</span>
            <input maxLength={120} autoComplete="name" value={contactName} onChange={(event) => setContactName(event.target.value)} className={inputClass} />
          </label>
          <label className="grid gap-1.5 text-sm font-semibold text-white/80">Email <span className="text-xs font-normal text-white/50">Optional</span>
            <input type="email" maxLength={254} autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className={inputClass} />
          </label>
          <label className="grid gap-1.5 text-sm font-semibold text-white/80">Phone <span className="text-xs font-normal text-white/50">Optional</span>
            <input type="tel" maxLength={40} autoComplete="tel" placeholder="+47 123 45 678" value={phone} onChange={(event) => setPhone(event.target.value)} className={inputClass} />
          </label>
        </div>
      </div>
      <div className="grid gap-5">
        <h2 className="text-xl font-semibold">Your feedback</h2>
        {FEEDBACK_QUESTIONS.map((question, index) =>
          <label key={question.id} className="grid gap-2 text-sm font-semibold text-white/85">
            <span>{index + 1}. {question.label}</span>
            {question.type === "choice" ?
              <select required value={answers[question.id] ?? ""} onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))} className={inputClass}>
                <option value="" disabled>Choose an answer</option>
                {question.options.map((option) => <option key={option} value={option} className="bg-[#151b1a] text-white">{option}</option>)}
              </select> :
              <textarea required maxLength={500} rows={3} value={answers[question.id] ?? ""} onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))} className={textareaClass} />}
          </label>)}
      </div>
      <button type="submit" className="spotnera-brand-action min-h-11 rounded-2xl px-4 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#72f0cc] disabled:cursor-not-allowed disabled:opacity-60">{status === "sending" ? "Submitting..." : "Submit feedback"}</button>
    </fieldset>
    <div role="status" aria-live="polite" aria-atomic="true" className="min-h-5 text-sm">
      {status === "error" ? <p className="text-amber-100">We couldn&apos;t send your feedback. Please try again. Your answers are still here.</p> : null}
    </div>
  </form>;
}
