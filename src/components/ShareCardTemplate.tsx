"use client";

import { ShareQRCode } from "./ShareQRCode";

/** Story-sized card (9:16) for sharing to Instagram/WhatsApp. QR code + watermark. */
export function ShareCardTemplate({
  imageUrl,
  coolId,
  feedbackImageUrls = [],
  shareUrl,
  userFeedbackLink,
  useDataUrls = false,
}: {
  imageUrl: string;
  coolId: string;
  feedbackImageUrls?: string[];
  shareUrl: string;
  /** Full URL for QR (user's link for viral growth) */
  userFeedbackLink?: string;
  /** When true, images are data URLs - omit crossOrigin to avoid iOS Safari canvas issues */
  useDataUrls?: boolean;
}) {
  const fullUrl = shareUrl.startsWith("http") ? shareUrl : `https://picpop.me${shareUrl.startsWith("/") ? "" : "/"}${shareUrl}`;
  const qrUrl = userFeedbackLink || fullUrl;
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
      {/* Watermark badge */}
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

      {/* Header */}
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
          <p style={{ margin: 0, fontWeight: 900, fontSize: 18, color: "#fff" }}>@{coolId}</p>
          <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.6)", letterSpacing: "0.12em" }}>picpop</p>
        </div>
      </div>

      {/* Main image */}
      <div
        style={{
          flex: 1,
          borderRadius: 18,
          overflow: "hidden",
          background: "rgba(0,0,0,0.4)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 260,
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt=""
          {...(useDataUrls ? {} : { crossOrigin: "anonymous" })}
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      </div>

      {/* Reactions strip */}
      {feedbackImageUrls.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {feedbackImageUrls.slice(0, 6).map((url, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={url}
                alt=""
                {...(useDataUrls ? {} : { crossOrigin: "anonymous" })}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  objectFit: "cover",
                  border: "2px solid rgba(255,255,255,0.2)",
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Footer: QR + branding */}
      <div
        style={{
          marginTop: "auto",
          paddingTop: 14,
          borderTop: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          alignItems: "center",
          gap: 14,
          flexWrap: "wrap",
        }}
      >
        <div style={{ flexShrink: 0 }}>
          <ShareQRCode url={qrUrl} size={80} />
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
          <p style={{ margin: "4px 0 0 0", fontSize: 9, color: "rgba(255,255,255,0.5)", wordBreak: "break-all" }}>
            {shareUrl}
          </p>
        </div>
      </div>
    </div>
  );
}
