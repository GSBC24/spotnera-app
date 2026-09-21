"use client";

import { useActionState, useEffect, useRef } from "react";
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
      {
        name: "saved_business_deal_starting_soon",
        label: "Deals starting soon",
        description: "Get notified when a deal from a saved business is about to start.",
      },
      {
        name: "saved_business_deal_ending_soon",
        label: "Deals ending soon",
        description: "Get notified before a deal from a saved business ends.",
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
