export default function Loading() {
  return (
    <section className="grid min-h-[60vh] place-items-center">
      <div className="surface-strong w-full max-w-2xl rounded-[28px] p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Website Builder</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">Draft yükleniyor</h1>
        <p className="mt-2 text-sm leading-7 text-slate-600">
          Taslak verisi backend üzerinden hazırlanıyor. Preview birazdan açılacak.
        </p>
      </div>
    </section>
  );
}
