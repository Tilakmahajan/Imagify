"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Lock, Sparkles, MessageCircle, ArrowLeft } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function LoginPage() {
  const { user, profile, loading, isConfigured, signInWithGoogle, signInWithFacebook, signInWithYahoo } = useAuth();
  const toast = useToast();

  useEffect(() => {
    console.log("[Login] state:", { loading, hasUser: !!user, hasProfile: !!profile, coolId: profile?.coolId });
    if (loading) return;
    if (!user) return;
    if (!profile) return;

    console.log("[Login] User + profile ready, redirecting...", { coolId: profile.coolId });
    if (profile.coolId) {
      window.location.replace("/dashboard");
    } else {
      window.location.replace("/create-id");
    }
  }, [user, profile, loading]);

  const handleSignIn = async (fn: () => Promise<void>, provider: string) => {
    console.log("[Login] handleSignIn clicked:", provider);
    try {
      await fn();
      console.log("[Login] handleSignIn:", provider, "completed (popup/redirect should have opened)");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("auth/popup-closed-by-user")) {
        toast.info("Sign-in cancelled.");
        return;
      }
      console.error(`[Auth] ${provider} sign-in failed:`, err);
      if (msg.includes("auth/popup-blocked") || msg.includes("popup")) {
        toast.info("Pop-up was blocked. Allow popups or try again (will use redirect).");
      } else if (msg.includes("auth/unauthorized-domain")) {
        toast.error("Domain not authorized. Add this URL to Firebase Console → Authentication → Settings → Authorized domains.");
      } else if (msg.includes("auth/") || msg.includes("network")) {
        toast.error(`Sign-in failed: ${msg.slice(0, 80)}`);
      } else {
        toast.error(`Sign-in failed: ${msg.slice(0, 80)}`);
      }
    }
  };

  // Show loader: initial auth load, or user signed in (waiting for profile or redirecting)
  const isRedirecting = !!user;
  if (loading || isRedirecting) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col items-center justify-center" style={{ fontFamily: "'Nunito', var(--font-nunito), sans-serif" }}>
        <div
          className="w-12 h-12 rounded-full border-2 border-transparent animate-spin"
          style={{ borderTopColor: "var(--pink)", borderRightColor: "var(--purple)" }}
        />
        <p className="mt-4 text-sm font-bold text-[var(--text-muted)]">
          {isRedirecting ? "Taking you to dashboard..." : "Loading..."}
        </p>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] overflow-x-hidden"
      style={{ fontFamily: "'Nunito', var(--font-nunito), sans-serif" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');
        :root { --pink: #D4A84B; --purple: #9B59B6; --gold: #D4A84B; --rust: #C75B39; --emerald: #2D6A4F; --blue: #2D6A4F; --yellow: #F5A623; --green: #2D6A4F; --bg: var(--bg-primary); }
        .navbar-glass { border-bottom: 1px solid var(--border); }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
        .float { animation: float 4s ease-in-out infinite; }
        .login-card {
          background: var(--bg-card);
          border: 1.5px solid var(--border);
          border-radius: 24px;
          transition: transform 0.3s, border-color 0.3s, box-shadow 0.3s;
          position: relative;
          overflow: hidden;
        }
        .login-card::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse at top left, rgba(124,58,255,0.08) 0%, transparent 65%);
          pointer-events: none;
        }
        .login-btn {
          position: relative;
          overflow: hidden;
          transition: transform 0.25s, box-shadow 0.25s;
        }
        .login-btn:hover:not(:disabled) { transform: scale(1.02) translateY(-2px); }
        .login-btn:active:not(:disabled) { transform: scale(0.98); }
        .footer-link { color: var(--text-muted); font-weight: 700; transition: color 0.2s; }
        .footer-link:hover { color: var(--text-primary); }
      `}</style>

      {/* Navbar */}
      <header className="fixed top-0 left-0 right-0 z-50 navbar-glass">
        <nav className="flex h-16 items-center justify-between px-6 sm:px-10 max-w-7xl mx-auto">
          <Link href="/" className="flex items-center gap-2 group">
            <span className="text-2xl font-black tracking-tight text-[var(--text-primary)] transition-all duration-300 group-hover:scale-105 inline-block" style={{ letterSpacing: "-0.04em" }}>
              picpop<span className="text-[var(--pink)]">.</span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              href="/"
              className="flex items-center gap-1.5 text-sm font-bold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> back
            </Link>
          </div>
        </nav>
      </header>

      {/* Main */}
      <section
        className="relative min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 pt-20"
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
        <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] rounded-full blur-[120px] opacity-15 pointer-events-none" style={{ background: "var(--purple)" }} />
        <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] rounded-full blur-[100px] opacity-12 pointer-events-none" style={{ background: "var(--pink)" }} />

        {/* Floating icons */}
        <div className="absolute top-32 left-[12%] opacity-50 float hidden sm:block"><Lock className="w-10 h-10 text-[var(--text-muted)]" /></div>
        <div className="absolute bottom-40 right-[10%] opacity-50 float hidden sm:block" style={{ animationDelay: "1s" }}><Sparkles className="w-10 h-10 text-[var(--text-muted)]" /></div>
        <div className="absolute top-40 right-[15%] opacity-40 float hidden md:block" style={{ animationDelay: "0.5s" }}><MessageCircle className="w-8 h-8 text-[var(--text-muted)]" /></div>
        <div className="absolute bottom-32 left-[8%] opacity-40 float hidden md:block" style={{ animationDelay: "1.5s" }}><MessageCircle className="w-8 h-8 text-[var(--text-muted)]" /></div>

        <div className="relative z-10 w-full max-w-md">
          {/* Label pill */}
          <div className="flex justify-center mb-6">
            <div
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-black border-2 border-[var(--border)] backdrop-blur-xl"
              style={{ background: "var(--bg-card)" }}
            >
              <span className="w-2 h-2 rounded-full bg-[var(--green)]" style={{ boxShadow: "0 0 8px var(--green)" }} />
              no passwords. just vibes.
            </div>
          </div>

          <h1
            className="text-center font-black text-[var(--text-primary)] leading-[0.95] tracking-tight mb-3"
            style={{ fontSize: "clamp(2.5rem, 8vw, 3.5rem)", fontFamily: "var(--font-nunito), 'Nunito'" }}
          >
            get
            <span className="bg-clip-text text-transparent" style={{ backgroundImage: "linear-gradient(90deg, var(--pink), var(--purple))" }}> started</span>
          </h1>
          <p className="text-center text-white/60 font-semibold text-base mb-8">
            Sign in with your favorite account.
          </p>

          {!isConfigured && (
            <div className="mb-6 rounded-xl border px-4 py-3 text-sm font-semibold" style={{ background: "rgba(251,191,36,0.1)", borderColor: "rgba(251,191,36,0.3)", color: "#fcd34d" }}>
              Add Firebase config to <code className="bg-black/30 px-1 rounded">.env.local</code> — see <code className="bg-black/30 px-1 rounded">.env.example</code>
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={() => handleSignIn(signInWithGoogle, "Google")}
              disabled={!isConfigured}
              className="login-card login-btn w-full flex items-center justify-center gap-3 rounded-2xl px-6 py-4 font-black text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: "#fff", boxShadow: "0 4px 20px rgba(0,0,0,0.2)" }}
            >
              <svg className="w-6 h-6 flex-shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </button>

            <button
              onClick={() => handleSignIn(signInWithFacebook, "Facebook")}
              disabled={!isConfigured}
              className="login-card login-btn w-full flex items-center justify-center gap-3 rounded-2xl px-6 py-4 font-black text-white disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: "#1877F2", boxShadow: "0 4px 20px rgba(24,119,242,0.4)" }}
            >
              <svg className="w-6 h-6 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
              Continue with Facebook
            </button>

            <button
              onClick={() => handleSignIn(signInWithYahoo, "Yahoo")}
              disabled={!isConfigured}
              className="login-card login-btn w-full flex items-center justify-center gap-3 rounded-2xl px-6 py-4 font-black text-white disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: "linear-gradient(135deg, #6001D2, #7C3AFF)", boxShadow: "0 4px 20px rgba(124,58,255,0.4)" }}
            >
              <svg className="w-6 h-6 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" />
              </svg>
              Continue with Yahoo
            </button>
          </div>

          <p className="mt-8 text-center text-sm text-[var(--text-muted)] font-semibold">
            By continuing, you agree to our Terms & Privacy Policy.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] bg-[var(--bg-secondary)] py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-lg font-black bg-clip-text text-transparent" style={{ backgroundImage: "linear-gradient(90deg, var(--pink), var(--purple))" }}>
            picpop.
          </span>
          <div className="flex gap-6 text-sm">
            <Link href="/" className="footer-link">home</Link>
            <Link href="/dashboard" className="footer-link">dashboard</Link>
          </div>
        </div>
        <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-[var(--text-muted)] font-semibold"><Sparkles className="w-3.5 h-3.5" /> anonymous image feedback</p>
      </footer>
    </div>
  );
}
