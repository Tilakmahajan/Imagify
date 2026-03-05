import Link from "next/link";
import { Flame, MessageCircle, Star, Zap, Target, ScanLine, Sparkles, Upload, Link2, Camera, Heart, Skull, HandMetal, Eye, Rocket, ChevronDown, Share2, Inbox } from "lucide-react";
import { AnimateOnScroll } from "@/components/AnimateOnScroll";
import { MobileNav } from "@/components/MobileNav";
import { ImageShowcase } from "@/components/ImageShowcase";
import { ImageResponseCards } from "@/components/ImageResponseCards";
import { ThemeToggle } from "@/components/ThemeToggle";
import { GoogleAd } from "@/components/GoogleAd";

const MARQUEE_ITEMS: { Icon: typeof Flame; label: string }[] = [
  { Icon: Flame, label: "roast me" },
  { Icon: MessageCircle, label: "spill the tea" },
  { Icon: Star, label: "rate this" },
  { Icon: Zap, label: "be honest" },
  { Icon: MessageCircle, label: "no filter" },
  { Icon: Eye, label: "screenshot review" },
  { Icon: Skull, label: "love it or hate it" },
  { Icon: Target, label: "3 words" },
  { Icon: ScanLine, label: "mirror check" },
  { Icon: Sparkles, label: "glow up or no" },
];

