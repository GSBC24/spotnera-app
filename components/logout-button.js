"use client";

import { useState } from "react";
import { trackEvent } from "@/lib/analytics";
import { createClient } from "@/utils/supabase/browser";

export function LogoutButton({
  children = "Log out",
  className,
  errorClassName = "text-xs font-semibold text-red-600",
  loadingChildren = "Logging out...",
  onError,
  redirectTo = "/",
}) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const supabase = createClient();

  async function handleLogout() {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);
    setErrorMessage(null);
    trackEvent("logout");

    const { error } = await supabase.auth.signOut();

    if (error) {
      const message = "Unable to log out. Try again.";
      console.error("Logout failed", error);
      if (onError) {
        onError(message);
      } else {
        setErrorMessage(message);
      }
      setIsLoggingOut(false);
      return;
    }

    window.location.assign(redirectTo);
  }

  return (
    <>
      <button
        type="button"
        onClick={handleLogout}
        disabled={isLoggingOut}
        aria-busy={isLoggingOut}
        className={className}
      >
        {isLoggingOut ? loadingChildren : children}
      </button>
      {errorMessage ? <p className={errorClassName}>{errorMessage}</p> : null}
    </>
  );
}
