import { ResetPasswordForm } from "@/components/reset-password-form";

export default function ResetPasswordPage() {
  return (
    <main className="spotnera-auth-shell flex min-h-screen items-center justify-center px-5 py-8">
      <section className="spotnera-card w-full max-w-md rounded-[30px] p-5 sm:p-8">
        <div>
          <div className="flex items-center gap-3">
            <img src="/icons/logo.png" alt="Spotnera" className="spotnera-brand-mark object-contain" />
            <div>
              <p className="spotnera-kicker text-zinc-500">Spotnera</p>
              <p className="text-sm font-bold text-zinc-950">Account security</p>
            </div>
          </div>
          <h1 className="mt-6 text-3xl font-semibold leading-tight">
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
