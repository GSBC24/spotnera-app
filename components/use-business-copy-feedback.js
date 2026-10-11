"use client";

import { useEffect, useRef, useState } from "react";
import { copyBusinessAddress } from "@/lib/business-address.mjs";

export function useBusinessCopyFeedback() {
  const [feedback, setFeedback] = useState("");
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  function showFeedback(message) {
    clearTimeout(timer.current);
    setFeedback(message);
    timer.current = setTimeout(() => setFeedback(""), 2500);
  }

  async function copy(value, successMessage, onSuccess) {
    const copied = await copyBusinessAddress(value);
    showFeedback(copied ? successMessage : "Could not copy. Please try again.");
    if (copied) onSuccess?.();
    return copied;
  }

  return { feedback, copy, showFeedback };
}
