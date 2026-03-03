"use client";

import { QRCodeSVG } from "qrcode.react";

/** Renders QR code for share templates. Inline SVG ensures reliable capture with html-to-image. */
export function ShareQRCode({ url, size = 100 }: { url: string; size?: number }) {
  return (
    <div
      style={{
        display: "inline-flex",
        padding: 8,
        background: "#fff",
        borderRadius: 12,
        boxShadow: "0 2px 12px rgba(0,0,0,0.2)",
      }}
    >
      <QRCodeSVG value={url} size={size - 16} level="M" />
    </div>
  );
}
