"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trackEvent } from "@/lib/analytics";

export function DeleteBusinessButton({ businessId, businessName, businessCategory }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const canDelete = confirmation === "DELETE" && !isDeleting;

  async function deleteBusiness() {
    if (!canDelete) {
      setError("Type DELETE to confirm business deletion.");
      return;
    }

    setIsDeleting(true);
    setError("");

    try {
      const response = await fetch("/owner/delete-business", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, confirmation }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Unable to delete this business.");

      trackEvent("business_delete", {
        business_id: businessId,
        business_category: businessCategory,
      });
      router.push("/owner?businessDeleted=1");
      router.refresh();
    } catch (deleteError) {
      setError(deleteError.message || "Unable to delete this business.");
      setIsDeleting(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => { setIsOpen(true); setConfirmation(""); setError(""); }} className="spotnera-secondary-action inline-flex min-h-10 items-center justify-center border-red-200 bg-red-50 px-4 text-xs text-red-700 hover:bg-red-100">
        Delete business
      </button>
      {isOpen ? (
        <div className="fixed inset-0 z-[90] flex items-end bg-black/50 px-4 pb-4 pt-16 sm:items-center sm:justify-center">
          <section role="dialog" aria-modal="true" aria-labelledby="delete-business-title" className="max-h-[86vh] w-full max-w-md overflow-y-auto rounded-[30px] border border-red-200 bg-white p-5 text-zinc-950 shadow-[0_30px_90px_rgba(0,0,0,0.35)]">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-red-600">Permanent deletion</p>
            <h2 id="delete-business-title" className="mt-2 text-2xl font-semibold">Delete &quot;{businessName}&quot;?</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-600">This will permanently remove the business and associated deals, reviews, favorites, analytics, and owned media. This action cannot be undone.</p>
            <label className="mt-4 grid gap-2"><span className="text-sm font-bold">Type DELETE to confirm</span><input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" placeholder="DELETE" className="h-12 rounded-2xl border border-zinc-300 px-3 text-sm font-bold outline-none focus:border-red-500" /></label>
            {error ? <p className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p> : null}
            <div className="mt-4 grid gap-2 sm:grid-cols-2"><button type="button" onClick={() => setIsOpen(false)} disabled={isDeleting} className="min-h-12 rounded-2xl border border-zinc-200 bg-zinc-100 px-4 text-sm font-black text-zinc-800">Cancel</button><button type="button" onClick={deleteBusiness} disabled={!canDelete} className="min-h-12 rounded-2xl bg-red-600 px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50">{isDeleting ? "Deleting..." : "Permanently delete business"}</button></div>
          </section>
        </div>
      ) : null}
    </>
  );
}
