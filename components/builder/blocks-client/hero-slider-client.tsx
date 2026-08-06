"use client";

import { useEffect, useState, type ReactNode } from "react";

// Faz 15 — `prefers-reduced-motion: reduce` tercih eden kullanıcılar için:
// (1) otomatik oynatma tamamen DURDURULUR (WCAG 2.2.2 "Pause, Stop, Hide" —
// otomatik ilerleyen içerik, hareket azaltma tercih edildiğinde kullanıcı
// müdahalesi olmadan asla ilerlememeli), (2) geçiş animasyonları CSS
// `motion-reduce:` varyantıyla (bkz. aşağıdaki className'ler) anında/geçişsiz
// hale gelir. SSR sırasında `matchMedia` erişilemez olduğu için varsayılan
// `false` ile başlar (sunucu her zaman "hareket azaltma yok" varsayar);
// hydration sonrası gerçek tercih okunur — bu, herhangi bir hydration
// mismatch'i önler (sunucu ve istemcinin ilk render'ı her zaman eşleşir).
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);

    function handleChange(event: MediaQueryListEvent) {
      setReduced(event.matches);
    }

    query.addEventListener("change", handleChange);
    return () => query.removeEventListener("change", handleChange);
  }, []);

  return reduced;
}

// Faz 14 — Hero Slider'ın TEK client parçası. Slaytların GERÇEK içeriği
// (başlık/CTA/görsel) her zaman server tarafında (hero-slider.tsx) render
// edilip `children` olarak buraya verilir — bu bileşen o server-render
// edilmiş DOM'u YENİDEN OLUŞTURMAZ, yalnızca hangisinin görünür olduğunu
// (ve otomatik geçişi) yönetir. SSR/ilk boya sırasında `active` state'i
// her zaman 0'dır — bu yüzden ilk slayt JS hiç çalışmasa da (veya
// hydration'dan önce) görünür ve indexlenebilir kalır.
export function HeroSliderClient({
  slides,
  autoplay,
  durationMs,
  pauseOnHover,
  transition,
  showIndicators,
  showArrows,
  loop,
}: {
  slides: ReactNode[];
  autoplay: boolean;
  durationMs: number;
  pauseOnHover: boolean;
  transition: "fade" | "slide";
  showIndicators: boolean;
  showArrows: boolean;
  loop: boolean;
}) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const prefersReducedMotion = usePrefersReducedMotion();
  const slideCount = slides.length;

  useEffect(() => {
    if (!autoplay || paused || slideCount <= 1 || prefersReducedMotion) {
      return;
    }

    const id = setInterval(() => {
      setActive((prev) => {
        const next = prev + 1;
        if (next < slideCount) {
          return next;
        }
        return loop ? 0 : prev;
      });
    }, Math.max(1500, durationMs));

    return () => clearInterval(id);
  }, [autoplay, paused, slideCount, durationMs, loop, prefersReducedMotion]);

  function goTo(index: number) {
    setActive(((index % slideCount) + slideCount) % slideCount);
  }

  const canPrev = loop || active > 0;
  const canNext = loop || active < slideCount - 1;

  return (
    <div
      className="relative overflow-hidden rounded-[28px]"
      onMouseEnter={() => pauseOnHover && setPaused(true)}
      onMouseLeave={() => pauseOnHover && setPaused(false)}
      style={{ minHeight: "clamp(420px, 60vh, 640px)" }}
    >
      {transition === "slide" ? (
        <div
          className="flex h-full transition-transform duration-700 ease-out motion-reduce:transition-none"
          style={{ width: `${slideCount * 100}%`, transform: `translateX(-${active * (100 / slideCount)}%)` }}
        >
          {slides.map((slide, index) => (
            <div className="h-full shrink-0" key={index} style={{ width: `${100 / slideCount}%` }} aria-hidden={index !== active}>
              {slide}
            </div>
          ))}
        </div>
      ) : (
        slides.map((slide, index) => (
          <div
            aria-hidden={index !== active}
            className="absolute inset-0 transition-opacity duration-700 ease-out motion-reduce:transition-none"
            key={index}
            style={{ opacity: index === active ? 1 : 0, pointerEvents: index === active ? "auto" : "none" }}
          >
            {slide}
          </div>
        ))
      )}

      {showArrows && slideCount > 1 ? (
        <>
          <button
            aria-disabled={!canPrev}
            aria-label="Önceki slayt"
            className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white transition motion-reduce:transition-none hover:bg-black/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-30"
            disabled={!canPrev}
            onClick={() => goTo(active - 1)}
            type="button"
          >
            ‹
          </button>
          <button
            aria-disabled={!canNext}
            aria-label="Sonraki slayt"
            className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white transition motion-reduce:transition-none hover:bg-black/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-30"
            disabled={!canNext}
            onClick={() => goTo(active + 1)}
            type="button"
          >
            ›
          </button>
        </>
      ) : null}

      {showIndicators && slideCount > 1 ? (
        <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2" role="tablist">
          {slides.map((_, index) => (
            <button
              aria-current={index === active}
              aria-label={`${index + 1}. slayta git`}
              className={`h-2 rounded-full transition-all motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${index === active ? "w-6 bg-white" : "w-2 bg-white/50"}`}
              key={index}
              onClick={() => goTo(index)}
              role="tab"
              type="button"
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
