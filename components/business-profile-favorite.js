"use client";

import Link from "next/link";
import { useState } from "react";
import { recordBusinessEvent } from "@/lib/business-events";
import { trackEvent } from "@/lib/analytics";
import { getBusinessPath } from "@/lib/business-url";
import { createClient } from "@/utils/supabase/browser";

function BookmarkIcon({ saved = false }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0"><path d="M6 3.5h12v17l-6-4-6 4v-17Z" /></svg>;
}

export function BusinessProfileFavorite({
  businessId,
  businessSlug,
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
        href={`/?auth=1&next=${encodeURIComponent(
          getBusinessPath({ id: businessId, slug: businessSlug }),
        )}`}
        className="spotnera-secondary-action inline-flex min-h-12 items-center justify-center gap-2 whitespace-nowrap px-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#72f0cc]"
      >
        <BookmarkIcon />Sign in to save
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
        className={`spotnera-secondary-action inline-flex min-h-12 items-center justify-center gap-2 whitespace-nowrap px-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#72f0cc] disabled:cursor-not-allowed disabled:opacity-60 ${isFavorite ? "border-[#72f0cc]/45 text-[#72f0cc]" : ""}`}
      >
        <BookmarkIcon saved={isFavorite} />{isPending ? "Saving..." : isFavorite ? "Saved" : "Save"}
      </button>
      {message ? <p className="text-xs font-semibold text-white/64">{message}</p> : null}
    </div>
  );
}
