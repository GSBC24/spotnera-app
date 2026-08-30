import { ResetPasswordForm } from "@/components/reset-password-form";

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f4ef] px-5 py-8 text-zinc-950">
      <section className="w-full max-w-md rounded-[2rem] border border-white/70 bg-white/75 p-5 shadow-[0_24px_80px_rgba(39,39,42,0.14)] backdrop-blur-xl sm:p-8">
        <div>
          <p className="text-sm font-semibold text-zinc-500">Spotnera</p>
          <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-tight">
            Reset password
          </h1>
          <p className="mt-3 text-sm leading-6 text-zinc-600">
            Choose a new password for your Spotnera account.
          </p>
        </div>
        <div className="mt-6">
          <ResetPasswordForm />
        </div>
      </section>
    </main>
  );
}
