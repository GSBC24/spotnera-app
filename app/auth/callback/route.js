import { createClient } from "@/utils/supabase/server";
import { hasSupabaseEnv } from "@/utils/supabase/env";
import { NextResponse } from "next/server";

export async function GET(request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? "/";

  if (!hasSupabaseEnv()) {
    return NextResponse.redirect(new URL("/", requestUrl.origin));
  }

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin));
}
