"use client";

import { usePathname } from "next/navigation";
import Script from "next/script";

const ALLOWED_PATHS = ["/", "/terms", "/privacy", "/about"];

export function AdSenseScript() {
  const pathname = usePathname();

  // If the pathname ends with a slash (except for exactly "/"), normalize it
  const normalizedPath = pathname && pathname !== "/" && pathname.endsWith("/") 
    ? pathname.slice(0, -1) 
    : pathname;

  if (!ALLOWED_PATHS.includes(normalizedPath || "")) {
    return null;
  }

  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT || "ca-pub-9913239924968431";

  return (
    <Script
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`}
      strategy="beforeInteractive"
      crossOrigin="anonymous"
    />
  );
}
