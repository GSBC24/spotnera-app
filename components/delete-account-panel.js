"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/browser";

export function DeleteAccountPanel({ ownedBusinessCount = 0 }) {
  const [isOpen, setIsOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");
  const supabase = useMemo(() => createClient(), []);
  const canDelete = confirmation === "DELETE" && !isDeleting;
  const isOwner = ownedBusinessCount > 0;

  async function deleteAccount() {
    if (!canDelete) {
      setError("Type DELETE to confirm account deletion.");
      return;
    }

    setIsDeleting(true);
    setError("");

    try {
      const response = await fetch("/account/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ confirmation }),
      });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(body.error || "Account deletion failed.");
      }

      await supabase.auth.signOut();
      window.location.assign("/?accountDeleted=1");
    } catch (deleteError) {
      setError(deleteError.message || "Account deletion failed.");
      setIsDeleting(false);
    }
  }

  return (
    <section className="mt-4 rounded-[28px] border border-red-400/24 bg-red-500/10 p-4">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-red-200">
        Danger zone
      </p>
      <h2 className="mt-2 text-lg font-semibold text-white">Delete account</h2>
      <p className="mt-2 text-sm leading-6 text-white/62">
        Permanently delete your Spotnera account and associated personal data.
      </p>
      <button
        type="button"
        onClick={() => {
          setIsOpen(true);
          setError("");
          setConfirmation("");
        }}
        className="mt-3 min-h-11 rounded-2xl border border-red-300/28 bg-red-500/18 px-4 text-sm font-black text-red-100 transition hover:bg-red-500/26"
      >
        Delete account
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-[90] flex items-end bg-black/62 px-4 pb-4 pt-16 backdrop-blur-sm sm:items-center sm:justify-center">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-account-title"
            className="max-h-[86vh] w-full max-w-md overflow-y-auto rounded-[30px] border border-red-300/24 bg-[#151821] p-4 text-white shadow-[0_30px_90px_rgba(0,0,0,0.54)] sm:p-5"
          >
            <p className="text-xs font-black uppercase tracking-[0.18em] text-red-200">
              Permanent deletion
            </p>
            <h3 id="delete-account-title" className="mt-2 text-2xl font-semibold">
              Delete your Spotnera account?
            </h3>
            <p className="mt-3 text-sm leading-6 text-white/68">
              This action cannot be undone. Your account profile, favorites, and reviews written by you will be permanently deleted.
            </p>

            {isOwner ? (
              <div className="mt-4 rounded-2xl border border-red-300/24 bg-red-500/12 p-3">
                <p className="text-sm font-bold text-red-100">
                  You currently own {ownedBusinessCount} {ownedBusinessCount === 1 ? "business" : "businesses"}.
                </p>
                <p className="mt-2 text-sm leading-6 text-white/64">
                  Deleting your account will permanently remove those business listings, deals, reviews and favorites about those businesses, business analytics for those businesses, and referenced logos/covers owned by your account.
                </p>
              </div>
            ) : null}

            <label className="mt-4 grid gap-2">
              <span className="text-sm font-bold text-white">
                Type DELETE to confirm
              </span>
              <input
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                autoComplete="off"
                className="h-12 rounded-2xl border border-white/12 bg-white/10 px-3 text-sm font-bold text-white outline-none placeholder:text-white/34 focus:border-red-200/50"
                placeholder="DELETE"
              />
            </label>

            {error ? (
              <p className="mt-3 rounded-2xl border border-red-300/24 bg-red-500/12 px-3 py-2 text-sm font-semibold text-red-100">
                {error}
              </p>
            ) : null}

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                disabled={isDeleting}
                className="min-h-12 rounded-2xl border border-white/12 bg-white/10 px-4 text-sm font-black text-white transition hover:bg-white/16 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={deleteAccount}
                disabled={!canDelete}
                className="min-h-12 rounded-2xl bg-red-500 px-4 text-sm font-black text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isDeleting ? "Deleting..." : "Permanently delete account"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
