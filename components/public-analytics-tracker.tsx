"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

type Props = {
  businessId: string;
  enabled?: boolean;
};

function getPageType(pathname: string) {
  switch (pathname) {
    case "/":
      return "home";
    case "/services":
      return "services";
    case "/vehicles":
      return "vehicles";
    case "/routes":
      return "routes";
    case "/blog":
      return "blog";
    case "/contact":
      return "contact";
    case "/quote":
      return "quote";
    default:
      return "page";
  }
}

export function PublicAnalyticsTracker({ businessId, enabled = true }: Props) {
  const pathname = usePathname();
  const sentRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !businessId) {
      return;
    }

    const pagePath = pathname || "/";
    if (sentRef.current === `${businessId}:${pagePath}`) {
      return;
    }

    sentRef.current = `${businessId}:${pagePath}`;

    const payload = {
      pagePath,
      pageType: getPageType(pagePath),
      referrer: document.referrer || "",
      userAgent: navigator.userAgent || "",
    };

    void fetch("/api/business/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => undefined);
  }, [businessId, enabled, pathname]);

  return null;
}
