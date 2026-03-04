"use client";

import { useState } from "react";
import { Wand2, Copy, ExternalLink } from "lucide-react";

export type AiImageProvider = "chatgpt" | "gemini";

const PROVIDERS: {
  id: AiImageProvider;
  label: string;
  url: (prompt: string) => string;
  prefill: boolean;
  accent: string;
  androidPackage?: string;
}[] = [
  { id: "chatgpt", label: "ChatGPT", url: (p) => `https://chatgpt.com/?q=${encodeURIComponent(p)}`, prefill: true, accent: "#10a37f", androidPackage: "com.openai.chatgpt" },
  { id: "gemini", label: "Gemini", url: () => "https://gemini.google.com/", prefill: false, accent: "#4285f4", androidPackage: "com.google.android.apps.bard" },
];

export function getProviderUrl(prompt: string, provider: AiImageProvider): string {
  const p = PROVIDERS.find((x) => x.id === provider);
  return p ? p.url(prompt) : PROVIDERS[0].url(prompt);
}

/** Open provider: try app on Android if installed, else open website */
export function openProvider(prompt: string, provider: AiImageProvider, isMobile: boolean): void {
  const p = PROVIDERS.find((x) => x.id === provider);
  const webUrl = p ? p.url(prompt) : PROVIDERS[0].url(prompt);

  const isAndroid = typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);
  if (isAndroid && p?.androidPackage) {
    const fallback = encodeURIComponent(webUrl);
    const intentUrl = `intent://#Intent;package=${p.androidPackage};action=android.intent.action.MAIN;S.browser_fallback_url=${fallback};end`;
    window.location.href = intentUrl;
  } else if (isMobile) {
    window.location.href = webUrl;
  } else {
    window.open(webUrl, "_blank", "noopener,noreferrer");
  }
}

const IMAGE_PROMPTS = [
  "Funny roast meme reaction with exaggerated cartoon face and bold text, viral social media style",
  "Honest three-word feedback displayed as a minimalist graphic with clean typography and soft gradient background",
  "Creative compliment illustration of a person holding a glowing heart, warm colors, digital art style",
  "Savage but funny 1-10 rating graphic with dramatic lighting and a cheeky judge character",
  "Meme-style image for rating a friend's photo with popcorn emoji and sarcastic caption",
  "Reaction sticker idea: shocked face with floating question marks, colorful and cartoon style",
  "Rating out of 10 visual with neon numbers and star burst effect, modern retro aesthetic",
  "Friendly roast illustration: two stick figures, one giving thumbs down playfully, pastel background",
  "Honest feedback as a comic strip panel with speech bubble and expressive character",
  "Congrats image with confetti and celebration vibes, bold colors, social media ready",
];

export function AiImagePrompts({
  onPromptClick,
  onPromptCopy,
}: {
  onPromptClick: (prompt: string, provider: AiImageProvider) => void;
  onPromptCopy?: (prompt: string) => void;
}) {
  const [lastPrompt, setLastPrompt] = useState("Funny feedback or roast reaction image, viral meme style, bold typography");

  const handlePromptTap = (prompt: string) => {
    setLastPrompt(prompt);
    navigator.clipboard.writeText(prompt);
    onPromptCopy?.(prompt);
  };

  const handleProviderTap = (provider: (typeof PROVIDERS)[number]) => {
    onPromptClick(lastPrompt, provider.id);
  };

  return (
    <section className="mt-12">
      <style>{`
        @keyframes ai-card-enter {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .ai-prompt-card { animation: ai-card-enter 0.4s ease-out forwards; }
      `}</style>

      {/* Main card */}
      <div
        className="rounded-2xl overflow-hidden mb-6"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-5 py-4"
          style={{ borderBottom: "1px solid var(--border)",
            background: "linear-gradient(135deg, rgba(124,58,255,0.08), rgba(0,200,255,0.04))",
          }}
        >
          <div
            className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, var(--purple), var(--blue))",
              boxShadow: "0 4px 20px rgba(124,58,255,0.4)",
            }}
          >
            <Wand2 className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h3 className="font-black text-base text-[var(--text-primary)]">Generate image with AI</h3>
            <p className="text-xs text-[var(--text-muted)] font-semibold mt-0.5">
              1. Open ChatGPT or Gemini · 2. Copy a prompt · 3. Paste & generate · 4. Upload here
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5">
          {/* Providers - ChatGPT & Gemini above */}
          <div>
            <p className="text-[11px] font-bold text-[var(--text-muted)] mb-2.5 uppercase tracking-wider flex items-center gap-1.5">
              <ExternalLink className="w-3.5 h-3.5" /> Open with
            </p>
            <div className="flex flex-wrap gap-2">
              {PROVIDERS.map((p) => {
                const isBrand = !p.accent.startsWith("var(");
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleProviderTap(p)}
                    className="py-2.5 px-4 rounded-xl font-bold text-xs flex items-center gap-2 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] touch-manipulation"
                    style={
                      isBrand
                        ? {
                            background: p.accent,
                            color: "#fff",
                            border: "none",
                            boxShadow: `0 4px 12px ${p.accent}50`,
                          }
                        : {
                            background: "var(--bg-secondary)",
                            color: "var(--text-primary)",
                            border: "1px solid var(--border)",
                          }
                    }
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: isBrand ? "rgba(255,255,255,0.5)" : p.accent }}
                    />
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Prompts - below the buttons */}
          <div>
            <p className="text-[11px] font-bold text-[var(--text-muted)] mb-2.5 uppercase tracking-wider flex items-center gap-1.5">
              <Copy className="w-3.5 h-3.5" /> Tap to copy prompt
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {IMAGE_PROMPTS.map((prompt, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handlePromptTap(prompt)}
                  className="ai-prompt-card text-left p-3.5 rounded-xl transition-all duration-200 hover:bg-white/5 active:scale-[0.98] touch-manipulation group"
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid var(--border)",
                    animationDelay: `${Math.min(i * 30, 200)}ms`,
                  }}
                >
                  <span className="text-sm font-semibold text-[var(--text-primary)] group-hover:text-[var(--purple)] transition-colors line-clamp-2 leading-snug">
                    {prompt}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
