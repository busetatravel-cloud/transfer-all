import Link from "next/link";
import { requireBusinessSession } from "@/lib/auth";
import { searchBusinessContent } from "@/lib/search";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SearchPageProps = {
  searchParams: Promise<{ q?: string }>;
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const session = await requireBusinessSession();
  const { q = "" } = await searchParams;
  const query = q.trim();
  const results = query ? await searchBusinessContent(session.businessId, query) : [];

  return (
    <section className="grid gap-6">
      <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
          Global arama
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          Rezervasyon, müşteri, görev ve içerik ara
        </h1>
        <p className="mt-2 text-sm leading-7 text-slate-600">
          Business ID ile izole çalışır. Arama yalnızca kendi business verilerinde sonuç verir.
        </p>
        <form className="mt-5 flex flex-col gap-3 sm:flex-row" action="/app/search">
          <input
            className="h-12 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
            name="q"
            defaultValue={query}
            placeholder="Müşteri adı, telefon, rota, görev, hizmet..."
            type="search"
          />
          <button
            className="inline-flex h-12 items-center justify-center rounded-2xl bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
            type="submit"
          >
            Ara
          </button>
        </form>
      </article>

      {!query ? (
        <article className="rounded-[28px] border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
          Arama yapmak için üstteki kutuya bir kelime yazın. Son kayıtlar burada otomatik listelenmez.
        </article>
      ) : (
        <article className="grid gap-4 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-slate-950">Sonuçlar</h2>
              <p className="text-sm text-slate-600">{results.length} sonuç bulundu.</p>
            </div>
          </div>

          <div className="grid gap-3">
            {results.length ? (
              results.map((result, index) => (
                <Link
                  key={`${result.type}-${result.title}-${index}`}
                  className="grid gap-2 rounded-[22px] border border-slate-200 bg-slate-50 p-4 transition hover:border-slate-300 hover:bg-white"
                  href={result.href}
                >
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    {result.type}
                  </div>
                  <div className="text-lg font-semibold text-slate-950">{result.title}</div>
                  <div className="text-sm leading-6 text-slate-600">{result.description || "-"}</div>
                  <div className="text-sm font-semibold text-slate-900">İlgili sayfaya git</div>
                </Link>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
                Sonuç bulunamadı.
              </div>
            )}
          </div>
        </article>
      )}
    </section>
  );
}
