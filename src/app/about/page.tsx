"use client";

import Link from "next/link";
import { ArrowLeft, Info, HelpCircle, Shield, Globe } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function AboutPage() {
  return (
    <div
      className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] px-4 sm:px-6 py-12"
      style={{ fontFamily: "'Nunito', var(--font-nunito), sans-serif" }}
    >
      <style>{`
        .about-card {
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

        <div className="about-card p-8 sm:p-12">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center">
              <Info className="w-7 h-7 text-blue-400" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-white">About PicPop</h1>
              <p className="text-[var(--text-muted)] font-bold text-sm uppercase tracking-widest mt-1">Our Mission & Approach</p>
            </div>
          </div>

          <div className="prose prose-invert prose-sm max-w-none space-y-10">
            <section className="space-y-4">
              <h2 className="text-xl font-black text-white flex items-center gap-3">
                <Globe className="w-6 h-6 text-blue-400" />
                What is PicPop?
              </h2>
              <p className="text-white/70 leading-relaxed text-lg">
                PicPop is a platform designed to foster genuine, unvarnished communication through the use of imagery and anonymity. In a world full of curated feeds and filtered realities, PicPop provides a space where individuals can receive honest, anonymous reactions to their photos. 
              </p>
              <p className="text-white/70 leading-relaxed">
                Whether you are seeking constructive feedback on an outfit, an honest opinion on a new hairstyle, or just want to playfully banter with friends, our platform is built to deliver real-time image-based interactions without the pressure of public likes or vanity metrics.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-black text-white flex items-center gap-3">
                <HelpCircle className="w-6 h-6 text-green-400" />
                How It Works
              </h2>
              <p className="text-white/70 leading-relaxed">
                Using PicPop is straightforward and requires no complex setup:
              </p>
              <ul className="list-disc pl-5 space-y-3 text-white/70">
                <li><strong>Claim Your Space:</strong> Create a unique username on our dashboard. No emails or phone numbers required.</li>
                <li><strong>Share Your Link:</strong> Post your custom link on your social media profiles, group chats, or stories.</li>
                <li><strong>Receive Feedback:</strong> Visitors to your link can upload and send images directly to you completely anonymously. They don't need to download an app or even create an account.</li>
                <li><strong>Review in Private:</strong> Check your inbox for the visual feedback. It's just between you and the sender, allowing for unfiltered honesty.</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-black text-white flex items-center gap-3">
                <Shield className="w-6 h-6 text-purple-400" />
                Safety & Moderation
              </h2>
              <p className="text-white/70 leading-relaxed">
                While anonymity encourages honesty, we are deeply committed to user safety. We employ advanced moderation technology, and provide straightforward reporting and blocking tools. If any piece of feedback violates our Terms of Service—such as containing harassment, explicit content, or illegal material—our system and administrative team work swiftly to remove the content and ban malicious users. 
              </p>
              <p className="text-white/70 leading-relaxed">
                Our mission is to maintain an environment that is fun, engaging, and secure. We believe that technology should empower users to connect authentically without compromising their digital wellbeing.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
