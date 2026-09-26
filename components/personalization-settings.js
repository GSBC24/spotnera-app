"use client";

import { useMemo, useRef, useState } from "react";
import { BUSINESS_CATEGORIES } from "@/lib/business-categories";
import { AGE_RANGES, MAX_INTERESTS, canonicalInterest, validatePersonalization } from "@/lib/personalization.mjs";
import { createClient } from "@/utils/supabase/browser";

export function PersonalizationSettings({ initialInterests, initialAgeRange, userId }) {
  const supabase = useMemo(() => createClient(), []);
  const hasUnrecognizedInterests = initialInterests.some((interest) => !canonicalInterest(interest));
  const [interests, setInterests] = useState(() =>
    [...new Set(initialInterests.map(canonicalInterest).filter(Boolean))].slice(0, MAX_INTERESTS));
  const [ageRange, setAgeRange] = useState(initialAgeRange ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const writeRef = useRef(false);

  function toggleInterest(value) {
    if (writeRef.current) return;
    setSuccess(false);
    setError(null);
    setInterests((current) => current.includes(value)
      ? current.filter((interest) => interest !== value)
      : current.length < MAX_INTERESTS ? [...current, value] : current);
  }

  async function save(event) {
    event.preventDefault();
    if (writeRef.current) return;
    setSuccess(false);
    setError(null);
    const checked = validatePersonalization(interests, ageRange || null);
    if (checked.error) {
      setError(checked.error);
      return;
    }
    writeRef.current = true;
    setPending(true);
    try {
      const { data, error: writeError } = await supabase.from("profiles")
        .update({ interests: checked.interests, age_range: checked.ageRange })
        .eq("id", userId)
        .select("interests, age_range")
        .single();
      if (writeError || !data || data.age_range !== checked.ageRange ||
          JSON.stringify(data.interests) !== JSON.stringify(checked.interests)) {
        setError("Unable to save personalization. Please try again.");
        return;
      }
      setSuccess(true);
    } catch {
      setError("Unable to save personalization. Please try again.");
    } finally {
      writeRef.current = false;
      setPending(false);
    }
  }

  return (
    <section className="mt-4 rounded-[24px] border border-white/14 bg-white/10 p-4" aria-labelledby="personalization-heading">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-white/60">Me</p>
      <h2 id="personalization-heading" className="mt-1 text-xl font-semibold">Personalization</h2>
      <form onSubmit={save} className="mt-4 grid gap-5">
        <fieldset aria-describedby="interests-description">
          <legend className="text-base font-semibold text-white">My Interests</legend>
          <p id="interests-description" className="mt-1 text-sm leading-6 text-white/62">
            Choose up to five business categories to personalize Deals discovery. Interests do not turn on notifications.
          </p>
          <p className="mt-2 text-xs font-semibold text-white/70" aria-live="polite">{interests.length} of {MAX_INTERESTS} selected</p>
          {hasUnrecognizedInterests ? <p className="mt-2 text-xs text-amber-100">
            Some previously saved interests are no longer available. Saving will replace them with your current selection.
          </p> : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {BUSINESS_CATEGORIES.map(({ value, label }) => {
              const selected = interests.includes(value);
              return <button key={value} type="button" aria-pressed={selected}
                disabled={pending || (!selected && interests.length >= MAX_INTERESTS)}
                onClick={() => toggleInterest(value)}
                className={`min-h-11 rounded-2xl border px-3 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#72f0cc] disabled:cursor-not-allowed disabled:opacity-45 ${selected ? "border-[#72f0cc] bg-[#33d6a6]/20 text-[#a7f8de]" : "border-white/14 bg-black/20 text-white/78 hover:bg-white/12"}`}>
                {label}
              </button>;
            })}
          </div>
        </fieldset>
        <label className="grid gap-1.5">
          <span className="text-base font-semibold text-white">Age Range</span>
          <span className="text-sm leading-6 text-white/62">Optional. This is your choice and is separate from date of birth.</span>
          <select value={ageRange} disabled={pending} onChange={(event) => { setAgeRange(event.target.value); setSuccess(false); setError(null); }}
            className="min-h-11 rounded-2xl border border-white/14 bg-[#20242b] px-3 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#72f0cc]">
            <option value="">Prefer not to say</option>
            {AGE_RANGES.map((range) => <option key={range} value={range}>{range}</option>)}
          </select>
        </label>
        <div role="status" aria-live="polite">
          {error ? <p className="rounded-2xl border border-red-300/30 bg-red-500/20 px-3 py-2 text-sm font-semibold text-red-50">{error}</p> : null}
          {success ? <p className="rounded-2xl border border-emerald-300/20 bg-emerald-500/14 px-3 py-2 text-sm font-semibold text-emerald-100">Personalization saved.</p> : null}
        </div>
        <button type="submit" disabled={pending}
          className="spotnera-brand-action min-h-11 rounded-2xl px-4 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60">
          {pending ? "Saving..." : "Save personalization"}
        </button>
      </form>
    </section>
  );
}
