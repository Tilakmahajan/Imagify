"use client";

import { Wand2, Sparkles } from "lucide-react";

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

export function AiImagePrompts({ onPromptClick }: { onPromptClick: (prompt: string) => void }) {
  return (
    <section className="mt-12">
      <style>{`
        @keyframes ai-glow {
          0%, 100% { box-shadow: 0 8px 32px rgba(124,58,255,0.25); }
          50% { box-shadow: 0 8px 40px rgba(124,58,255,0.4), 0 0 60px rgba(124,58,255,0.15); }
        }
        @keyframes ai-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes ai-card-enter {
          from { opacity: 0; transform: translateY(12px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes ai-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        .ai-glow { animation: ai-glow 3s ease-in-out infinite; }
        .ai-card-enter { animation: ai-card-enter 0.5s ease-out forwards; }
        .ai-float { animation: ai-float 4s ease-in-out infinite; }
      `}</style>

      {/* Header block — gradient + glow */}
      <div
        className="rounded-2xl p-6 mb-5 ai-glow relative overflow-hidden"
        style={{
          background: "linear-gradient(145deg, rgba(124,58,255,0.18), rgba(0,200,255,0.1))",
          border: "1px solid rgba(124,58,255,0.35)",
        }}
      >
        {/* Shimmer overlay */}
        <div
          className="absolute inset-0 opacity-30 pointer-events-none"
          style={{
            background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)",
            backgroundSize: "200% 100%",
            animation: "ai-shimmer 8s linear infinite",
          }}
        />
        <div className="flex items-start gap-4 relative">
          <div
            className="shrink-0 p-3 rounded-2xl ai-float"
            style={{
              background: "linear-gradient(135deg, var(--purple), var(--blue))",
              boxShadow: "0 8px 24px rgba(124,58,255,0.4)",
            }}
          >
            <Wand2 className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-black text-lg text-[var(--text-primary)]">Generate image with AI</h3>
            <p className="text-sm text-[var(--text-muted)] font-semibold mt-1">
              Tap a prompt → opens ChatGPT (app on mobile). Paste & generate, then upload here.
            </p>
            <button
              type="button"
              onClick={() => onPromptClick("Funny feedback or roast reaction image, viral meme style, bold typography")}
              className="mt-4 w-full py-3.5 px-5 rounded-xl font-bold text-sm flex items-center justify-center gap-2.5 transition-all duration-300 hover:scale-[1.03] active:scale-[0.97] touch-manipulation"
              style={{
                background: "linear-gradient(135deg, var(--purple), var(--blue))",
                color: "white",
                boxShadow: "0 4px 24px rgba(124,58,255,0.4)",
                touchAction: "manipulation",
              }}
            >
              <Sparkles className="w-5 h-5" />
              Open ChatGPT & generate image
            </button>
          </div>
        </div>
      </div>

      {/* Prompts grid — staggered animation */}
      <p className="text-[11px] font-bold text-[var(--text-muted)] mb-3 uppercase tracking-wider">
        Tap any prompt to copy & open
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {IMAGE_PROMPTS.map((prompt, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onPromptClick(prompt)}
            className="ai-card-enter text-left p-4 rounded-xl transition-all duration-300 hover:scale-[1.02] hover:-translate-y-0.5 active:scale-[0.98] touch-manipulation group"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
              animationDelay: `${i * 50}ms`,
            }}
          >
            <span className="text-sm font-semibold text-[var(--text-primary)] group-hover:text-[var(--purple)] transition-colors line-clamp-2">
              {prompt}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
