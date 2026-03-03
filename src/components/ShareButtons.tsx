"use client";

import { useState, useRef, useEffect } from "react";
import { toPng } from "html-to-image";
import { Check } from "lucide-react";
import { ShareCardTemplate } from "./ShareCardTemplate";

interface ShareButtonsProps {
  /** The shareable URL (e.g. /f/[imageId]) */
  shareUrl: string;
  /** Optional image URL – used for Web Share */
  imageUrl?: string;
  /** Optional title for share (WhatsApp chat) */
  title?: string;
  /** Data for snapshot template – post + feedback for Stories/Status */
  snapshotData?: {
    imageUrl: string;
    coolId: string;
    feedbackImageUrls: string[];
  };
  /** User's feedback link for QR code (e.g. origin/u/username) */
  userFeedbackLink?: string;
  /** Simple mode: big image + single Share button (no platform-specific buttons) */
  simple?: boolean;
}

// WhatsApp: opens app with pre-filled text
const getWhatsAppShareUrl = (url: string, title?: string): string => {
  const text = title ? `${title} ${url}` : url;
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
};

// Snapchat: opens app to share link
const getSnapchatShareUrl = (url: string): string => {
  return `https://www.snapchat.com/share?link=${encodeURIComponent(url)}`;
};

/** iOS: opens Stories camera directly */
const INSTAGRAM_CAMERA_IOS = "instagram://camera";
/** Android: https opens app via App Links when installed (custom schemes often do nothing) */
const INSTAGRAM_ANDROID = "https://www.instagram.com/";

