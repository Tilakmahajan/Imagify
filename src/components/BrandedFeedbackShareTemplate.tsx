"use client";

/** Story-sized branded card for sharing. Image + attractive description + link (no QR). */
export function BrandedFeedbackShareTemplate({
  feedbackImageUrl,
  coolId,
  shareUrl,
  userFeedbackLink,
  description,
  useDataUrl = false,
}: {
  feedbackImageUrl: string;
  coolId?: string;
  shareUrl: string;
  userFeedbackLink?: string;
  /** Description shown below image: e.g. "Anonymous response shared via picpop" */
  description?: string;
  /** When true, image is a data URL - omit crossOrigin to avoid iOS Safari canvas issues */
  useDataUrl?: boolean;
}) {
  const displayUrl = userFeedbackLink || shareUrl;
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
          flexDirection: "column",
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
          alt="Anonymous feedback"
          {...(useDataUrl ? {} : { crossOrigin: "anonymous" })}
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
        {description && (
          <div
            style={{
              padding: "12px 16px",
              background: "rgba(0,0,0,0.5)",
              borderTop: "1px solid rgba(255,255,255,0.08)",
              width: "100%",
              textAlign: "center",
            }}
          >
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.9)", lineHeight: 1.4 }}>
              {description}
            </p>
          </div>
        )}
      </div>

      {/* Footer: link + branding (no QR) */}
      <div
        style={{
          marginTop: "auto",
          paddingTop: 20,
          paddingBottom: 8,
          borderTop: "1px solid rgba(255,255,255,0.08)",
          textAlign: "center",
        }}
      >
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
        <p style={{ margin: "8px 0 0 0", fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.9)", lineHeight: 1.4 }}>
          {description || "Anonymous reaction shared via picpop"}
        </p>
        <p
          style={{
            margin: "12px 0 0 0",
            fontSize: 12,
            fontWeight: 700,
            color: "rgba(255,255,255,0.7)",
            wordBreak: "break-all",
            padding: "10px 14px",
            background: "rgba(255,255,255,0.06)",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          {displayUrl}
        </p>
      </div>
    </div>
  );
}
