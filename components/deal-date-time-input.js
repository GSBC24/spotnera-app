"use client";

import { useState } from "react";
import { toDateTimeLocalValue } from "@/lib/deals";

function toSelectedLocalIso(value) {
  if (!value || typeof window === "undefined") {
    return "";
  }

  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : "";
}

export function DealDateTimeInput({ defaultValue, name }) {
  const [value, setValue] = useState(() => toDateTimeLocalValue(defaultValue));
  const isoValue = toSelectedLocalIso(value);

  return (
    <>
      <input
        type="datetime-local"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        suppressHydrationWarning
        className="spotnera-input w-full text-sm font-medium placeholder:text-zinc-400"
      />
      <input
        type="hidden"
        name={name}
        value={isoValue}
        readOnly
        suppressHydrationWarning
      />
    </>
  );
}
