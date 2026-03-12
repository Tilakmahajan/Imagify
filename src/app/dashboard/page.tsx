"use client";

import { useEffect, useState } from "react";
import { Link2, Copy, Share2, Inbox, PlayCircle, LogOut, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useToast } from "@/lib/toast-context";
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  limit,
} from "firebase/firestore";
import { db, ensureFirestoreNetwork } from "@/lib/firebase";
import { HowToPlayModal } from "@/components/HowToPlayModal";
import { TermsModal } from "@/components/TermsModal";

export default function DashboardPage() {
  const router = useRouter();
  const { user, profile, loading, signOut } = useAuth();
  const toast = useToast();
  const [unreadCount, setUnreadCount] = useState(0);
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [showTerms, setShowTerms] = useState(() => {
    if (typeof window !== "undefined") {
      const universal = localStorage.getItem("picpop_legal_v1") === "true";
      if (universal) return false;
      // We'll check the user-specific one in useEffect since we don't have user.uid yet
    }
    return false;
  });
  const [showDropdown, setShowDropdown] = useState(false);

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push("/");
    } catch (error) {
      toast.error("Failed to sign out");
    }
  };

  useEffect(() => {
    if (!db || !user?.uid) return;
    const firestore = db;
    const uid = user.uid;
    let unsub: (() => void) | undefined;
    const run = async () => {
      try {
        await ensureFirestoreNetwork();
        const q = query(
          collection(firestore, "notifications"),
          where("recipientId", "==", uid),
          orderBy("createdAt", "desc"),
          limit(100)
        );
        unsub = onSnapshot(q, (snap) => {
          const count = snap.docs.filter((d) => d.data().isRead !== true).length;
          setUnreadCount(count);
        });
      } catch {
        // Index may be missing; ignore
      }
    };
    run();
    return () => unsub?.();
  }, [user?.uid]);

  useEffect(() => {
    if (!loading && !user) {
      const id = setTimeout(() => router.replace("/login"), 0);
      return () => clearTimeout(id);
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!loading && user && profile && !profile.coolId) {
      const id = setTimeout(() => router.replace("/create-id"), 0);
      return () => clearTimeout(id);
    }
  }, [user, profile, loading, router]);

  useEffect(() => {
    // 1. FAST CHECK: If this device has accepted terms, don't show the modal
    if (typeof window !== "undefined") {
      const universal = localStorage.getItem("picpop_legal_v1") === "true";
      const userSpecific = user?.uid ? localStorage.getItem(`picpop_terms_accepted_${user.uid}`) === "true" : false;
      
      if (universal || userSpecific) {
        setShowTerms(false);
        return;
      }
    }

    // 2. BACKUP CHECK: If profile is loaded, check Firestore status
    if (!loading && user && profile && profile.coolId) {
      const isAcceptedInStore = profile.termsAccepted && profile.privacyAccepted;
      if (!isAcceptedInStore) {
        setShowTerms(true);
      } else {
        setShowTerms(false);
      }
    }
  }, [user, profile, loading]);

  const feedbackUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/u?user=${profile?.coolId || ""}`
      : `/u?user=${profile?.coolId || ""}`;

  const copyLink = () => {
    navigator.clipboard.writeText(feedbackUrl);
    toast.success("Link copied!");
  };

  const shareLink = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Send me feedback on PicPop",
          text: "Send me anonymous image feedback",
          url: feedbackUrl,
        });
        toast.success("Shared!");
      } catch (err) {
        if ((err as Error).name !== "AbortError") toast.error("Could not share");
      }
    } else {
      copyLink();
    }
  };

  if (loading) return null;
  if (!user) return null;
  if (!profile?.coolId) return null;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] relative overflow-hidden">
      {/* BACKGROUND DECORATIONS */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[var(--pink)]/10 blur-[120px] rounded-full animate-pulse-glow transform translate-z-0" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[var(--purple)]/10 blur-[120px] rounded-full animate-pulse-glow animation-delay-500 transform translate-z-0" />
      
      <style>{`
        :root { --pink: #FF3D7F; --purple: #7C3AFF; --blue: #00C8FF; --green: #00FF94; }
        .glass-card {
           background: var(--bg-card-glass);
           backdrop-filter: blur(12px);
           -webkit-backdrop-filter: blur(12px);
           border: 1px solid var(--border);
           box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
           transform: translateZ(0);
        }
        .glow-button {
           will-change: transform, filter, box-shadow;
        }
        .glow-button:hover {
          filter: brightness(1.1);
          transform: translateY(-2px);
          box-shadow: 0 12px 30px -10px var(--glow-color);
        }
      `}</style>

      <header className="navbar-glass sticky top-0 z-50 border-b border-white/5">
        <nav className="flex h-16 items-center justify-between px-6 max-w-4xl mx-auto">
          <Link href="/" className="flex items-center hover:scale-105 transition-transform duration-300">
            <img src="/logo.svg" alt="picpop" className="h-7 w-auto" />
          </Link>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <div className="relative">
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="flex items-center gap-2 py-1.5 px-3 rounded-full bg-white/5 border border-white/10 text-sm font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
              >
                <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-[var(--pink)] to-[var(--purple)] flex items-center justify-center text-[10px] text-white">
                  {profile.coolId.slice(0, 2).toUpperCase()}
                </div>
                @{profile.coolId}
                <ChevronDown className={`w-4 h-4 transition-transform ${showDropdown ? "rotate-180" : ""}`} />
              </button>
              {showDropdown && (
                <div className="absolute right-0 top-full mt-2 py-2 w-48 rounded-2xl border border-white/10 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-200"
                  style={{ background: "var(--bg-secondary)" }}
                >
                  <button
                    onClick={handleSignOut}
                    className="w-full px-4 py-2.5 text-left text-sm font-bold text-[var(--text-muted)] hover:text-red-400 hover:bg-white/5 transition-colors flex items-center gap-3"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </nav>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-12 relative z-10">
        {/* HERO SECTION */}
        <div className="text-center mb-10 animate-fade-in-up">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--pink)]/10 border border-[var(--pink)]/20 text-[var(--pink)] text-[10px] font-black uppercase tracking-widest mb-4">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--pink)] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--pink)]"></span>
            </span>
            Active Link
          </div>
          <h1 className="text-4xl font-black text-[var(--text-primary)] mb-3 tracking-tight">Your Control Center</h1>
          <p className="text-[var(--text-muted)] text-base max-w-sm mx-auto">Track your anonymous reactions and manage your public presence.</p>
        </div>

        {/* FEEDBACK LINK CARD */}
        <div className="glass-card rounded-[2rem] p-8 mb-8 animate-pop-in animation-delay-200 transition-all hover:border-white/20">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[var(--pink)] to-[var(--purple)] flex items-center justify-center shadow-lg shadow-pink-500/20">
                <Link2 className="w-7 h-7 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-black text-[var(--text-primary)]">Public Profile</h3>
                <p className="text-xs text-[var(--text-muted)] font-bold uppercase tracking-wider">Sharing Link</p>
              </div>
            </div>
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-xs font-bold text-[var(--text-dim)] mb-1">Status</span>
              <span className="text-[10px] font-black text-[var(--green)] bg-[var(--green)]/10 px-2 py-0.5 rounded-md border border-[var(--green)]/20 uppercase">Live</span>
            </div>
          </div>

          <div className="bg-black/20 border border-white/5 rounded-2xl p-4 mb-6 flex items-center justify-between gap-4 group hover:border-white/10 transition-colors">
            <code className="text-[var(--pink)] font-bold text-sm truncate flex-1">{feedbackUrl}</code>
            <button onClick={copyLink} className="p-2 rounded-lg hover:bg-white/5 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all active:scale-95" title="Copy">
              <Copy className="w-5 h-5" />
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <button
              type="button"
              onClick={copyLink}
              className="glow-button flex-1 flex items-center justify-center gap-2 rounded-2xl py-4 font-black text-white transition-all"
              style={{
                "--glow-color": "rgba(255,61,127,0.4)",
                background: "linear-gradient(135deg, var(--pink), var(--purple))",
              } as any}
            >
              <Copy className="w-5 h-5" /> Copy Link
            </button>
            <button
              type="button"
              onClick={shareLink}
              className="glow-button flex-1 flex items-center justify-center gap-2 rounded-2xl py-4 font-black text-white transition-all shadow-xl"
              style={{
                "--glow-color": "rgba(124,58,255,0.4)",
                background: "linear-gradient(135deg, var(--purple), var(--blue))",
              } as any}
            >
              <Share2 className="w-5 h-5" /> Share Profile
            </button>
          </div>
        </div>

        {/* STATS & INBOX GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 animate-fade-in-up animation-delay-400">
          <Link
            href="/inbox"
            className="glass-card group flex flex-col justify-between p-7 rounded-[2rem] border border-white/10 transition-all hover:bg-white/[0.05] hover:border-[var(--pink)]/30 relative"
          >
            <div className="flex items-center justify-between mb-8">
              <div className="w-12 h-12 rounded-xl bg-[var(--pink)]/10 flex items-center justify-center">
                <Inbox className="w-6 h-6 text-[var(--pink)]" />
              </div>
              {unreadCount > 0 && (
                <div className="bg-[var(--pink)] text-white text-[10px] font-black px-2 py-1 rounded-full shadow-lg shadow-pink-500/30">
                  {unreadCount > 99 ? "99+" : unreadCount} NEW
                </div>
              )}
            </div>
            <div>
              <h3 className="text-xl font-black text-[var(--text-primary)] mb-1">Feedbacks</h3>
              <p className="text-sm text-[var(--text-muted)] font-medium">Review your latest anonymous reactions</p>
            </div>
            <div className="mt-6 flex items-center gap-2 text-[var(--pink)] text-xs font-black uppercase tracking-widest group-hover:translate-x-1 transition-transform">
              Open Now <Share2 className="w-3 h-3 rotate-90" />
            </div>
          </Link>

          <button
            type="button"
            onClick={() => setShowHowToPlay(true)}
            className="glass-card group flex flex-col justify-between text-left p-7 rounded-[2rem] border border-white/10 transition-all hover:bg-white/[0.05] hover:border-[var(--blue)]/30"
          >
            <div className="w-12 h-12 rounded-xl bg-[var(--blue)]/10 flex items-center justify-center mb-8">
              <PlayCircle className="w-6 h-6 text-[var(--blue)]" />
            </div>
            <div>
              <h3 className="text-xl font-black text-[var(--text-primary)] mb-1">Guide</h3>
              <p className="text-sm text-[var(--text-muted)] font-medium">Learn how to make the most of PicPop</p>
            </div>
            <div className="mt-6 flex items-center gap-2 text-[var(--blue)] text-xs font-black uppercase tracking-widest group-hover:translate-x-1 transition-transform">
              Watch Guide <PlayCircle className="w-3 h-3" />
            </div>
          </button>
        </div>

        <HowToPlayModal
          isOpen={showHowToPlay}
          onClose={() => setShowHowToPlay(false)}
          feedbackUrl={feedbackUrl}
          onCopyLink={copyLink}
        />

        <TermsModal
          isOpen={showTerms}
          onAccept={() => setShowTerms(false)}
        />

        <div className="mt-16 text-center animate-fade-in-up animation-delay-600">
          <p className="text-xs font-bold text-[var(--text-dim)] uppercase tracking-[0.2em] mb-4">PicPop Experience</p>
          <div className="flex justify-center gap-8">
            <div className="flex flex-col items-center">
              <span className="text-lg font-black text-[var(--text-dim)] underline decoration-[var(--pink)] decoration-2 underline-offset-4">Private</span>
              <span className="text-[10px] font-bold text-[var(--text-dim)] uppercase mt-1">Encrypted</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-lg font-black text-[var(--text-dim)] underline decoration-[var(--purple)] decoration-2 underline-offset-4">Secure</span>
              <span className="text-[10px] font-bold text-[var(--text-dim)] uppercase mt-1">Verified</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-lg font-black text-[var(--text-dim)] underline decoration-[var(--blue)] decoration-2 underline-offset-4">Fast</span>
              <span className="text-[10px] font-bold text-[var(--text-dim)] uppercase mt-1">Global</span>
            </div>
          </div>
        </div>
      </main>
      
      {/* MOBILE TAB BAR HINT */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 sm:hidden z-50">
        <div className="bg-[var(--bg-secondary)]/80 backdrop-blur-xl border border-[var(--border)] px-6 py-3 rounded-full flex gap-8 shadow-2xl">
          <Link href="/dashboard" className="text-[var(--pink)]">
            <Link2 className="w-6 h-6" />
          </Link>
          <Link href="/inbox" className="text-[var(--text-muted)]">
            <Inbox className="w-6 h-6" />
          </Link>
          <button onClick={shareLink} className="text-[var(--text-muted)]">
            <Share2 className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
}

