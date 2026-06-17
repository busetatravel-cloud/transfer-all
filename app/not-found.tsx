import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-4">
      <section className="w-full max-w-xl rounded-[28px] border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
          404
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
          Sayfa bulunamadı
        </h1>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          Aradığınız içerik mevcut değil ya da bu domain için yayınlı değil.
        </p>
        <Link
          className="mt-6 inline-flex h-11 items-center justify-center rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
          href="/"
        >
          Ana sayfa
        </Link>
      </section>
    </main>
  );
}
