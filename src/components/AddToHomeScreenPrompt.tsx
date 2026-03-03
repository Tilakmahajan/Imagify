"use client";

import { useState, useEffect } from "react";
import { X, Share2 } from "lucide-react";

const STORAGE_KEY = "picpop-add-to-home-dismissed";
const DELAY_MS = 3000; // Show after 3 seconds on page

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return !!(window as Window & { standalone?: boolean }).standalone || window.matchMedia("(display-mode: standalone)").matches;
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isAndroid(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent);
}

function isMobile(): boolean {
  return isIos() || isAndroid();
}

export function AddToHomeScreenPrompt() {
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || typeof window === "undefined") return;
    if (isStandalone()) return; // Already added to home screen
    if (localStorage.getItem(STORAGE_KEY) === "1") return; // User dismissed
    if (!isMobile()) return; // Only show on mobile for "Add to Home Screen"

    const t = setTimeout(() => setVisible(true), DELAY_MS);
    return () => clearTimeout(t);
  }, [mounted]);

  const handleDismiss = (dontShowAgain = false) => {
    setVisible(false);
    if (dontShowAgain) localStorage.setItem(STORAGE_KEY, "1");
  };

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 pb-8 sm:pb-4 bg-black/60 backdrop-blur-sm"
      onClick={() => handleDismiss(false)}
    >
      <div
        className="w-full max-w-sm rounded-2xl overflow-hidden border border-white/15 shadow-2xl"
        style={{
          background: "linear-gradient(180deg, var(--bg-card) 0%, rgba(26,26,46,0.98) 100%)",
          boxShadow: "0 24px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, var(--pink), var(--purple))" }}>
              <Share2 className="w-5 h-5 text-white" />
            </div>
            <h3 className="font-black text-white">Add to Home Screen</h3>
          </div>
          <button
            type="button"
            onClick={() => handleDismiss(false)}
            className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          <p className="text-sm text-white/80 font-semibold">
            Get quick access — add PicPop to your home screen like a bookmark. Opens in browser, no app store.
          </p>

          {isIos() && (
            <div className="rounded-xl p-4 bg-white/5 border border-white/10 space-y-2">
              <p className="text-xs font-bold text-white/60 uppercase tracking-wider">iPhone / iPad</p>
              <ol className="text-sm text-white/90 font-semibold space-y-1.5 list-decimal list-inside">
                <li>Tap the <strong>Share</strong> button (square with arrow) at the bottom of Safari</li>
                <li>Scroll down and tap <strong>Add to Home Screen</strong></li>
                <li>Tap <strong>Add</strong> in the top right</li>
              </ol>
            </div>
          )}

          {isAndroid() && (
            <div className="rounded-xl p-4 bg-white/5 border border-white/10 space-y-2">
              <p className="text-xs font-bold text-white/60 uppercase tracking-wider">Android (Chrome)</p>
              <ol className="text-sm text-white/90 font-semibold space-y-1.5 list-decimal list-inside">
                <li>Tap the <strong>menu</strong> (⋮) in the top right</li>
                <li>Tap <strong>Add to Home screen</strong></li>
                <li>Confirm — a shortcut (bookmark) will appear on your home screen</li>
              </ol>
              <p className="text-xs text-white/50 mt-2">
                Opens in browser — no app store download.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 pb-4 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => handleDismiss(true)}
            className="w-full py-2.5 text-xs font-bold text-white/50 hover:text-white/70 transition-colors"
          >
            Don&apos;t show again
          </button>
        </div>
      </div>
    </div>
  );
}
