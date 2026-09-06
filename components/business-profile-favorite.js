"use client";

import Link from "next/link";
import { useState } from "react";
import { recordBusinessEvent } from "@/lib/business-events";
import { trackEvent } from "@/lib/analytics";
import { createClient } from "@/utils/supabase/browser";

export function BusinessProfileFavorite({
  businessId,
  businessCategory,
  city,
  country,
  initialIsFavorite = false,
  isAuthenticated = false,
}) {
  const [isFavorite, setIsFavorite] = useState(initialIsFavorite);
  const [isPending, setIsPending] = useState(false);
  const [message, setMessage] = useState(null);
  const supabase = createClient();

  async function toggleFavorite() {
    if (!isAuthenticated || isPending) {
      return;
    }

    setIsPending(true);
    setMessage(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage("Sign in to save this business.");
      setIsPending(false);
      return;
    }

    const nextFavoriteState = !isFavorite;
    setIsFavorite(nextFavoriteState);

    const { error } = nextFavoriteState
      ? await supabase.from("favorites").insert({
          business_id: businessId,
          user_id: user.id,
        })
      : await supabase
          .from("favorites")
          .delete()
          .eq("business_id", businessId)
          .eq("user_id", user.id);

    if (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Favorite update failed", error);
      }
      setIsFavorite(!nextFavoriteState);
      setMessage("Unable to update saved businesses.");
    } else {
      const eventType = nextFavoriteState ? "favorite_add" : "favorite_remove";
      trackEvent(eventType, {
        business_id: businessId,
        business_category: businessCategory,
        city,
        country,
      });
      recordBusinessEvent({
        businessId,
        eventType,
      });
    }

    setIsPending(false);
  }

  if (!isAuthenticated) {
    return (
      <Link
        href={`/?auth=1&next=${encodeURIComponent(`/business/${businessId}`)}`}
        className="spotnera-secondary-action inline-flex min-h-12 items-center justify-center px-5 text-sm"
      >
        Sign in to save
      </Link>
    );
  }

  return (
    <div className="grid gap-2">
      <button
        type="button"
        onClick={toggleFavorite}
        disabled={isPending}
        aria-pressed={isFavorite}
        className="spotnera-secondary-action inline-flex min-h-12 items-center justify-center px-5 text-sm disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Saving..." : isFavorite ? "Saved" : "Save"}
      </button>
      {message ? <p className="text-xs font-semibold text-white/64">{message}</p> : null}
    </div>
  );
}
