"use client";

import { useState, useRef, useEffect } from "react";
import { toPng } from "html-to-image";
import { domToPng } from "modern-screenshot";
import { X, Share2, Loader2 } from "lucide-react";

const isIOS = () => typeof navigator !== "undefined" && /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase());
import { BrandedFeedbackShareTemplate } from "./BrandedFeedbackShareTemplate";

/** * Force-fetches the image with CORS to prevent "Tainted Canvas".
 * Added a cache-buster to bypass any old 403/Forbidden cached results.
 */
async function imageUrlToDataUrl(url: string): Promise<string> {
  const cacheBuster = `cb=${Date.now()}`;
  const finalUrl = url.includes('?') ? `${url}&${cacheBuster}` : `${url}?${cacheBuster}`;

  const res = await fetch(finalUrl, { mode: "cors" });
  if (!res.ok) throw new Error("Cloud Storage Blocked Access (CORS/Rules)");

  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function FeedbackShareModal({
  isOpen,
  onClose,
  singleFeedback,
  allData,
  shareUrl,
  userFeedbackLink,
  feedbackId,
  description = "Anonymous reaction via picpop",
}: any) {
  const [sharing, setSharing] = useState(false);
  const [resolvedImageUrl, setResolvedImageUrl] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const templateRef = useRef<HTMLDivElement>(null);

  // Preload logic
  useEffect(() => {
    if (!isOpen) {
      setResolvedImageUrl(null);
      setIsReady(false);
      return;
    }

    imageUrlToDataUrl(singleFeedback.feedbackImageUrl)
      .then((dataUrl) => {
        setResolvedImageUrl(dataUrl);
        // Essential: give the browser time to register the DataURL and decode (iOS needs more time)
        setTimeout(() => setIsReady(true), isIOS() ? 1200 : 800);
      })
      .catch((err) => {
        console.error("Preload Error:", err);
        setResolvedImageUrl(singleFeedback.feedbackImageUrl);
        setIsReady(true);
      });
  }, [isOpen, singleFeedback.feedbackImageUrl]);

  const handleShare = async () => {
    if (!templateRef.current || sharing || !isReady) return;
    setSharing(true);

    try {
      // Find the specific template wrapper
      const node = templateRef.current.querySelector("[data-share-template]") as HTMLElement || templateRef.current;

      // STEP 1: Optimization - Force images to load inside the template
      const images = node.getElementsByTagName('img');
      await Promise.all(Array.from(images).map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise(resolve => { img.onload = resolve; img.onerror = resolve; });
      }));

      // STEP 2: Capture - use modern-screenshot on iOS (better Safari support), html-to-image elsewhere
      const captureOpts = {
        scale: 2,
        fetch: { bypassingCache: true },
      };
      const htmlToImageOpts = {
        backgroundColor: "#12121c",
        pixelRatio: 2,
        skipFonts: true,
        cacheBust: true,
        style: { visibility: "visible", opacity: "1" },
      };

      let dataUrl: string;
      if (isIOS()) {
        // iOS: move template into viewport so Safari paints it (off-screen can yield blank)
        const wrapper = templateRef.current;
        if (wrapper) {
          wrapper.style.position = "fixed";
          wrapper.style.left = "0";
          wrapper.style.top = "0";
          wrapper.style.width = "375px";
          wrapper.style.visibility = "visible";
          wrapper.style.opacity = "0.01";
          wrapper.style.zIndex = "-1";
          await new Promise((r) => setTimeout(r, 500));
        }
        try {
          let lastUrl = "";
          for (let i = 0; i < 3; i++) {
            lastUrl = await domToPng(node, captureOpts);
            await new Promise((r) => setTimeout(r, 400));
          }
          dataUrl = lastUrl;
        } finally {
          if (wrapper) {
            wrapper.style.position = "absolute";
            wrapper.style.left = "-2000px";
            wrapper.style.top = "-2000px";
            wrapper.style.width = "400px";
            wrapper.style.opacity = "";
          }
        }
      } else {
        dataUrl = await toPng(node, htmlToImageOpts);
      }

      const res = await fetch(dataUrl);
      const blob = await res.blob();
      
      if (blob.size < 10000) throw new Error("Image capture failed (Empty Blob)");

      const file = new File([blob], `picpop-share-${Date.now()}.png`, { type: "image/png" });

      const fullShareUrl = shareUrl.startsWith("http") ? shareUrl : `${typeof window !== "undefined" ? window.location.origin : ""}${shareUrl.startsWith("/") ? "" : "/"}${shareUrl}`;
      const shareText = `${description}\n\n${fullShareUrl}`;
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "picpop",
          text: shareText,
        });
      } else {
        // Fallback for desktop/unsupported browsers
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = "picpop-feedback.png";
        link.click();
      }
      
      if (feedbackId) {
        try {
          const { httpsCallable } = await import("firebase/functions");
          const { getAppFunctions } = await import("@/lib/functions");
          const functions = getAppFunctions();
          if (functions) {
            await httpsCallable(functions, "logFeedbackActivity")({ feedbackId, type: "reshare" });
          }
        } catch (err) { }
      }
    } catch (err) {
      console.error("Capture Process Error:", err);
      alert("Failed to generate image. Please try again.");
    } finally {
      setSharing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" onClick={onClose}>
      <div className="bg-[#12121c] rounded-3xl w-full max-w-sm overflow-hidden border border-white/10" onClick={e => e.stopPropagation()}>
        
        {/* HEADER */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <span className="text-white font-bold">Share Feedback</span>
          <button onClick={onClose} className="text-white/40"><X size={20} /></button>
        </div>

        {/* HIDDEN CAPTURE AREA 
            iOS FIX: It MUST be visibility: visible but moved far off-screen.
            If visibility is hidden, many browsers skip the "Paint" step, 
            resulting in a black or blank image.
        */}
        <div 
          ref={templateRef}
          style={{ 
            position: 'absolute', 
            top: '-2000px', 
            left: '-2000px', 
            width: '400px', // Set a fixed width for the template
            visibility: 'visible',
          }}
        >
          {resolvedImageUrl && (
            <BrandedFeedbackShareTemplate
              feedbackImageUrl={resolvedImageUrl}
              coolId={allData.coolId}
              shareUrl={shareUrl}
              userFeedbackLink={userFeedbackLink}
              description={description}
              useDataUrl={true}
            />
          )}
        </div>

        {/* PREVIEW UI */}
        <div className="p-6 flex flex-col gap-6 text-center">
          <div className="relative aspect-[9/14] w-full bg-white/5 rounded-2xl overflow-hidden border border-white/5 flex items-center justify-center">
            {isReady && resolvedImageUrl ? (
              <img src={resolvedImageUrl} className="w-full h-full object-contain" alt="Preview" />
            ) : (
              <Loader2 className="w-8 h-8 text-white/20 animate-spin" />
            )}
          </div>

          <button
            onClick={handleShare}
            disabled={!isReady || sharing}
            className="w-full py-4 rounded-2xl font-bold text-white flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-30"
            style={{ background: "linear-gradient(135deg, #FF3D7F, #A033FF)" }}
          >
            {sharing ? <Loader2 className="animate-spin w-5 h-5" /> : <><Share2 size={18} /> Share</>}
          </button>
        </div>
      </div>
    </div>
  );
}