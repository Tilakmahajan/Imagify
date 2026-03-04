"use client";

import { useState, useRef, useEffect } from "react";
import { toPng } from "html-to-image";
import { X } from "lucide-react";
import { BrandedFeedbackShareTemplate } from "./BrandedFeedbackShareTemplate";

const DEFAULT_DESCRIPTION = "Anonymous image response — someone shared this reaction with you via picpop";

interface FeedbackShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  singleFeedback: { feedbackImageUrl: string };
  allData: {
    imageUrl: string;
    coolId: string;
    feedbackImageUrls: string[];
  };
  /** Link to the feedback page (e.g. /f?imageId=xxx) */
  shareUrl: string;
  /** User's personal feedback link (e.g. domain/u/username) for viral discovery */
  userFeedbackLink?: string;
  /** Description shown with the image (e.g. "Anonymous response shared via picpop") */
  description?: string;
}

export function FeedbackShareModal({
  isOpen,
  onClose,
  singleFeedback,
  allData,
  shareUrl,
  userFeedbackLink,
  description = DEFAULT_DESCRIPTION,
}: FeedbackShareModalProps) {
  const [sharing, setSharing] = useState(false);
  const templateRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) setSharing(false);
  }, [isOpen]);

  const handleShare = async () => {
    setSharing(true);
    try {
      await new Promise((r) => setTimeout(r, 300));
      const node = templateRef.current?.querySelector("[data-share-template]") || templateRef.current;
      if (node) {
        const dataUrl = await toPng(node as HTMLElement, { cacheBust: true, pixelRatio: 2 });
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        const file = new File([blob], "picpop-feedback.png", { type: "image/png" });
        const shareText = "Check this out on picpop — anonymous image feedback!";
        if (navigator.share && navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], text: shareText, url: shareUrl, title: "picpop — anonymous feedback" });
        } else {
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = "picpop-feedback.png";
          link.click();
          URL.revokeObjectURL(url);
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") console.error(err);
    } finally {
      setSharing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl w-full max-w-md overflow-hidden flex flex-col"
        style={{
          background: "linear-gradient(180deg, var(--bg-card) 0%, rgba(18,18,28,0.98) 100%)",
          boxShadow: "0 24px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08)",
          border: "1px solid rgba(255,255,255,0.12)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <h3 className="text-lg font-black text-white">Share feedback</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors -mr-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Hidden full-res template for capture */}
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
          <BrandedFeedbackShareTemplate
            feedbackImageUrl={singleFeedback.feedbackImageUrl}
            coolId={allData.coolId}
            shareUrl={shareUrl}
            userFeedbackLink={userFeedbackLink}
            description={description}
          />
        </div>

        {/* Preview card */}
        <div className="p-5 flex flex-col gap-4">
          <div
            className="rounded-xl overflow-hidden border border-white/10 bg-black/40 flex flex-col"
            style={{ aspectRatio: "9/16", maxHeight: 320 }}
          >
            <div className="flex-1 flex items-center justify-center p-3 min-h-0 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={singleFeedback.feedbackImageUrl}
                alt="Anonymous feedback"
                className="w-full h-full object-contain rounded-lg"
              />
            </div>
            <div className="px-4 py-3 border-t border-white/10 bg-black/30">
              <p className="text-sm font-semibold text-white/90 leading-snug">{description}</p>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs font-bold text-[var(--pink)]">picpop</span>
                <span className="text-white/40">·</span>
                <span className="text-xs font-medium text-white/50 truncate">{shareUrl}</span>
              </div>
            </div>
          </div>

          <p className="text-xs font-medium text-white/50 text-center">
            Shared image includes branding + link so friends can discover the app
          </p>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              disabled={sharing}
              onClick={handleShare}
              className="w-full py-3.5 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all hover:opacity-95 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 disabled:hover:scale-100"
              style={{
                background: "linear-gradient(135deg, var(--pink), var(--purple))",
                boxShadow: "0 4px 20px rgba(255,61,127,0.35)",
                touchAction: "manipulation",
              }}
            >
              {sharing ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  Share
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 text-sm font-bold text-white/50 hover:text-white/80 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
