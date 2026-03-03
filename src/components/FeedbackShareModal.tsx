"use client";

import { useState, useRef, useEffect } from "react";
import { toPng } from "html-to-image";
import { BrandedFeedbackShareTemplate } from "./BrandedFeedbackShareTemplate";

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
}

export function FeedbackShareModal({
  isOpen,
  onClose,
  singleFeedback,
  allData,
  shareUrl,
  userFeedbackLink,
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
    <>
      <div
        className="fixed inset-0 z-50 modal-overlay backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div
          className="rounded-2xl p-6 max-w-lg w-full border border-white/15 min-h-[85vh] max-h-[95vh] overflow-y-auto flex flex-col"
          style={{
            background: "var(--modal-card-bg)",
            boxShadow: "0 24px 60px rgba(0,10,40,0.6)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className="text-lg font-black text-white mb-4">Share feedback</h3>

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
            />
          </div>

          {/* Preview */}
          <div className="mb-5 flex-1 min-h-0 flex items-center justify-center">
            <div
              className="rounded-xl overflow-hidden border border-white/10 bg-black/30 flex flex-col"
              style={{ maxWidth: 280, aspectRatio: "9/16" }}
            >
              <div className="flex-1 flex items-center justify-center p-3 min-h-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={singleFeedback.feedbackImageUrl}
                  alt="Feedback preview"
                  className="max-w-full max-h-full object-contain rounded-lg"
                />
              </div>
              <div className="px-3 py-2 text-center border-t border-white/10">
                <span className="text-xs font-bold text-white/70">picpop</span>
                <span className="text-white/40 mx-1">•</span>
                <span className="text-xs font-semibold text-white/50 truncate block">{shareUrl}</span>
              </div>
            </div>
          </div>

          <p className="text-xs font-semibold text-white/50 text-center mb-3">
            Share includes picpop branding + link so friends can discover the app
          </p>

          <button
            type="button"
            disabled={sharing}
            onClick={handleShare}
            className="w-full py-3.5 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all hover:opacity-90 disabled:opacity-60"
            style={{
              background: "linear-gradient(135deg, var(--pink), var(--purple))",
              boxShadow: "0 4px 20px rgba(255,61,127,0.3)",
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
            className="w-full py-2.5 mt-3 text-sm font-bold text-white/50 hover:text-white"
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  );
}
