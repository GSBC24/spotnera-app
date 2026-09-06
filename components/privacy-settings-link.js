"use client";

import { openPrivacySettings } from "@/lib/consent";

export function PrivacySettingsLink({ className = "" }) {
  return (
    <button
      type="button"
      onClick={openPrivacySettings}
      className={className}
    >
      Privacy settings
    </button>
  );
}
