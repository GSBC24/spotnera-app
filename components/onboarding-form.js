"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { trackEvent } from "@/lib/analytics";

const GENDER_OPTIONS = [
  "Prefer not to say",
  "Woman",
  "Man",
  "Non-binary",
  "Other",
];

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="spotnera-primary-action mt-2 w-full px-5 text-sm disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? "Saving..." : "Start exploring"}
    </button>
  );
}

function Field({ label, optional = false, children }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-xs font-semibold uppercase text-zinc-500">
        {label}
        {optional ? (
          <span className="normal-case tracking-normal text-zinc-400"> optional</span>
        ) : null}
      </span>
      {children}
    </label>
  );
}

function Input(props) {
  return (
    <input
      {...props}
      className="spotnera-input w-full text-base font-medium placeholder:text-zinc-400"
    />
  );
}

function Select(props) {
  return (
    <select
      {...props}
      className="spotnera-input w-full text-base font-semibold"
    />
  );
}

export function OnboardingForm({ action, defaultValues, countries }) {
  const [state, formAction] = useActionState(action, null);

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!event.currentTarget.checkValidity()) {
          return;
        }

        const formData = new FormData(event.currentTarget);
        trackEvent("onboarding_complete", {
          country: String(formData.get("country") ?? "").trim(),
          city: String(formData.get("city") ?? "").trim(),
        });
      }}
      className="flex flex-col gap-5"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name">
          <Input
            name="first_name"
            required
            minLength={1}
            maxLength={80}
            defaultValue={defaultValues?.first_name ?? ""}
            placeholder="First name"
          />
        </Field>
        <Field label="Last name">
          <Input
            name="last_name"
            required
            minLength={1}
            maxLength={80}
            defaultValue={defaultValues?.last_name ?? ""}
            placeholder="Last name"
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Country">
          <Select name="country" required defaultValue={defaultValues?.country ?? ""}>
            <option value="" disabled>
              Choose country
            </option>
            {countries.map((country) => (
              <option key={country} value={country}>
                {country}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="City">
          <Input
            name="city"
            required
            minLength={2}
            maxLength={120}
            defaultValue={defaultValues?.city ?? ""}
            placeholder="Your city"
          />
        </Field>
      </div>

      <Field label="Phone number" optional>
        <Input
          type="tel"
          name="phone"
          maxLength={32}
          defaultValue={defaultValues?.phone ?? ""}
          placeholder="+47 123 45 678"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Date of birth" optional>
          <Input
            type="date"
            name="date_of_birth"
            defaultValue={defaultValues?.date_of_birth ?? ""}
          />
        </Field>
        <Field label="Gender" optional>
          <Select name="gender" defaultValue={defaultValues?.gender ?? "Prefer not to say"}>
            {GENDER_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Street address" optional>
        <Input
          name="address"
          maxLength={240}
          defaultValue={defaultValues?.address ?? ""}
          placeholder="Street address"
        />
      </Field>

      {state?.error ? (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {state.error}
        </p>
      ) : null}

      <SubmitButton />
    </form>
  );
}
