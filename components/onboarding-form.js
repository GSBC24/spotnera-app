"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

const INTERESTS = [
  "Live music",
  "Food",
  "Nightlife",
  "Art",
  "Outdoors",
  "Wellness",
  "Sports",
  "Tech",
  "Travel",
  "Family",
];

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 h-13 w-full rounded-full bg-zinc-950 px-5 text-sm font-semibold text-white shadow-[0_18px_45px_rgba(24,24,27,0.28)] transition hover:-translate-y-0.5 hover:bg-zinc-800 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? "Saving..." : "Start exploring"}
    </button>
  );
}

export function OnboardingForm({ action, defaultValues }) {
  const [state, formAction] = useActionState(action, null);
  const [selected, setSelected] = useState(defaultValues?.interests ?? []);

  const selectedCount = selected.length;
  const helperText = useMemo(() => {
    if (selectedCount === 0) return "Choose at least three";
    if (selectedCount < 3) return `${3 - selectedCount} more to go`;
    return `${selectedCount} selected`;
  }, [selectedCount]);

  function toggleInterest(interest) {
    setSelected((current) =>
      current.includes(interest)
        ? current.filter((item) => item !== interest)
        : [...current, interest],
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <label className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
          Username
        </span>
        <input
          name="username"
          required
          minLength={3}
          maxLength={24}
          defaultValue={defaultValues?.username ?? ""}
          placeholder="yourname"
          className="h-13 rounded-2xl border border-zinc-200 bg-white/85 px-4 text-base font-medium text-zinc-950 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-zinc-950 focus:ring-4 focus:ring-zinc-950/10"
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
          City
        </span>
        <input
          name="city"
          required
          maxLength={80}
          defaultValue={defaultValues?.city ?? ""}
          placeholder="Your city"
          className="h-13 rounded-2xl border border-zinc-200 bg-white/85 px-4 text-base font-medium text-zinc-950 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-zinc-950 focus:ring-4 focus:ring-zinc-950/10"
        />
      </label>

      <fieldset className="flex flex-col gap-3">
        <div className="flex items-end justify-between gap-3">
          <legend className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
            Interests
          </legend>
          <p className="text-xs font-medium text-zinc-500">{helperText}</p>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {INTERESTS.map((interest) => {
            const isActive = selected.includes(interest);

            return (
              <label
                key={interest}
                className={`flex h-12 cursor-pointer items-center justify-center rounded-full border px-3 text-center text-sm font-semibold shadow-sm transition ${
                  isActive
                    ? "border-zinc-950 bg-zinc-950 text-white shadow-zinc-950/20"
                    : "border-zinc-200 bg-white/80 text-zinc-700 hover:border-zinc-400"
                }`}
              >
                <input
                  type="checkbox"
                  name="interests"
                  value={interest}
                  checked={isActive}
                  onChange={() => toggleInterest(interest)}
                  className="sr-only"
                />
                {interest}
              </label>
            );
          })}
        </div>
      </fieldset>

      {state?.error ? (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {state.error}
        </p>
      ) : null}

      <SubmitButton />
    </form>
  );
}
