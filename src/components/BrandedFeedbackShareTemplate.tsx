"use client";

import { ShareQRCode } from "./ShareQRCode";

/** Story-sized branded card for sharing. Includes QR code, watermark, attractive template. */
export function BrandedFeedbackShareTemplate({
  feedbackImageUrl,
  coolId,
  shareUrl,
  userFeedbackLink,
}: {
  feedbackImageUrl: string;
  coolId?: string;
  shareUrl: string;
  userFeedbackLink?: string;
}) {
  const qrUrl = userFeedbackLink || shareUrl;
  return (
    <div
      data-share-template
      style={{
        width: 375,
        height: 667,
        background: "linear-gradient(165deg, #0d0d14 0%, #1a1a2e 50%, #0f0f1a 100%)",
        borderRadius: 24,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        fontFamily: "'Nunito', sans-serif",
        padding: 20,
        boxSizing: "border-box",
        position: "relative",
        border: "2px solid rgba(255,61,127,0.2)",
        boxShadow: "inset 0 0 60px rgba(124,58,255,0.08), 0 8px 32px rgba(0,0,0,0.4)",
      }}
    >
      {/* Watermark badge - top right */}
      <div
        style={{
          position: "absolute",
          top: 16,
          right: 16,
          padding: "6px 12px",
          borderRadius: 20,
          background: "linear-gradient(135deg, rgba(255,61,127,0.9), rgba(124,58,255,0.9))",
          boxShadow: "0 4px 16px rgba(255,61,127,0.4)",
          zIndex: 2,
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 900, color: "#fff", letterSpacing: "0.15em" }}>PICPOP</span>
      </div>

      {/* Header with avatar */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            background: "linear-gradient(135deg, #FF3D7F, #7C3AFF)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 900,
            fontSize: 22,
            color: "#fff",
            boxShadow: "0 4px 20px rgba(255,61,127,0.4)",
          }}
        >
          {(coolId || "?")[0].toUpperCase()}
        </div>
        <div>
          <p style={{ margin: 0, fontWeight: 900, fontSize: 18, color: "#fff" }}>@{coolId || "picpop"}</p>
          <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.6)", letterSpacing: "0.12em" }}>
            anonymous feedback
          </p>
        </div>
      </div>

      {/* Main image with subtle frame */}
      <div
        style={{
          flex: 1,
          borderRadius: 18,
          overflow: "hidden",
          background: "rgba(0,0,0,0.4)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 280,
          border: "1px solid rgba(255,255,255,0.06)",
          position: "relative",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={feedbackImageUrl}
          alt="Feedback"
          crossOrigin="anonymous"
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      </div>

      {/* Footer: QR + branding */}
      <div
        style={{
          marginTop: "auto",
          paddingTop: 16,
          borderTop: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ flexShrink: 0 }}>
          <ShareQRCode url={qrUrl} size={88} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              margin: 0,
              fontSize: 15,
              fontWeight: 900,
              letterSpacing: "0.1em",
              background: "linear-gradient(135deg, #FF3D7F, #7C3AFF)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            picpop
          </p>
          <p style={{ margin: "4px 0 0 0", fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.6)" }}>
            Scan QR • Get your link
          </p>
          <p style={{ margin: "6px 0 0 0", fontSize: 9, color: "rgba(255,255,255,0.5)", wordBreak: "break-all" }}>
            {shareUrl}
          </p>
        </div>
      </div>
    </div>
  );
}
