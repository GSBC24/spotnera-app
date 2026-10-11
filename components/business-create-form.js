"use client";

import { createContext, useActionState, useContext, useEffect, useRef } from "react";
import { AnalyticsForm } from "@/components/owner-analytics";

const BusinessCreateState = createContext(null);

export function BusinessCreateForm({ action, children }) {
  const [state, formAction] = useActionState(action, { field: null, message: null });
  const formRef = useRef(null);

  useEffect(() => {
    if (!state?.field) return;
    const fieldName = state.field === "cover" ? "cover_image" : state.field;
    formRef.current?.querySelector(`[name="${fieldName}"]`)?.focus();
  }, [state]);

  return (
    <BusinessCreateState.Provider value={state}>
      <AnalyticsForm action={formAction} formRef={formRef} preserveOnAction encType="multipart/form-data"
        eventName="business_create" preventDuplicateSubmissions className="grid gap-3">
        {children}
      </AnalyticsForm>
    </BusinessCreateState.Provider>
  );
}

export function BusinessCreateFieldError({ field }) {
  const state = useContext(BusinessCreateState);
  return state?.field === field ? <span className="text-xs font-semibold text-red-600" role="alert">{state.message}</span> : null;
}

export function BusinessCreateFormError() {
  const state = useContext(BusinessCreateState);
  return state?.message ? <div className="text-sm font-semibold text-red-600" role="alert">
    <p>{state.message}</p>
    {state.referenceId ? <p className="mt-1 text-xs">Reference ID: {state.referenceId}</p> : null}
  </div> : null;
}

export function BusinessCreateDetails({ defaultOpen, children }) {
  const state = useContext(BusinessCreateState);
  const optionalFieldError = state?.field && !["name", "category", "country", "city", "address"].includes(state.field);
  return <details open={defaultOpen || Boolean(optionalFieldError)} className="rounded-3xl border border-zinc-200 bg-zinc-50 p-3">{children}</details>;
}
