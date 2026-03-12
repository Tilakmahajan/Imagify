"use client";

import Link from "next/link";
import { ArrowLeft, ShieldCheck, Lock, Eye, Trash2 } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function PrivacyPage() {
  return (
    <div
      className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] px-4 sm:px-6 py-12"
      style={{ fontFamily: "'Nunito', var(--font-nunito), sans-serif" }}
    >
      <style>{`
        .privacy-card {
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 2rem;
        }
      `}</style>

      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <header className="flex items-center justify-between mb-12">
          <Link href="/" className="flex items-center gap-2 group">
             <img src="/logo.svg" alt="picpop" className="h-6 w-auto" />
          </Link>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Link href="/" className="flex items-center gap-1.5 text-sm font-bold text-[var(--text-muted)] hover:text-white transition-colors">
              <ArrowLeft className="w-4 h-4" /> back
            </Link>
          </div>
        </header>

        <div className="privacy-card p-8 sm:p-12">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center">
              <ShieldCheck className="w-7 h-7 text-blue-400" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-white">Privacy Policy</h1>
              <p className="text-[var(--text-muted)] font-bold text-sm uppercase tracking-widest mt-1">Updated: March 2026</p>
            </div>
          </div>

          <div className="prose prose-invert prose-sm max-w-none space-y-10">
            <p className="text-lg text-white/70 leading-relaxed">
              At PicPop, we prioritize your privacy while enabling social interaction. This policy outlines how we handle your data across our platform.
            </p>

            <section className="space-y-4">
              <h2 className="text-xl font-black text-white flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-xs">01</span>
                Information We Collect
              </h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="p-5 rounded-2xl bg-white/5 border border-white/5 space-y-2">
                  <div className="flex items-center gap-2 text-white font-bold">
                    <Lock className="w-4 h-4 text-purple-400" /> Account Data
                  </div>
                  <p className="text-sm text-white/40">We store your CoolId, display name, and authentication details via secure Firebase sessions.</p>
                </div>
                <div className="p-5 rounded-2xl bg-white/5 border border-white/5 space-y-2">
                  <div className="flex items-center gap-2 text-white font-bold">
                    <Eye className="w-4 h-4 text-pink-400" /> Usage Logs
                  </div>
                  <p className="text-sm text-white/40">Anonymous device data, IP addresses (for security), and activity logs help us improve service quality.</p>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-black text-white flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-xs">02</span>
                How We Use Data
              </h2>
              <p className="text-white/50 leading-relaxed">
                Your data is used solely to operate the platform, manage notifications, prevent harassment, and analyze global usage trends via <strong>Google Analytics</strong> and <strong>Microsoft Clarity</strong>. We never use your images for AI training or external advertising.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-black text-white flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-xs">03</span>
                Sharing & Disclosure
              </h2>
              <p className="text-white/50 leading-relaxed">
                We do <strong>not</strong> sell your data. Information is shared with service providers (Firebase, Vercel) only as necessary to host the application. We may disclose data if required by legal mandates or to protect users from imminent harm.
              </p>
            </section>

            <section className="space-y-4 p-6 rounded-[2rem] bg-red-500/5 border border-red-500/10">
              <h2 className="text-xl font-black text-red-400 flex items-center gap-3">
                <Trash2 className="w-6 h-6" /> Data Deletion
              </h2>
              <p className="text-red-100/60 leading-relaxed">
                You have full control over your data. You can request account deletion at any time. Upon deletion, your profile data and uploaded images are permanently removed from our active production database.
              </p>
            </section>
          </div>

          <div className="mt-12 pt-8 border-t border-white/5 text-center">
            <p className="text-xs text-[var(--text-muted)] font-bold italic">
              Questions? Contact us through our official social channels.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
