"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

const REASONS = ["Misleading information", "Spam", "Inappropriate content", "Fake business", "Terms violation", "Other"];

export function AdminAction({ action, targetId, label, confirm = false, reason = false }) {
  const router = useRouter();
  const submissionLock = useRef(false);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event) {
    event.preventDefault();
    if (submissionLock.current) return;
    submissionLock.current = true;
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/admin/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, targetId, reason: reason ? form.get("reason") : null,
          note: form.get("note") || null }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save the action.");
      setMessage(result.changed ? `${label} saved.` : "Already up to date.");
      setOpen(false);
      router.refresh();
    } catch (caught) {
      setError(caught.message || "Could not save the action.");
    } finally {
      submissionLock.current = false;
      setPending(false);
    }
  }

  return <div className="text-sm">
    <button type="button" disabled={pending} onClick={() => { setOpen(true); setMessage(""); }}
      className="rounded-xl border border-white/20 px-3 py-2 font-semibold text-white hover:border-[#72f0cc] disabled:opacity-50">
      {label}
    </button>
    {message ? <p role="status" className="mt-2 text-[#72f0cc]">{message}</p> : null}
    {open ? <div className="mt-3 max-w-md rounded-2xl border border-[#72f0cc]/30 bg-[#17211d] p-4">
      <p className="font-semibold text-white">{confirm ? `Confirm ${label.toLowerCase()}` : label}</p>
      <form onSubmit={submit} className="mt-3 grid gap-3">
        {reason ? <label className="grid gap-1 text-white/75">Reason
          <select name="reason" required defaultValue="" className="rounded-lg bg-[#202b26] p-2 text-white">
            <option value="" disabled>Select a reason</option>
            {REASONS.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label> : null}
        <label className="grid gap-1 text-white/75">Admin note (optional)
          <textarea name="note" maxLength={500} rows={2} className="rounded-lg bg-[#202b26] p-2 text-white" />
        </label>
        {error ? <p role="alert" className="text-red-300">{error}</p> : null}
        <div className="flex gap-2">
          <button type="button" disabled={pending} onClick={() => setOpen(false)} className="rounded-lg border border-white/20 px-3 py-2 text-white">Cancel</button>
          <button type="submit" disabled={pending} className="rounded-lg bg-[#33d6a6] px-3 py-2 font-bold text-[#092019] disabled:opacity-50">{pending ? "Saving…" : label}</button>
        </div>
      </form>
    </div> : null}
  </div>;
}
