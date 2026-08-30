import { createClient } from "@/utils/supabase/server";
import { hasSupabaseEnv } from "@/utils/supabase/env";
import { NextResponse } from "next/server";

export async function GET(request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const requestedNext = requestUrl.searchParams.get("next") || "/";
  const next = requestedNext.startsWith("/") && !requestedNext.startsWith("//")
    ? requestedNext
    : "/";

  if (!hasSupabaseEnv()) {
    return NextResponse.redirect(new URL("/", requestUrl.origin));
  }

  if (!code) {
    return NextResponse.redirect(new URL("/", requestUrl.origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL("/", requestUrl.origin));
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin));
}
