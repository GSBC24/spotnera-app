"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { PushNotificationControl } from "@/components/push-notification-control";

const PREFERENCE_GROUPS = [
  {
    title: "Push notifications",
    preferences: [
      {
        name: "saved_business_new_deals",
        label: "New deals",
        description: "Get notified when a business you saved publishes a new deal.",
      },
    ],
  },
  {
    title: "Email",
    preferences: [
      {
        name: "weekly_deals_email",
        label: "Weekly deals summary",
        description: "Receive a weekly summary of deals from businesses you saved.",
      },
      {
        name: "new_deal_email",
        label: "New deal emails",
        description: "Receive an email when a saved business publishes a new deal.",
      },
    ],
  },
];

function PreferenceToggle({ name, label, description, defaultChecked }) {
  const descriptionId = `${name}-description`;

  return (
    <label className="flex min-h-20 cursor-pointer items-center justify-between gap-4 rounded-[20px] border border-white/10 bg-black/20 px-4 py-3 transition hover:border-white/18 hover:bg-black/26">
      <span className="min-w-0">
        <span className="block text-sm font-bold text-white">{label}</span>
        <span id={descriptionId} className="mt-1 block text-xs leading-5 text-white/60">
          {description}
        </span>
      </span>
      <span className="relative shrink-0">
        <input
          type="checkbox"
          role="switch"
          name={name}
          defaultChecked={defaultChecked}
          aria-describedby={descriptionId}
          className="peer sr-only"
        />
        <span
          aria-hidden="true"
          className="block h-7 w-12 rounded-full border border-white/16 bg-white/10 transition peer-checked:border-[#33d6a6]/55 peer-checked:bg-[#33d6a6]/80 peer-focus-visible:ring-2 peer-focus-visible:ring-[#72f0cc] peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[#16191f]"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5"
        />
      </span>
    </label>
  );
}

function TimedPreference({ kind, initialPreferences }) {
  const starting = kind === "starting";
  const name = starting ? "saved_business_deal_starting_soon" :
    "saved_business_deal_ending_soon";
  const minutesName = starting ? "starting_soon_minutes" : "ending_soon_minutes";
  const choices = starting ? [[30, "30 min"], [60, "1 hour"], [120, "2 hours"]] :
    [[30, "30 min"], [60, "1 hour"]];
  const [enabled, setEnabled] = useState(Boolean(initialPreferences[name]));
  const initialMinutes = Number(initialPreferences[minutesName]);
  const [minutes, setMinutes] = useState(choices.some(([value]) => value === initialMinutes)
    ? initialMinutes : starting ? 60 : 30);
  const descriptionId = `${name}-description`;
  return (
    <div className="rounded-[20px] border border-white/10 bg-black/20 px-4 py-3">
      <label className="flex min-h-14 cursor-pointer items-center justify-between gap-4">
        <span className="min-w-0">
          <span className="block text-sm font-bold text-white">{starting ? "Starting soon" : "Ending soon"}</span>
          <span id={descriptionId} className="mt-1 block text-xs leading-5 text-white/60">
            {starting ? "Before a deal at a saved business starts." :
              "Before an available deal at a saved business ends."}
          </span>
        </span>
        <span className="relative shrink-0">
          <input type="checkbox" role="switch" name={name} checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
            aria-describedby={descriptionId} className="peer sr-only" />
          <span aria-hidden="true" className="block h-7 w-12 rounded-full border border-white/16 bg-white/10 transition peer-checked:border-[#33d6a6]/55 peer-checked:bg-[#33d6a6]/80 peer-focus-visible:ring-2 peer-focus-visible:ring-[#72f0cc] peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[#16191f]" />
          <span aria-hidden="true" className="pointer-events-none absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5" />
        </span>
      </label>
      {enabled ? (
        <fieldset className="mt-3 border-t border-white/10 pt-3">
          <legend className="text-xs font-semibold text-white/70">Notify me</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {choices.map(([value, label]) => (
              <label key={value} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-white/14 bg-white/8 px-3 text-sm font-semibold text-white">
                <input type="radio" name={minutesName} value={value}
                  checked={minutes === value} onChange={() => setMinutes(value)}
                  className="h-4 w-4 accent-[#33d6a6]" />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
    </div>
  );
}

export function NotificationPreferences({
  action,
  initialPreferences,
  loadError = false,
}) {
  const [state, formAction, isPending] = useActionState(action, null);
  const submissionLockRef = useRef(false);

  useEffect(() => {
    submissionLockRef.current = false;
  }, [state]);

  function handleSubmit(event) {
    if (submissionLockRef.current) {
      event.preventDefault();
      return;
    }

    if (!event.currentTarget.checkValidity()) {
      return;
    }

    submissionLockRef.current = true;
  }

  return (
    <section className="mt-4 rounded-[24px] border border-white/14 bg-white/10 p-4">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-white/60">
          Notifications
        </p>
        <h2 className="mt-1 text-xl font-semibold">Notification preferences</h2>
        <p className="mt-2 text-sm leading-6 text-white/62">
          Choose future notifications about businesses you explicitly saved. These settings do not enable delivery or request browser permission by themselves.
        </p>
      </div>

      <div className="mt-4">
        <PushNotificationControl />
      </div>

      {loadError ? (
        <p className="mt-3 rounded-2xl border border-amber-300/25 bg-amber-500/14 px-3 py-2 text-sm font-semibold text-amber-50">
          Saved notification settings could not be loaded. The default choices are shown.
        </p>
      ) : null}

      <form action={formAction} onSubmit={handleSubmit} className="mt-4 grid gap-4">
        {PREFERENCE_GROUPS.map((group) => (
          <fieldset key={group.title} className="grid gap-2">
            <legend className="mb-1 text-xs font-bold uppercase tracking-[0.16em] text-white/60">
              {group.title}
            </legend>
            {group.preferences.map((preference) => (
              <PreferenceToggle
                key={preference.name}
                {...preference}
                defaultChecked={Boolean(initialPreferences[preference.name])}
              />
            ))}
            {group.title === "Push notifications" ? (
              <>
                <TimedPreference kind="starting" initialPreferences={initialPreferences} />
                <TimedPreference kind="ending" initialPreferences={initialPreferences} />
              </>
            ) : null}
          </fieldset>
        ))}

        <div aria-live="polite" aria-atomic="true">
          {state?.error ? (
            <p className="rounded-2xl border border-red-300/30 bg-red-500/20 px-3 py-2 text-sm font-semibold text-red-50">
              {state.error}
            </p>
          ) : null}
          {state?.success ? (
            <p className="rounded-2xl border border-emerald-300/20 bg-emerald-500/14 px-3 py-2 text-sm font-semibold text-emerald-100">
              Notification preferences saved.
            </p>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="spotnera-brand-action min-h-11 rounded-2xl px-4 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Saving..." : "Save notification settings"}
        </button>
      </form>
    </section>
  );
}