export default function Home() {
  return (
    <div
      className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] overflow-x-hidden"
      style={{ fontFamily: "'Nunito', var(--font-nunito), sans-serif" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');

        :root {
          --pink: #FF3D7F;
          --purple: #7C3AFF;
          --blue: #00C8FF;
          --yellow: #FFE500;
          --green: #00FF94;
          --bg: var(--bg-primary);
        }

        /* ── Grain overlay ── */
        body::before {
          content: '';
          position: fixed;
          inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E");
          pointer-events: none;
          z-index: 9999;
          opacity: 0.35;
        }

        /* ── Scrollbar ── */
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: var(--bg-primary); }
        ::-webkit-scrollbar-thumb { background: var(--purple); border-radius: 99px; }

        /* ── Marquee ── */
        @keyframes marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .marquee-track { display: flex; width: max-content; animation: marquee 18s linear infinite; }
        .marquee-track:hover { animation-play-state: paused; }

        /* ── Float ── */
        @keyframes float { 0%,100%{transform:translateY(0) rotate(var(--r,0deg))} 50%{transform:translateY(-14px) rotate(var(--r,0deg))} }
        .float { animation: float 4s ease-in-out infinite; }

        /* ── Wiggle ── */
        @keyframes wiggle { 0%,100%{transform:rotate(-4deg)} 50%{transform:rotate(4deg)} }
        .wiggle { animation: wiggle 2.4s ease-in-out infinite; }

        /* ── Slot machine ── */
        @keyframes slot {
          0%   { transform: translateY(0); }
          18%  { transform: translateY(-20%); }
          36%  { transform: translateY(-40%); }
          54%  { transform: translateY(-60%); }
          72%  { transform: translateY(-80%); }
          90%  { transform: translateY(-80%); }
          100% { transform: translateY(0); }
        }
        .slot { animation: slot 7s cubic-bezier(0.25,0.46,0.45,0.94) infinite; }

        /* ── Fade up ── */
        @keyframes fadeUp { from{opacity:0;transform:translateY(32px)} to{opacity:1;transform:translateY(0)} }
        .fade-up { animation: fadeUp 0.7s ease forwards; }
        .delay-1 { animation-delay: 0.15s; opacity: 0; }
        .delay-2 { animation-delay: 0.3s; opacity: 0; }
        .delay-3 { animation-delay: 0.45s; opacity: 0; }
        .delay-4 { animation-delay: 0.6s; opacity: 0; }

        /* ── Pop in ── */
        @keyframes popIn { 0%{opacity:0;transform:scale(0.5) rotate(-10deg)} 70%{transform:scale(1.08) rotate(2deg)} 100%{opacity:1;transform:scale(1) rotate(0deg)} }
        .pop-in { animation: popIn 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards; }

        /* ── Sticker badge ── */
        .sticker {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 10px 20px;
          border-radius: 9999px;
          font-weight: 900;
          font-size: 0.95rem;
          letter-spacing: -0.01em;
          border: 2.5px solid rgba(255,255,255,0.25);
          backdrop-filter: blur(12px);
          white-space: nowrap;
          cursor: default;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .sticker:hover { transform: scale(1.08) rotate(-2deg) !important; }

        /* ── Outlined text ── */
        .text-outline {
          -webkit-text-stroke: 3px white;
          color: transparent;
        }

        /* ── Neon glow ── */
        .glow-pink  { text-shadow: 0 0 40px rgba(255,61,127,0.8), 0 0 80px rgba(255,61,127,0.4); }
        .glow-blue  { text-shadow: 0 0 40px rgba(0,200,255,0.8), 0 0 80px rgba(0,200,255,0.4); }
        .glow-green { text-shadow: 0 0 40px rgba(0,255,148,0.8), 0 0 80px rgba(0,255,148,0.4); }

        /* ── Step card ── */
        .step-card {
          background: var(--bg-card);
          border: 1.5px solid var(--border);
          border-radius: 24px;
          padding: 32px;
          transition: transform 0.3s, border-color 0.3s, box-shadow 0.3s;
          position: relative;
          overflow: hidden;
        }
        .step-card::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse at top left, var(--card-glow, rgba(124,58,255,0.12)) 0%, transparent 65%);
          pointer-events: none;
        }
        .step-card:hover {
          transform: translateY(-6px) rotate(-0.5deg);
          border-color: var(--border);
          box-shadow: 0 32px 64px rgba(0,0,0,0.5);
        }

        /* ── Navbar glass (theme from globals) ── */
        .navbar-glass { border-bottom: 1px solid var(--border); }

        /* ── CTA button ── */
        .cta-btn {
          position: relative;
          overflow: hidden;
          transition: transform 0.25s, box-shadow 0.25s;
        }
        .cta-btn::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 60%);
          pointer-events: none;
        }
        .cta-btn:hover { transform: scale(1.05) translateY(-2px); box-shadow: 0 16px 48px rgba(255,61,127,0.5); }
        .cta-btn:active { transform: scale(0.97); }

        /* ── Photo card ── */
        .photo-card {
          position: relative;
          transition: transform 0.4s cubic-bezier(0.34,1.56,0.64,1);
        }
        .photo-card:hover { transform: scale(1.04) rotate(0deg) !important; }

        /* ── Pill nav link ── */
        .nav-pill {
          padding: 6px 16px;
          border-radius: 9999px;
          font-weight: 800;
          font-size: 0.9rem;
          color: rgba(255,255,255,0.7);
          transition: background 0.2s, color 0.2s;
        }
        .nav-pill:hover {
          background: rgba(255,255,255,0.1);
          color: #fff;
        }

        /* ── Section divider ── */
        .slash-divider {
          width: 100%;
          height: 80px;
          background: linear-gradient(135deg, #FF3D7F, #7C3AFF, #00C8FF);
          clip-path: polygon(0 0, 100% 0, 100% 40%, 0 100%);
        }

        /* ── Footer link ── */
        .footer-link { color: var(--text-muted); font-weight: 700; transition: color 0.2s; }
        .footer-link:hover { color: var(--text-primary); }
      `}</style>

      {/* ================================================================
          NAVBAR
      ================================================================ */}
      <header className="fixed top-0 left-0 right-0 z-50 navbar-glass">
        <nav className="flex h-16 items-center justify-between px-6 sm:px-10 max-w-7xl mx-auto">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <span
              className="text-2xl font-black tracking-tight text-[var(--text-primary)] transition-all duration-300 group-hover:scale-105 inline-block"
              style={{ letterSpacing: "-0.04em" }}
            >
              picpop
              <span className="text-[var(--pink)]">.</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            <Link href="#how" className="nav-pill">how it works</Link>
            <Link href="#play" className="nav-pill">play</Link>
          </div>

          {/* CTA */}
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="hidden sm:inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-black text-white cta-btn"
              style={{
                background: "linear-gradient(135deg, var(--pink), var(--purple))",
                boxShadow: "0 4px 20px rgba(255,61,127,0.4)",
              }}
            >
              <span className="inline-flex items-center gap-2">give feedback <Sparkles className="w-4 h-4" /></span>
            </Link>
            <MobileNav />
          </div>
        </nav>
      </header>


      {/* ================================================================
          HERO
      ================================================================ */}
      <section
        className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden"
        style={{ background: "radial-gradient(ellipse at 50% 0%, #1a0533 0%, var(--bg-primary) 65%)" }}
      >
        {/* Background grid */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.06]"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />

        {/* Gradient blobs */}
        <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] rounded-full blur-[120px] opacity-20 pointer-events-none"
          style={{ background: "var(--purple)" }} />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full blur-[100px] opacity-15 pointer-events-none"
          style={{ background: "var(--pink)" }} />

        {/* ── LEFT PHOTO ── */}
        <div
          className="photo-card absolute left-[2%] top-1/2 hidden lg:block"
          style={{ transform: "translateY(-54%) rotate(-9deg)", zIndex: 10, animationDelay: "200ms" }}
        >
          <div
            className="p-[5px] rounded-[26px]"
            style={{
              background: "linear-gradient(135deg, var(--pink), var(--purple), var(--blue))",
              boxShadow: "0 30px 80px rgba(255,61,127,0.4), 0 0 0 1px rgba(255,255,255,0.05)",
            }}
          >
            <div className="w-[200px] h-[260px] xl:w-[230px] xl:h-[300px] rounded-[22px] overflow-hidden bg-black relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/image (1).jpg" alt="feedback preview" className="w-full h-full object-cover" />
              {/* Overlay shimmer */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
            </div>
          </div>
        </div>

        {/* ── RIGHT PHOTO ── */}
        <div
          className="photo-card absolute right-[2%] top-1/2 hidden lg:block"
          style={{ transform: "translateY(-44%) rotate(7deg)", zIndex: 10 }}
        >
          <div
            className="p-[5px] rounded-[26px]"
            style={{
              background: "linear-gradient(135deg, var(--blue), var(--purple), var(--pink))",
              boxShadow: "0 30px 80px rgba(0,200,255,0.35), 0 0 0 1px rgba(255,255,255,0.05)",
            }}
          >
            <div className="w-[200px] h-[260px] xl:w-[230px] xl:h-[300px] rounded-[22px] overflow-hidden bg-black relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/image (2).jpg" alt="feedback preview" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
            </div>
          </div>
        </div>

        {/* ── Floating 3D objects ── */}
        <div className="absolute hidden sm:block float" style={{ top: "9%", left: "7%", zIndex: 20, "--r": "-6deg" } as React.CSSProperties}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/image1.png" alt="" className="w-28 h-28 md:w-40 md:h-40 xl:w-44 xl:h-44 object-contain"
            style={{ filter: "drop-shadow(0 20px 40px rgba(0,0,0,0.6))" }} />
        </div>
        <div className="absolute hidden sm:block float" style={{ top: "7%", right: "6%", zIndex: 20, animationDelay: "0.7s", "--r": "5deg" } as React.CSSProperties}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/image2.png" alt="" className="w-32 h-32 md:w-44 md:h-44 xl:w-52 xl:h-52 object-contain"
            style={{ filter: "drop-shadow(0 20px 40px rgba(0,0,0,0.5))" }} />
        </div>
        <div className="absolute hidden md:block float" style={{ bottom: "8%", left: "12%", zIndex: 20, animationDelay: "0.4s", animationDuration: "5s" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/image3.png" alt="" className="w-20 h-20 md:w-28 md:h-28 xl:w-32 xl:h-32 object-contain"
            style={{ filter: "drop-shadow(0 12px 28px rgba(0,0,0,0.5))" }} />
        </div>

        {/* ── Hero text ── */}
        <div className="relative text-center px-4" style={{ zIndex: 30 }}>
          {/* Label pill */}
          <div className="fade-up flex justify-center mb-6">
            <div
              className="sticker text-xs"
              style={{ background: "rgba(255,255,255,0.08)", border: "1.5px solid rgba(255,255,255,0.15)" }}
            >
              <span className="w-2 h-2 rounded-full bg-[var(--green)] inline-block" style={{ boxShadow: "0 0 8px var(--green)" }} />
              anonymous. no limits.
            </div>
          </div>

          <h1
            className="font-black text-white leading-[0.9] tracking-tight"
            style={{ fontSize: "clamp(4rem, 11vw, 9rem)", fontFamily: "var(--font-nunito), 'Nunito'" }}
          >
            <span className="fade-up block">real</span>
            <span className="fade-up delay-1 block text-outline">feedback.</span>
            <span className="fade-up delay-2 block" style={{ color: "var(--pink)" }}>real vibes.</span>
          </h1>

          <p className="fade-up delay-3 mt-6 text-white/60 max-w-xs mx-auto font-semibold text-base sm:text-lg">
            Drop a pic. Get anonymous reactions. No cap.
          </p>

          <div className="fade-up delay-4 mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/dashboard"
              className="cta-btn rounded-full px-10 py-4 font-black text-white text-base"
              style={{
                background: "linear-gradient(135deg, var(--pink) 0%, var(--purple) 100%)",
                boxShadow: "0 8px 40px rgba(255,61,127,0.5)",
              }}
            >
              <span className="inline-flex items-center gap-2">drop your feedback <Rocket className="w-4 h-4" /></span>
            </Link>
            <Link
              href="#play"
              className="rounded-full px-8 py-4 font-black text-white/70 text-base border border-white/10 hover:border-white/30 hover:text-white transition-all duration-200"
            >
              <span className="inline-flex items-center gap-1.5">see how it works <ChevronDown className="w-4 h-4" /></span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── MARQUEE DIVIDER ── */}
      <div className="overflow-hidden border-y border-white/08 py-4" style={{ background: "#0f0f0f" }}>
        <div className="marquee-track">
          {Array(2).fill(MARQUEE_ITEMS).flat().map((item, i) => {
            const Icon = item.Icon;
            return (
              <span key={i} className="mx-6 text-sm font-black text-white/30 uppercase tracking-widest flex-shrink-0 inline-flex items-center gap-1.5">
                <Icon className="w-4 h-4 shrink-0" /> {item.label}
              </span>
            );
          })}
        </div>
      </div>


      {/* ================================================================
          SECTION 2: PLAY FEEDBACK GAMES
      ================================================================ */}
      <section id="play" className="relative bg-[var(--bg)] min-h-screen flex items-center overflow-hidden py-24 px-4 sm:px-6">

        {/* Subtle background */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full blur-[120px] opacity-10"
            style={{ background: "var(--blue)" }} />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full blur-[100px] opacity-10"
            style={{ background: "var(--pink)" }} />
        </div>

        {/* ── 3D objects ── */}
        <div className="absolute top-10 left-[5%] float hidden sm:block" style={{ zIndex: 5, animationDuration: "4s" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/image1.png" alt="" className="w-28 h-28 md:w-36 md:h-36 object-contain opacity-70"
            style={{ filter: "drop-shadow(0 16px 32px rgba(0,0,0,0.8))" }} />
        </div>
        <div className="absolute top-8 right-[4%] float hidden sm:block" style={{ zIndex: 5, animationDuration: "5s", animationDelay: "0.6s" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/image2.png" alt="" className="w-32 h-32 md:w-44 md:h-44 object-contain opacity-70"
            style={{ filter: "drop-shadow(0 16px 32px rgba(0,0,0,0.7))" }} />
        </div>
        <div className="absolute bottom-10 left-[3%] float hidden md:block" style={{ zIndex: 5, animationDelay: "0.3s", animationDuration: "6s" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/image3.png" alt="" className="w-24 h-24 md:w-32 md:h-32 object-contain opacity-70"
            style={{ filter: "drop-shadow(0 12px 24px rgba(0,0,0,0.7))" }} />
        </div>

        {/* ── Left response image bubbles ── */}
        {[
          { src: "/images/response.png", top: "18%", delay: "0.8s", rot: "-5deg" },
          { src: "/images/response1.png", top: "54%", delay: "1.4s", rot: "3deg" },
        ].map((b, i) => {
          return (
          <div key={i} className="absolute left-[2%] sm:left-[4%] hidden lg:block float" style={{ top: b.top, zIndex: 10, animationDelay: b.delay, animationDuration: "5s" }}>
            <div className="relative" style={{ transform: `rotate(${b.rot})` }}>
              <div className="p-[3px] rounded-2xl" style={{ background: "linear-gradient(135deg,rgba(255,61,127,0.8),rgba(124,58,255,0.8))", boxShadow: "0 20px 50px rgba(0,0,0,0.6)" }}>
                <div className="w-[130px] h-[155px] rounded-xl overflow-hidden bg-black">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={b.src} alt="response" className="w-full h-full object-cover" />
                </div>
              </div>
            </div>
          </div>
          );
        })}

        {/* ── Right response image bubbles ── */}
        {[
          { src: "/images/response3.jpg", top: "20%", delay: "1s", rot: "5deg" },
          { src: "/images/response4.jpg", top: "55%", delay: "0.5s", rot: "-4deg" },
        ].map((b, i) => {
          return (
          <div key={i} className="absolute right-[2%] sm:right-[4%] hidden lg:block float" style={{ top: b.top, zIndex: 10, animationDelay: b.delay, animationDuration: "4.8s" }}>
            <div className="relative" style={{ transform: `rotate(${b.rot})` }}>
              <div className="p-[3px] rounded-2xl" style={{ background: "linear-gradient(135deg,rgba(0,200,255,0.8),rgba(255,61,127,0.8))", boxShadow: "0 20px 50px rgba(0,0,0,0.6)" }}>
                <div className="w-[130px] h-[155px] rounded-xl overflow-hidden bg-black">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={b.src} alt="response" className="w-full h-full object-cover" />
                </div>
              </div>
            </div>
          </div>
          );
        })}

        {/* ── Central content ── */}
        <div className="relative max-w-2xl mx-auto text-center" style={{ zIndex: 20 }}>
          <AnimateOnScroll>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-white/30 mb-4">feedback games</p>
            <h2
              className="font-black leading-[0.88] tracking-tight"
              style={{ fontSize: "clamp(3.8rem, 12vw, 9rem)", fontFamily: "var(--font-nunito), 'Nunito'" }}
            >
              <span className="text-white block">play</span>
              <span className="text-outline block">feedback</span>
              <span className="block" style={{ color: "var(--blue)" }}>games</span>
            </h2>
          </AnimateOnScroll>

          {/* Slot machine */}
          <AnimateOnScroll delay={200}>
            <div
              className="mt-8 mx-auto overflow-hidden rounded-2xl border border-white/10"
              style={{ height: "clamp(3rem, 8vw, 5.5rem)", background: "rgba(255,255,255,0.04)", maxWidth: "480px" }}
            >
              <div className="slot" style={{ height: "500%" }}>
                {[
                  { label: "roast me", Icon: Flame, color: "var(--pink)" },
                  { label: "rate this", Icon: Star, color: "var(--yellow)" },
                  { label: "screenshot review", Icon: Camera, color: "var(--blue)" },
                  { label: "3 words only", Icon: HandMetal, color: "var(--green)" },
                  { label: "love it or hate it", Icon: Skull, color: "#fff" },
                ].map((item, i) => {
                  const SlotIcon = item.Icon;
                  return (
                  <div
                    key={i}
                    className="flex items-center justify-center gap-2 font-black"
                    style={{
                      height: "20%",
                      fontSize: "clamp(1.6rem, 5vw, 3.5rem)",
                      fontFamily: "var(--font-nunito), 'Nunito'",
                      color: item.color,
                      lineHeight: 1,
                    }}
                  >
                    <SlotIcon className="w-8 h-8 shrink-0" /> {item.label}
                  </div>
                  );
                })}
              </div>
            </div>
          </AnimateOnScroll>

          {/* Mobile response image cards */}
          <AnimateOnScroll delay={350}>
            <div className="mt-10 flex flex-wrap justify-center gap-4 lg:hidden">
              {[
                { src: "/images/response.png", bg: "linear-gradient(135deg,#FF3D7F,#7C3AFF)", rot: "-3deg" },
                { src: "/images/response1.png", bg: "linear-gradient(135deg,#7C3AFF,#00C8FF)", rot: "2deg" },
                { src: "/images/response2.png", bg: "linear-gradient(135deg,#00C8FF,#FF3D7F)", rot: "-2deg" },
                { src: "/images/response3.jpg", bg: "linear-gradient(135deg,#FF3D7F,#FFE500)", rot: "3deg" },
              ].map((r, i) => {
                return (
                <div key={i} className="relative" style={{ transform: `rotate(${r.rot})` }}>
                  <div className="p-[3px] rounded-xl shadow-xl" style={{ background: r.bg }}>
                    <div className="w-20 h-24 rounded-lg overflow-hidden bg-black">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={r.src} alt="response" className="w-full h-full object-cover" />
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          </AnimateOnScroll>
        </div>
      </section>


      {/* ================================================================
          SECTION 2.5: IMAGE SHOWCASE
      ================================================================ */}
      <section className="relative bg-[#0d0d0d] py-20 sm:py-28 px-4 sm:px-6 overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full opacity-15 blur-3xl pointer-events-none"
          style={{ background: "var(--pink)" }} />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 rounded-full opacity-15 blur-3xl pointer-events-none"
          style={{ background: "var(--purple)" }} />

        <div className="max-w-6xl mx-auto">
          <AnimateOnScroll>
            <div className="text-center mb-16">
              <p className="text-xs font-black uppercase tracking-[0.3em] text-white/30 mb-3">in action</p>
              <h2 className="font-black text-white" style={{ fontSize: "clamp(2.5rem, 7vw, 5rem)", fontFamily: "var(--font-nunito), 'Nunito'" }}>
                see it{" "}
                <span
                  className="bg-clip-text text-transparent"
                  style={{ backgroundImage: "linear-gradient(90deg, var(--pink), var(--purple), var(--blue))" }}
                >
                  live
                </span>
              </h2>
              <p className="mt-3 text-white/40 text-base sm:text-lg font-semibold">Drop any image. Get real, anonymous reactions instantly.</p>
            </div>
          </AnimateOnScroll>
          <ImageShowcase />
        </div>
      </section>


      {/* ================================================================
          SECTION 3: HOW IT WORKS
      ================================================================ */}
      <section id="how" className="relative py-24 sm:py-32 px-4 sm:px-6 overflow-hidden" style={{ background: "var(--bg-primary)" }}>

        {/* Gradient top accent */}
        <div className="absolute top-0 left-0 right-0 h-px"
          style={{ background: "linear-gradient(90deg, transparent, var(--purple), var(--pink), transparent)" }} />

        <div className="max-w-5xl mx-auto">
          <AnimateOnScroll>
            <div className="text-center mb-16">
              <p className="text-xs font-black uppercase tracking-[0.3em] text-[var(--text-muted)] mb-3">get to know</p>
              <h2
                className="font-black text-[var(--text-primary)] leading-[0.9]"
                style={{ fontSize: "clamp(3rem, 9vw, 7rem)", fontFamily: "var(--font-nunito), 'Nunito'" }}
              >
                your{" "}
                <span className="text-outline">audience</span>
              </h2>
              <p className="mt-5 text-white/50 text-base sm:text-lg font-semibold max-w-md mx-auto">
                Share your link. Friends visit it and send you images — anonymously. No sign-up for them. Real feedback in your inbox.
              </p>
            </div>
          </AnimateOnScroll>

          {/* Step cards */}
          <div className="grid sm:grid-cols-3 gap-5">
            {[
              { step: "01", Icon: Link2, title: "Get your link", desc: "Sign up, create your ID, get your unique feedback link from the dashboard.", color: "var(--pink)", glow: "rgba(255,61,127,0.12)" },
              { step: "02", Icon: Share2, title: "Share your link", desc: "Send it to friends, group chat, story, or anywhere. One tap to copy or share.", color: "var(--purple)", glow: "rgba(124,58,255,0.12)" },
              { step: "03", Icon: Inbox, title: "Get real reactions", desc: "They send you images anonymously. You see everything in your inbox. No sugarcoating.", color: "var(--blue)", glow: "rgba(0,200,255,0.12)" },
            ].map((s, i) => {
              const StepIcon = s.Icon;
              return (
              <AnimateOnScroll key={i} delay={i * 120}>
                <div className="step-card h-full" style={{ "--card-glow": s.glow } as React.CSSProperties}>
                  <div className="mb-4"><StepIcon className="w-10 h-10" style={{ color: s.color }} /></div>
                  <div className="text-xs font-black uppercase tracking-widest mb-2" style={{ color: s.color }}>{s.step}</div>
                  <h3 className="text-xl font-black text-white mb-2">{s.title}</h3>
                  <p className="text-white/40 font-semibold text-sm leading-relaxed">{s.desc}</p>
                </div>
              </AnimateOnScroll>
              );
            })}
          </div>

          {/* Image response cards */}
          <AnimateOnScroll delay={400}>
            <ImageResponseCards />
          </AnimateOnScroll>
        </div>
      </section>

      {process.env.NEXT_PUBLIC_ADSENSE_SLOT && (
        <div className="max-w-5xl mx-auto px-4">
          <GoogleAd slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT} format="horizontal" />
        </div>
      )}

      {/* ================================================================
          SECTION 4: JOIN THE VIBE (CTA)
      ================================================================ */}
      <section className="relative overflow-hidden py-28 sm:py-36 px-4 sm:px-6">
        {/* Full bleed gradient */}
        <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, #FF3D7F 0%, #7C3AFF 50%, #00C8FF 100%)" }} />
        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        {/* Floating icons */}
        <div className="absolute top-12 left-[8%] float opacity-70"><Sparkles className="w-12 h-12 text-white/80" /></div>
        <div className="absolute bottom-12 right-[8%] float opacity-70" style={{ animationDelay: "1s" }}><MessageCircle className="w-12 h-12 text-white/80" /></div>
        <div className="absolute top-16 right-[20%] float opacity-50" style={{ animationDelay: "0.5s" }}><Sparkles className="w-8 h-8 text-white/70" /></div>
        <div className="absolute bottom-20 left-[20%] float opacity-50" style={{ animationDelay: "1.5s" }}><MessageCircle className="w-8 h-8 text-white/70" /></div>

        <div className="max-w-3xl mx-auto text-center relative z-10">
          <AnimateOnScroll>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-white/60 mb-4">ready?</p>
            <h2
              className="font-black text-white leading-[0.9]"
              style={{ fontSize: "clamp(3.5rem, 11vw, 8rem)", fontFamily: "var(--font-nunito), 'Nunito'" }}
            >
              join the
              <br />
              <span style={{ WebkitTextStroke: "3px rgba(255,255,255,0.9)", color: "transparent" }}>vibe</span>
            </h2>
            <p className="mt-5 text-white/80 text-lg font-bold">No sign up. No stress. Just vibes.</p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/dashboard"
                className="cta-btn rounded-full px-12 py-5 font-black text-lg"
                style={{
                  background: "#fff",
                  color: "#7C3AFF",
                  boxShadow: "0 8px 40px rgba(0,0,0,0.3)",
                }}
              >
                <span className="inline-flex items-center gap-2">start now <Sparkles className="w-5 h-5" /></span>
              </Link>
            </div>
          </AnimateOnScroll>
        </div>
      </section>


      {/* ================================================================
          FOOTER
      ================================================================ */}
      <footer className="border-t border-white/06 bg-[#080808] py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex flex-col items-center sm:items-start gap-1">
            <span
              className="text-xl font-black bg-clip-text text-transparent"
              style={{ backgroundImage: "linear-gradient(90deg, var(--pink), var(--purple))" }}
            >
              picpop.
            </span>
            <p className="text-xs text-white/20 font-semibold">anonymous image feedback</p>
          </div>

          <div className="flex flex-wrap justify-center gap-6 text-sm">
            <Link href="#how" className="footer-link">how it works</Link>
            <Link href="#play" className="footer-link">play</Link>
            <Link href="/dashboard" className="footer-link">give feedback</Link>
          </div>

          {/* Social-style pill */}
          <div
            className="sticker text-xs"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <span className="w-2 h-2 rounded-full bg-[var(--green)] inline-block" style={{ boxShadow: "0 0 6px var(--green)" }} />
            live & free
          </div>
        </div>
        <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-white/15"><Sparkles className="w-3.5 h-3.5 shrink-0" />  © {new Date().getFullYear()} picpop — made with chaos</p>
      </footer>

    </div>
  );
}
