"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { trackEvent } from "@/lib/analytics";
import { getBusinessPath } from "@/lib/business-url";
import { createClient } from "@/utils/supabase/browser";

const STAR_PATH = "M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27z";

function formatRating(rating) {
  if (!rating) return "New";
  return Number.isInteger(rating) ? `${rating}.0` : String(rating);
}

export function BusinessProfileReviews({ business, initialReviews, initialOwnReview, isAuthenticated }) {
  const router = useRouter();
  const submissionLock = useRef(false);
  const [reviews, setReviews] = useState(initialReviews);
  const [ownReview, setOwnReview] = useState(initialOwnReview);
  const [rating, setRating] = useState(initialOwnReview?.rating ?? 5);
  const [comment, setComment] = useState(initialOwnReview?.comment ?? "");
  const [status, setStatus] = useState("idle");
  const average = reviews.length
    ? Math.round(reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / reviews.length * 10) / 10
    : 0;

  async function submitReview(event) {
    event.preventDefault();
    if (submissionLock.current || !Number.isInteger(rating) || rating < 1 || rating > 5 || comment.length > 1000) return;
    submissionLock.current = true;
    setStatus("saving");
    try {
      const supabase = createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("Sign in to review this business.");
      const { data, error } = await supabase.from("reviews").upsert({
        business_id: business.id, user_id: user.id, rating,
        comment: comment.trim() || null, updated_at: new Date().toISOString(),
      }, { onConflict: "business_id,user_id" })
        .select("id, business_id, user_id, rating, comment, created_at, updated_at").single();
      if (error || !data) throw error ?? new Error("Review was not saved.");
      const saved = { id: data.id, rating: data.rating, comment: data.comment,
        created_at: data.created_at };
      setReviews((current) => ownReview
        ? current.map((review) => review.id === ownReview.id ? saved : review)
        : [saved, ...current]);
      setOwnReview(saved);
      setStatus("saved");
      trackEvent("review_submit", {
        business_id: business.id, business_category: business.category,
        city: business.city, country: business.country, rating,
      });
      router.refresh();
    } catch (error) {
      if (process.env.NODE_ENV !== "production") console.error("Review save failed", error);
      setStatus("error");
    } finally {
      submissionLock.current = false;
    }
  }

  return <section id="reviews" className="spotnera-surface scroll-mt-6 rounded-[30px] p-4 sm:p-5">
    <div className="flex items-end justify-between gap-3">
      <div>
        <p className="spotnera-kicker text-white/42">Reviews</p>
        <h2 className="mt-2 text-3xl font-semibold"><span aria-hidden="true" className="text-[#ffd166]">★</span> {formatRating(average)}</h2>
      </div>
      <p className="text-sm font-semibold text-white/56">{reviews.length} {reviews.length === 1 ? "review" : "reviews"}</p>
    </div>
    <div className="mt-4 grid gap-3">
      {reviews.length ? reviews.slice(0, 8).map((review) => <article key={review.id}
        className="rounded-[24px] border border-white/10 bg-white/8 p-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-bold text-white">Customer review</p>
          <span className="rounded-full bg-[#ffd166]/18 px-2.5 py-1 text-xs font-black text-[#ffd166]">{review.rating}.0</span>
        </div>
        {review.comment ? <p className="mt-2 whitespace-pre-line text-sm leading-6 text-white/62">{review.comment}</p>
          : <p className="mt-2 text-sm text-white/42">No comment left.</p>}
      </article>) : <p className="rounded-[24px] border border-white/10 bg-white/8 p-4 text-sm font-semibold text-white/58">No reviews yet.</p>}
    </div>
    <div className="mt-5 border-t border-white/10 pt-5">
      <h3 className="text-lg font-semibold">Write a review</h3>
      {isAuthenticated ? <form onSubmit={submitReview} className="mt-4 grid gap-4">
        <fieldset disabled={status === "saving"} className="grid gap-4 disabled:opacity-60">
          <legend className="text-sm font-semibold text-white/72">Your rating</legend>
          <div className="mt-2 flex gap-1" aria-label="Your rating">
            {[1, 2, 3, 4, 5].map((value) => <button key={value} type="button"
              aria-label={`${value} star rating`} aria-pressed={rating === value}
              onClick={() => setRating(value)}
              className={`grid h-11 w-11 place-items-center rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#72f0cc] ${value <= rating ? "bg-[#ffd166]/18 text-[#ffd166]" : "bg-white/8 text-white/34 hover:text-white/70"}`}>
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6"><path fill="currentColor" d={STAR_PATH} /></svg>
            </button>)}
          </div>
          <label className="grid gap-2 text-sm font-semibold text-white/72">Your review
            <textarea maxLength={1000} rows={4} value={comment} onChange={(event) => setComment(event.target.value)}
              className="min-h-28 w-full resize-y rounded-2xl border border-white/16 bg-black/25 p-3 text-white outline-none focus-visible:ring-2 focus-visible:ring-[#72f0cc]" />
          </label>
          <button type="submit" className="spotnera-brand-action min-h-11 rounded-2xl px-4 text-sm font-bold disabled:opacity-60">
            {status === "saving" ? "Saving..." : ownReview ? "Update review" : "Submit review"}
          </button>
        </fieldset>
        <p role="status" aria-live="polite" className="text-sm text-white/70">
          {status === "saved" ? "Review saved." : status === "error" ? "Unable to save review. Please try again." : ""}
        </p>
      </form> : <Link href={`/?auth=1&next=${encodeURIComponent(`${getBusinessPath(business)}#reviews`)}`}
        className="spotnera-brand-action mt-4 inline-flex min-h-11 items-center rounded-2xl px-4 text-sm font-bold">
        Sign in to write a review
      </Link>}
    </div>
  </section>;
}
