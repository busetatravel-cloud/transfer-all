import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { getSession } from "@/lib/auth";
import { getLandingPath } from "@/lib/platform";

export default async function LoginPage() {
  const session = await getSession();

  if (session) {
    redirect(getLandingPath(session.role));
  }

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-6xl items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="grid gap-6 text-slate-900">
          <div className="inline-flex w-fit rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-600 shadow-sm">
            Transfer SaaS Core
          </div>

          <div className="grid gap-4">
            <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
              Tek platform domaini, iki rol, temiz panel cekirdegi.
            </h1>
            <p className="max-w-xl text-lg leading-8 text-slate-600">
              Login, role guard ve panel ayrimi sifirdan kuruldu. Public site
              ve diger moduller bir sonraki asamada eklenecek.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <article className="surface-strong rounded-[24px] p-5">
              <p className="text-sm font-medium text-slate-500">Super admin</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">
                busetatransfer.com/super-admin
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Business hesaplarini ve sistem ayarlarini yonetecek ana panel.
              </p>
            </article>

            <article className="surface-strong rounded-[24px] p-5">
              <p className="text-sm font-medium text-slate-500">Business admin</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">
                busetatransfer.com/app
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Her firmanin kendi verisi ve panel alani.
              </p>
            </article>
          </div>
        </section>

        <section className="surface-strong rounded-[32px] p-6 sm:p-8">
          <div className="rounded-[24px] bg-slate-950 px-6 py-6 text-white">
            <p className="text-xs uppercase tracking-[0.24em] text-orange-300">
              Login
            </p>
            <h2 className="mt-3 text-2xl font-semibold">Panel girisi</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Demo modda hazirlanan ilk cekirdekte login calisir. Supabase
              baglantisi eklendiginde ayni akis gercek tabloyu kullanir.
            </p>
          </div>

          <div className="mt-6">
            <LoginForm />
          </div>

          <div className="mt-6 rounded-[24px] border border-slate-200 bg-slate-50 p-5">
            <p className="text-sm font-semibold text-slate-900">Demo hesaplar</p>
            <div className="mt-3 grid gap-3 text-sm text-slate-600">
              <div className="rounded-2xl bg-white px-4 py-3">
                <p className="font-medium text-slate-900">SUPER_ADMIN</p>
                <p>Email: super@busetatransfer.com</p>
                <p>Password: superadmin123</p>
              </div>
              <div className="rounded-2xl bg-white px-4 py-3">
                <p className="font-medium text-slate-900">BUSINESS_ADMIN</p>
                <p>Email: demo@busetatransfer.com</p>
                <p>Password: business123</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
