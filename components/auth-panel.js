"use client";

import Link from "next/link";
import { useState } from "react";
import { trackEvent } from "@/lib/analytics";
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

function getSafeRedirectPath(value) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//")
    ? value
    : "/";
}

export function AuthPanel({ successRedirect = "/" } = {}) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState(null);
  const supabase = createClient();
  const safeSuccessRedirect = getSafeRedirectPath(successRedirect);

  async function signInWithProvider(provider) {
    setError(null);
    setMessage(null);
    setLoadingProvider(provider);

    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeSuccessRedirect)}`,
      },
    });

    if (signInError) {
      if (process.env.NODE_ENV !== "production") {
        console.error(`${provider} sign-in failed`, signInError);
      }
      setError(getFriendlyAuthError(signInError));
      setLoadingProvider(null);
    } else {
      trackEvent("login", { auth_method: provider });
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
      if (process.env.NODE_ENV !== "production") {
        console.error("Email authentication failed", authError);
      }
      setError(getFriendlyAuthError(authError));
      setIsSubmitting(false);
      return;
    }

    if (mode === "signup" && !data.session) {
      trackEvent("sign_up", { auth_method: "email" });
      setMessage("Check your email to verify your Spotnera account.");
      setIsSubmitting(false);
      return;
    }

    trackEvent(mode === "signup" ? "sign_up" : "login", {
      auth_method: "email",
    });
        window.location.assign(safeSuccessRedirect);
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
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/reset-password")}`,
      },
    );

    if (resetError) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Password reset failed", resetError);
      }
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
            className="spotnera-secondary-action inline-flex w-full items-center justify-center gap-3 px-4 text-sm disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <span className="flex min-w-5 items-center justify-center rounded-full text-sm font-black">
              {button.mark}
            </span>
            {loadingProvider === button.provider ? "Redirecting..." : button.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3 text-xs font-bold uppercase text-zinc-400">
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
          className="spotnera-input w-full text-sm font-medium"
        />
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Password"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          className="spotnera-input w-full text-sm font-medium"
        />
        {mode === "signup" ? (
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Confirm password"
            autoComplete="new-password"
            className="spotnera-input w-full text-sm font-medium"
          />
        ) : null}
        <button
          type="submit"
          disabled={isSubmitting || Boolean(loadingProvider)}
          className="spotnera-primary-action w-full px-4 text-sm disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? "Please wait..." : mode === "signup" ? "Sign up" : "Log in"}
        </button>
        {mode === "signup" ? (
          <p className="text-xs leading-5 text-zinc-500">
            By creating an account, you agree to the{" "}
            <Link href="/terms" className="font-bold text-zinc-700 underline-offset-4 hover:underline">
              Terms
            </Link>{" "}
            and can read how Spotnera handles data in the{" "}
            <Link href="/privacy" className="font-bold text-zinc-700 underline-offset-4 hover:underline">
              Privacy Policy
            </Link>
            . Analytics consent is optional and managed separately.
          </p>
        ) : (
          <p className="text-xs leading-5 text-zinc-500">
            Read Spotnera&apos;s{" "}
            <Link href="/privacy" className="font-bold text-zinc-700 underline-offset-4 hover:underline">
              Privacy Policy
            </Link>{" "}
            and{" "}
            <Link href="/terms" className="font-bold text-zinc-700 underline-offset-4 hover:underline">
              Terms
            </Link>
            .
          </p>
        )}
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
