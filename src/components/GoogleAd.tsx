"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT || "ca-pub-9913239924968431";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

export function GoogleAd({
  slot,
  format = "auto",
  style = { display: "block", minHeight: 90 },
  className = "",
}: {
  slot: string;
  format?: "auto" | "rectangle" | "horizontal" | "vertical";
  style?: React.CSSProperties;
  className?: string;
}) {
  const ref = useRef<HTMLModElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (!slot || typeof window === "undefined") return;

    const pushAd = () => {
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch {
        // Ignore
      }
    };

    pushAd();
    const t1 = setTimeout(pushAd, 300);
    const t2 = setTimeout(pushAd, 1000);
    const t3 = setTimeout(pushAd, 2500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [slot, pathname]);

  if (!slot) return null;

  return (
    <div className={`my-4 min-h-[90px] flex items-center justify-center ${className}`}>
      <ins
        ref={ref}
        className="adsbygoogle"
        style={{ display: "block", minHeight: 90, ...style }}
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  );
}
