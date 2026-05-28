import { redirect } from "next/navigation";
import { GoogleLoginButton } from "@/components/google-login-button";
import { hasSupabaseEnv } from "@/utils/supabase/env";
import { createClient } from "@/utils/supabase/server";

export default async function Home() {
  if (!hasSupabaseEnv()) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-100 px-6 py-12 text-zinc-950">
        <section className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-medium text-zinc-500">Spotnera</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            Configure Supabase
          </h1>
          <p className="mt-3 text-sm leading-6 text-zinc-600">
            Add your Supabase project URL and anon key to{" "}
            <code className="rounded bg-zinc-100 px-1.5 py-1 text-xs">
              .env.local
            </code>{" "}
            to enable Google login.
          </p>
        </section>
      </main>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  async function signOut() {
    "use server";

    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-100 px-6 py-12 text-zinc-950">
      <section className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-8 shadow-sm">
        {user ? (
          <div className="flex flex-col gap-6">
            <div>
              <p className="text-sm font-medium text-emerald-700">Signed in</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight">
                Welcome to Spotnera
              </h1>
              <p className="mt-3 break-words text-sm leading-6 text-zinc-600">
                {user.email}
              </p>
            </div>
            <form action={signOut}>
              <button
                type="submit"
                className="h-11 w-full rounded-md bg-zinc-950 px-4 text-sm font-medium text-white transition hover:bg-zinc-800"
              >
                Sign out
              </button>
            </form>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <div>
              <p className="text-sm font-medium text-zinc-500">Spotnera</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight">
                Sign in to continue
              </h1>
              <p className="mt-3 text-sm leading-6 text-zinc-600">
                Use your Google account to access the app.
              </p>
            </div>
            <GoogleLoginButton />
          </div>
        )}
      </section>
    </main>
  );
}
