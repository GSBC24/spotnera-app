"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/browser";

export function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage(null);
    setError(null);

    if (password.length < 8) {
      setError("Use at least 8 characters for your password.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords must match.");
      return;
    }

    setIsSubmitting(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      console.error("Password update failed", updateError);
      setError("Unable to update your password. Open the latest reset link and try again.");
      setIsSubmitting(false);
      return;
    }

    setMessage("Password updated. Redirecting...");
    window.setTimeout(() => window.location.assign("/"), 900);
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3">
      <input
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="New password"
        autoComplete="new-password"
        className="h-12 rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-950 outline-none focus:border-zinc-950 focus:ring-4 focus:ring-zinc-950/10"
      />
      <input
        type="password"
        value={confirmPassword}
        onChange={(event) => setConfirmPassword(event.target.value)}
        placeholder="Confirm password"
        autoComplete="new-password"
        className="h-12 rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-950 outline-none focus:border-zinc-950 focus:ring-4 focus:ring-zinc-950/10"
      />
      <button
        type="submit"
        disabled={isSubmitting}
        className="h-12 rounded-2xl bg-zinc-950 px-4 text-sm font-bold text-white shadow-[0_18px_40px_rgba(24,24,27,0.2)] transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isSubmitting ? "Saving..." : "Save new password"}
      </button>
      {message ? (
        <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </p>
      ) : null}
    </form>
  );
}
