"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/browser";

export function GoogleLoginButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  async function signInWithGoogle() {
    setIsLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (signInError) {
      setError(signInError.message);
      setIsLoading(false);
    }
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <button
        type="button"
        onClick={signInWithGoogle}
        disabled={isLoading}
        className="inline-flex h-12 w-full items-center justify-center gap-3 rounded-full border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-900 shadow-sm transition hover:-translate-y-0.5 hover:border-zinc-300 hover:bg-zinc-50 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70"
      >
        <span className="flex size-5 items-center justify-center rounded-full bg-white text-base font-bold text-[#4285f4]">
          G
        </span>
        {isLoading ? "Redirecting..." : "Continue with Google"}
      </button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
