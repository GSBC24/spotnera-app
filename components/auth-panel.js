"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/browser";

function getFriendlyAuthError(error) {
  const message = String(error?.message ?? "").toLowerCase();

  if (message.includes("invalid login credentials")) {
    return "The email or password is incorrect.";
  }

  if (message.includes("already registered") || message.includes("already exists")) {
    return "That email is already registered. Log in instead.";
  }

  if (message.includes("provider") || message.includes("oauth")) {
    return "This sign-in provider is not configured yet.";
  }

  if (message.includes("email")) {
    return "Enter a valid email address.";
  }

  return "Something went wrong. Try again.";
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function AuthPanel() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState(null);
  const supabase = createClient();

  async function signInWithProvider(provider) {
    setError(null);
    setMessage(null);
    setLoadingProvider(provider);

    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (signInError) {
      console.error(`${provider} sign-in failed`, signInError);
      setError(getFriendlyAuthError(signInError));
      setLoadingProvider(null);
    }
  }

  async function handleEmailSubmit(event) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    const trimmedEmail = email.trim();

    if (!isValidEmail(trimmedEmail)) {
      setError("Enter a valid email address.");
      return;
    }

    if (password.length < 8) {
      setError("Use at least 8 characters for your password.");
      return;
    }

    if (mode === "signup" && password !== confirmPassword) {
      setError("Passwords must match.");
      return;
    }

    setIsSubmitting(true);

    const { data, error: authError } =
      mode === "signup"
        ? await supabase.auth.signUp({
            email: trimmedEmail,
            password,
            options: {
              emailRedirectTo: `${window.location.origin}/auth/callback`,
            },
          })
        : await supabase.auth.signInWithPassword({
            email: trimmedEmail,
            password,
          });

    if (authError) {
      console.error("Email authentication failed", authError);
      setError(getFriendlyAuthError(authError));
      setIsSubmitting(false);
      return;
    }

    if (mode === "signup" && !data.session) {
      setMessage("Check your email to verify your Spotnera account.");
      setIsSubmitting(false);
      return;
    }

    window.location.assign("/");
  }

  async function handlePasswordReset() {
    setError(null);
    setMessage(null);
    const trimmedEmail = email.trim();

    if (!isValidEmail(trimmedEmail)) {
      setError("Enter your email address first.");
      return;
    }

    setIsSubmitting(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      trimmedEmail,
      {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      },
    );

    if (resetError) {
      console.error("Password reset failed", resetError);
      setError("Unable to send a password reset email.");
    } else {
      setMessage("Check your email for a Spotnera password reset link.");
    }

    setIsSubmitting(false);
  }

  const providerButtons = [
    { provider: "google", label: "Continue with Google", mark: "G" },
    { provider: "facebook", label: "Continue with Facebook", mark: "f" },
    { provider: "apple", label: "Continue with Apple", mark: "Apple" },
  ];

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="grid gap-3">
        {providerButtons.map((button) => (
          <button
            key={button.provider}
            type="button"
            onClick={() => signInWithProvider(button.provider)}
            disabled={Boolean(loadingProvider) || isSubmitting}
            className="inline-flex h-12 w-full items-center justify-center gap-3 rounded-full border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-900 shadow-sm transition hover:-translate-y-0.5 hover:border-zinc-300 hover:bg-zinc-50 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <span className="flex min-w-5 items-center justify-center rounded-full text-sm font-black">
              {button.mark}
            </span>
            {loadingProvider === button.provider ? "Redirecting..." : button.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-[0.18em] text-zinc-400">
        <span className="h-px flex-1 bg-zinc-200" />
        Email
        <span className="h-px flex-1 bg-zinc-200" />
      </div>

      <form onSubmit={handleEmailSubmit} className="grid gap-3">
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Email"
          autoComplete="email"
          className="h-12 rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-950 outline-none focus:border-zinc-950 focus:ring-4 focus:ring-zinc-950/10"
        />
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Password"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          className="h-12 rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-950 outline-none focus:border-zinc-950 focus:ring-4 focus:ring-zinc-950/10"
        />
        {mode === "signup" ? (
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Confirm password"
            autoComplete="new-password"
            className="h-12 rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-950 outline-none focus:border-zinc-950 focus:ring-4 focus:ring-zinc-950/10"
          />
        ) : null}
        <button
          type="submit"
          disabled={isSubmitting || Boolean(loadingProvider)}
          className="h-12 rounded-2xl bg-zinc-950 px-4 text-sm font-bold text-white shadow-[0_18px_40px_rgba(24,24,27,0.2)] transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? "Please wait..." : mode === "signup" ? "Sign up" : "Log in"}
        </button>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm font-semibold">
        <button
          type="button"
          onClick={() => {
            setMode(mode === "signup" ? "login" : "signup");
            setError(null);
            setMessage(null);
          }}
          className="text-zinc-700 underline-offset-4 hover:underline"
        >
          {mode === "signup"
            ? "Already have an account? Log in"
            : "Don't have an account? Sign up"}
        </button>
        {mode === "login" ? (
          <button
            type="button"
            onClick={handlePasswordReset}
            disabled={isSubmitting}
            className="text-zinc-500 underline-offset-4 hover:text-zinc-800 hover:underline disabled:opacity-60"
          >
            Forgot password?
          </button>
        ) : null}
      </div>

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
    </div>
  );
}