export function ShareButtons({
  shareUrl,
  imageUrl,
  title = "Check out this on PicPop!",
  snapshotData,
  simple = false,
}: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);
  const [instagramSharing, setInstagramSharing] = useState(false);
  const templateRef = useRef<HTMLDivElement>(null);

  const fullUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${shareUrl.startsWith("/") ? "" : "/"}${shareUrl}`
      : shareUrl;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsApp = () => {
    window.location.href = getWhatsAppShareUrl(fullUrl, title);
  };

  const handleSnapchat = () => {
    window.location.href = getSnapchatShareUrl(fullUrl);
  };

  useEffect(() => {
    if (!instagramSharing || !snapshotData) return;
    const t = setTimeout(() => captureAndOpenInstagram(), 1200);
    return () => clearTimeout(t);
  }, [instagramSharing, snapshotData]);

  const saveImageToDevice = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "picpop-story.png";
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  const captureAndOpenInstagram = async () => {
    if (!templateRef.current || !snapshotData) return;
    const ua = navigator.userAgent.toLowerCase();
    const isMobile = /android|iphone|ipad|ipod/.test(ua);
    const isIOS = /iphone|ipad|ipod/.test(ua);
    try {
      const el = templateRef.current.querySelector("[data-share-template]") || templateRef.current;
      const dataUrl = await toPng(el as HTMLElement, { cacheBust: true, pixelRatio: 2 });
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], "picpop-story.png", { type: "image/png" });

      await saveImageToDevice(blob);

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], text: title, url: fullUrl, title });
        } catch {
          /* User dismissed – continue to open Instagram */
        }
      }

      setTimeout(() => {
        if (isMobile) {
          window.location.href = isIOS ? INSTAGRAM_CAMERA_IOS : INSTAGRAM_ANDROID;
        } else {
          window.open("https://www.instagram.com/", "_blank");
        }
      }, 1500);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        if (isMobile) {
          window.location.href = isIOS ? INSTAGRAM_CAMERA_IOS : INSTAGRAM_ANDROID;
        } else {
          window.open("https://www.instagram.com/", "_blank");
        }
      }
    } finally {
      setInstagramSharing(false);
    }
  };

  const handleInstagram = () => {
    const ua = navigator.userAgent.toLowerCase();
    const isMobile = /android|iphone|ipad|ipod/.test(ua);

    if (snapshotData) {
      setInstagramSharing(true);
      return;
    }

    if (!isMobile) {
      window.open("https://www.instagram.com/", "_blank");
      return;
    }

    if (imageUrl && navigator.share) {
      fetch(imageUrl, { mode: "cors" })
        .then((res) => (res.ok ? res.blob() : Promise.reject()))
        .then((blob) => {
          const file = new File([blob], "picpop.jpg", { type: blob.type || "image/jpeg" });
          if (navigator.canShare?.({ files: [file] })) {
            return navigator.share({ files: [file], text: title, url: fullUrl, title });
          }
        })
        .then(() => {
          const isIOS = /iphone|ipad|ipod/.test(ua);
          setTimeout(() => {
            window.location.href = isIOS ? INSTAGRAM_CAMERA_IOS : INSTAGRAM_ANDROID;
          }, 500);
        })
        .catch(() => {
          window.location.href = ua.includes("android") ? INSTAGRAM_ANDROID : INSTAGRAM_CAMERA_IOS;
        });
      return;
    }

    window.location.href = ua.includes("android") ? INSTAGRAM_ANDROID : INSTAGRAM_CAMERA_IOS;
  };

  const shareBtnClass =
    "rounded-lg p-2.5 transition-all shrink-0 disabled:opacity-60 flex items-center justify-center min-w-[44px] min-h-[44px]";

  const handleSimpleShare = async () => {
    if (imageUrl && navigator.share) {
      try {
        const res = await fetch(imageUrl, { mode: "cors" });
        if (!res.ok) throw new Error("Failed to fetch image");
        const blob = await res.blob();
        const file = new File([blob], "picpop-feedback.png", { type: blob.type || "image/png" });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], text: fullUrl, title });
          return;
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") copyToClipboard();
        return;
      }
    }
    copyToClipboard();
  };

  if (simple) {
    return (
      <button
        type="button"
        onClick={handleSimpleShare}
        className="w-full py-3.5 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all hover:opacity-90"
        style={{
          background: "linear-gradient(135deg, var(--pink), var(--purple))",
          boxShadow: "0 4px 20px rgba(255,61,127,0.3)",
          touchAction: "manipulation",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
        </svg>
        Share
      </button>
    );
  }

  return (
    <div className="space-y-2">
      {instagramSharing && snapshotData && (
        <div
          ref={templateRef}
          style={{
            position: "fixed",
            left: -9999,
            top: 0,
            zIndex: -1,
            opacity: 0,
            pointerEvents: "none",
          }}
        >
          <ShareCardTemplate
            imageUrl={snapshotData.imageUrl}
            coolId={snapshotData.coolId}
            feedbackImageUrls={snapshotData.feedbackImageUrls}
            shareUrl={fullUrl}
            userFeedbackLink={userFeedbackLink}
          />
        </div>
      )}
      <p className="text-xs font-bold text-white/40 uppercase tracking-wider">Share</p>
      <div className="flex items-center gap-2 flex-wrap">
      <button
        type="button"
        onClick={handleWhatsApp}
        className={shareBtnClass}
        style={{ background: "rgba(37,211,102,0.2)", color: "#25D366" }}
        title="Share on WhatsApp"
        aria-label="Share on WhatsApp"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
      </button>

      <button
        type="button"
        onClick={handleInstagram}
        disabled={instagramSharing}
        className={shareBtnClass}
        style={{
          background: "rgba(225,48,108,0.2)",
          color: "#E1306C",
        }}
        title="Share to Instagram Story"
        aria-label="Share to Instagram Story"
      >
        {instagramSharing ? (
          <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
          </svg>
        )}
      </button>

      <button
        type="button"
        onClick={handleSnapchat}
        className={shareBtnClass}
        style={{ background: "rgba(255,252,0,0.2)", color: "#FFFC00" }}
        title="Share on Snapchat"
        aria-label="Share on Snapchat"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12.206.793c.99 0 4.347.276 5.93 3.821.529 1.193.403 3.219.299 4.847l-.003.06c-.012.18-.022.345-.03.51.075.045.203.09.401.09.3-.016.659-.12 1.033-.301.165-.088.344-.104.464-.104.182 0 .359.029.509.09.45.149.738.479.738.838.015.449-.39.779-1.213 1.149-.089.029-.209.075-.344.119-.45.135-1.139.36-1.333.81-.09.224.031.524.493.524.209 0 .451-.061.628-.135.659-.27 1.226-.45 1.706-.45.42 0 .753.15.992.435.225.27.375.63.375 1.004 0 .63-.375 1.065-.944 1.38-.569.33-1.259.48-2.115.555-.195.015-.42.029-.629.044-.36.194-.988.404-1.682.404-.674 0-1.308-.135-1.722-.375-.27-.149-.42-.36-.465-.54-.119-.42.119-.899.868-1.424.149-.104.345-.254.569-.435.36-.27.765-.584.765-1.139 0-.255-.061-.494-.195-.704-.135-.225-.375-.375-.645-.42-.18-.045-.404-.061-.599-.061-.569 0-1.276.195-1.981.464-.329.12-.628.209-.883.209-.419 0-.539-.27-.539-.569 0-.374.18-1.064.42-1.754.18-.51.391-1.048.391-1.453 0-.359-.165-.644-.555-.884-.375-.225-.899-.375-1.533-.375-.734 0-1.229.225-1.618.494-.39.27-.78.674-1.069 1.273-.21.36-.36.78-.48 1.2-.24.81-.42 1.605-.42 1.605 0 .075-.27.405-.81.405-.6 0-.99-.419-1.29-.855-.299-.435-.599-1.139-.599-1.905 0-.705.225-1.319.705-1.785.48-.465 1.084-.674 1.809-.674.509 0 .988.119 1.348.27.36.15.599.27.704.33.06.015.105.03.135.045.06-.135.119-.285.195-.435.24-.48.539-.885.93-1.215.36-.299.765-.524 1.214-.675.465-.15.959-.224 1.469-.224zm.012 2.193c-.36 0-.704.044-1.034.135-.644.209-1.169.614-1.533 1.199-.404.644-.629 1.364-.629 2.139 0 .119.008.239.029.36-.494-.03-.899-.195-1.199-.495-.3-.3-.465-.703-.465-1.184 0-.48.165-.884.465-1.2.3-.299.719-.464 1.199-.464.539 0 .968.24 1.273.709.03-.03.059-.045.09-.06-.225-.674-.569-1.199-1.034-1.544-.465-.345-1.004-.509-1.644-.509z" />
        </svg>
      </button>

      {/* Copy link */}
      <button
        type="button"
        onClick={copyToClipboard}
        className={`${shareBtnClass} font-bold text-xs`}
        style={{
          background: copied ? "var(--green)" : "rgba(255,255,255,0.1)",
          color: copied ? "#000" : "#fff",
        }}
      >
        {copied ? <Check className="w-4 h-4" /> : "copy"}
      </button>
      </div>
    </div>
  );
}
