"use client";

import Link from "next/link";

type Props = {
  backHref: string;
};

function triggerPrint() {
  window.print();
}

export function VoucherActions({ backHref }: Props) {
  return (
    <div className="flex flex-wrap gap-2" data-no-print>
      <button
        className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
        type="button"
        onClick={triggerPrint}
      >
        Yazdır
      </button>
      <button
        className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-900 bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
        type="button"
        onClick={triggerPrint}
      >
        PDF indir
      </button>
      <Link
        className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
        href={backHref}
      >
        Rezervasyona dön
      </Link>
    </div>
  );
}
