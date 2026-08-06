"use client";

import { useState } from "react";

// Faz 14 — Video bloğu için minimal "facade" (poster + oynat düğmesi).
// Ağır 3. taraf embed (YouTube/Vimeo iframe + kendi JS'i) sayfa yüklenirken
// HİÇ indirilmez; yalnızca kullanıcı oynat'a tıkladığında iframe DOM'a
// eklenir. Bu, tek bir `useState` dışında hiçbir state/efekt taşımayan,
// bilerek en küçük mümkün client bileşenidir (performans hedefi: "gereksiz
// client JS yok" + embed'in kendi ağır JS'ini varsayılan olarak hiç yüklememe).
export function VideoFacade({
  embedUrl,
  posterImage,
  title,
  autoplay,
}: {
  embedUrl: string;
  posterImage: string;
  title: string;
  autoplay: boolean;
}) {
  const [activated, setActivated] = useState(false);

  if (activated) {
    const src = autoplay
      ? `${embedUrl}${embedUrl.includes("?") ? "&" : "?"}autoplay=1&mute=1`
      : embedUrl;

    return (
      <iframe
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        className="h-full w-full"
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        src={src}
        title={title || "Video"}
      />
    );
  }

  return (
    <button
      aria-label={title ? `${title} videosunu oynat` : "Videoyu oynat"}
      className="group relative flex h-full w-full items-center justify-center overflow-hidden bg-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      onClick={() => setActivated(true)}
      type="button"
    >
      {posterImage ? (
        <img
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover opacity-80 transition motion-reduce:transition-none group-hover:opacity-70"
          loading="lazy"
          src={posterImage}
        />
      ) : null}
      <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-white/90 text-slate-900 shadow-lg transition motion-reduce:transition-none motion-reduce:group-hover:scale-100 group-hover:scale-105">
        <svg aria-hidden="true" fill="currentColor" height="24" viewBox="0 0 24 24" width="24">
          <path d="M8 5v14l11-7z" />
        </svg>
      </span>
    </button>
  );
}
