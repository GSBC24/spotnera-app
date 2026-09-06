"use client";

import { useCallback, useMemo, useState } from "react";
import { DeleteAccountPanel } from "@/components/delete-account-panel";
import { LogoutButton } from "@/components/logout-button";
import { PrivacySettingsLink } from "@/components/privacy-settings-link";
import { createClient } from "@/utils/supabase/browser";

const PROFILE_COUNTRIES = [
  "Norway", "Sweden", "Denmark", "Finland", "Iceland", "United Kingdom",
  "Ireland", "Germany", "France", "Spain", "Italy", "Netherlands", "Belgium",
  "Switzerland", "Austria", "Poland", "Portugal", "Greece", "United States",
  "Canada", "Australia", "New Zealand", "Japan", "South Korea", "Singapore",
  "India", "Brazil", "Mexico", "South Africa", "Other",
];

const GENDER_OPTIONS = [
  "Prefer not to say",
  "Woman",
  "Man",
  "Non-binary",
  "Other",
];

function normalizeProfilePhone(value) {
  const phone = String(value ?? "").trim();
  if (!phone) return { value: null };
  if (!/^[+\d][\d\s().-]{5,31}$/.test(phone)) {
    return { error: "Enter a valid phone number." };
  }
  return { value: phone };
}

export function ProfileAccountView({ profile, userId, ownedBusinessCount = 0 }) {
  const supabase = useMemo(() => createClient(), []);
  const [localProfile, setLocalProfile] = useState(() => profile ?? {});
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  const handleSaveProfile = useCallback(async (event) => {
    event.preventDefault();
    setError(null);
    setMessage(null);

    const formData = new FormData(event.currentTarget);
    const firstName = String(formData.get("first_name") ?? "").trim();
    const lastName = String(formData.get("last_name") ?? "").trim();
    const country = String(formData.get("country") ?? "").trim();
    const city = String(formData.get("city") ?? "").trim();
    const phone = normalizeProfilePhone(formData.get("phone"));
    const dateOfBirth = String(formData.get("date_of_birth") ?? "").trim() || null;
    const gender = String(formData.get("gender") ?? "").trim() || "Prefer not to say";
    const address = String(formData.get("address") ?? "").trim() || null;

    if (!firstName || !lastName || !country || !city) {
      setError("First name, last name, country, and city are required.");
      return;
    }
    if (!PROFILE_COUNTRIES.includes(country)) {
      setError("Choose a valid country.");
      return;
    }
    if (phone.error) {
      setError(phone.error);
      return;
    }

    setIsSaving(true);
    const nextProfile = {
      ...localProfile,
      first_name: firstName,
      last_name: lastName,
      phone: phone.value,
      date_of_birth: dateOfBirth,
      gender,
      address,
      city,
      country,
      onboarding_completed: true,
      updated_at: new Date().toISOString(),
    };

    const { error: updateError } = await supabase
      .from("profiles")
      .update(nextProfile)
      .eq("id", userId);

    if (updateError) {
      console.error("Profile update failed", updateError);
      setError("Unable to save profile changes.");
    } else {
      setLocalProfile(nextProfile);
      setMessage("Profile saved.");
    }
    setIsSaving(false);
  }, [localProfile, supabase, userId]);

  return (
    <section className="mx-auto mt-4 w-full max-w-3xl rounded-[28px] border border-white/12 bg-white/10 p-4 shadow-[0_18px_45px_rgba(0,0,0,0.18)] backdrop-blur-2xl sm:p-5">
      <div className="mb-4">
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-white/42">Me</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="mt-2 text-sm font-semibold text-white/62">Manage your personal Spotnera account details.</p>
      </div>
      {error ? <p className="mb-3 rounded-2xl border border-red-300/30 bg-red-500/20 px-3 py-2 text-sm font-semibold text-red-50">{error}</p> : null}
      <form onSubmit={handleSaveProfile} className="grid gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5"><span className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/42">First name</span><input name="first_name" required maxLength={80} defaultValue={localProfile.first_name ?? ""} className="h-11 rounded-2xl border border-white/10 bg-black/24 px-3 text-sm font-semibold text-white outline-none focus:border-white/30" /></label>
          <label className="grid gap-1.5"><span className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/42">Last name</span><input name="last_name" required maxLength={80} defaultValue={localProfile.last_name ?? ""} className="h-11 rounded-2xl border border-white/10 bg-black/24 px-3 text-sm font-semibold text-white outline-none focus:border-white/30" /></label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5"><span className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/42">Country</span><select name="country" required defaultValue={localProfile.country ?? ""} className="h-11 rounded-2xl border border-white/10 bg-black/24 px-3 text-sm font-semibold text-white outline-none focus:border-white/30"><option value="" disabled>Choose country</option>{PROFILE_COUNTRIES.map((country) => <option key={country} value={country}>{country}</option>)}</select></label>
          <label className="grid gap-1.5"><span className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/42">City</span><input name="city" required maxLength={120} defaultValue={localProfile.city ?? ""} className="h-11 rounded-2xl border border-white/10 bg-black/24 px-3 text-sm font-semibold text-white outline-none focus:border-white/30" /></label>
        </div>
        <label className="grid gap-1.5"><span className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/42">Phone optional</span><input type="tel" name="phone" maxLength={32} defaultValue={localProfile.phone ?? ""} className="h-11 rounded-2xl border border-white/10 bg-black/24 px-3 text-sm font-semibold text-white outline-none focus:border-white/30" /></label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5"><span className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/42">Date of birth optional</span><input type="date" name="date_of_birth" defaultValue={localProfile.date_of_birth ?? ""} className="h-11 rounded-2xl border border-white/10 bg-black/24 px-3 text-sm font-semibold text-white outline-none focus:border-white/30" /></label>
          <label className="grid gap-1.5"><span className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/42">Gender optional</span><select name="gender" defaultValue={localProfile.gender ?? "Prefer not to say"} className="h-11 rounded-2xl border border-white/10 bg-black/24 px-3 text-sm font-semibold text-white outline-none focus:border-white/30">{GENDER_OPTIONS.map((gender) => <option key={gender} value={gender}>{gender}</option>)}</select></label>
        </div>
        <label className="grid gap-1.5"><span className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/42">Street address optional</span><input name="address" maxLength={240} defaultValue={localProfile.address ?? ""} className="h-11 rounded-2xl border border-white/10 bg-black/24 px-3 text-sm font-semibold text-white outline-none focus:border-white/30" /></label>
        {message ? <p className="rounded-2xl border border-emerald-300/20 bg-emerald-500/14 px-3 py-2 text-sm font-semibold text-emerald-100">{message}</p> : null}
        <button type="submit" disabled={isSaving} className="h-11 rounded-2xl bg-white px-4 text-sm font-bold text-zinc-950 transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60">{isSaving ? "Saving..." : "Save changes"}</button>
      </form>
      <section className="mt-4 rounded-[24px] border border-white/10 bg-white/8 p-4"><p className="text-xs font-black uppercase tracking-[0.18em] text-white/42">Privacy</p><PrivacySettingsLink className="mt-3 min-h-11 rounded-2xl border border-white/10 bg-white/10 px-4 text-sm font-black text-white/78 transition hover:bg-white/16" /></section>
      <section className="mt-4 rounded-[24px] border border-white/10 bg-white/8 p-4"><p className="text-xs font-black uppercase tracking-[0.18em] text-white/42">Account</p><LogoutButton className="mt-3 min-h-11 rounded-2xl border border-white/10 bg-white/10 px-4 text-sm font-black text-white/78 transition hover:bg-white/16 disabled:cursor-not-allowed disabled:opacity-60" /></section>
      <DeleteAccountPanel ownedBusinessCount={ownedBusinessCount} />
    </section>
  );
}
