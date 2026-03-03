"use client";

import { useEffect, useState } from "react";
import { Link2, Copy, Share2, Inbox, PlayCircle, LogOut } from "lucide-react";
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

export default function DashboardPage() {
  const router = useRouter();
  const { user, profile, loading, signOut } = useAuth();
  const toast = useToast();
  const [unreadCount, setUnreadCount] = useState(0);
  const [showHowToPlay, setShowHowToPlay] = useState(false);
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
    if (!loading && user && !profile?.coolId) {
      const id = setTimeout(() => router.replace("/create-id"), 0);
      return () => clearTimeout(id);
    }
  }, [user, profile, loading, router]);

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
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] transition-colors">
      <style>{`:root { --pink: #FF3D7F; --purple: #7C3AFF; --blue: #00C8FF; --green: #00FF94; }`}</style>

      <header className="navbar-glass sticky top-0 z-50 border-b border-[var(--border)]">
        <nav className="flex h-14 items-center justify-between px-4 max-w-[600px] mx-auto">
          <Link href="/" className="text-lg font-black tracking-tight">
            picpop<span className="text-[var(--pink)]">.</span>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <div className="relative">
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="text-sm font-bold text-[var(--text-muted)] cursor-pointer hover:text-[var(--pink)] transition-colors bg-transparent border-none"
              >
                @{profile.coolId}
              </button>
              {showDropdown && (
                <div className="absolute right-0 top-full mt-2 py-2 w-36 rounded-xl border border-[var(--border)] shadow-lg z-50"
                  style={{ background: "var(--bg-card)" }}
                >
                  <button
                    onClick={handleSignOut}
                    className="w-full px-4 py-2 text-left text-sm font-bold text-[var(--text-muted)] hover:text-[var(--pink)] hover:bg-[var(--bg-secondary)] transition-colors flex items-center gap-2"
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

      <main className="max-w-[600px] mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-black text-[var(--text-primary)] mb-2">Your feedback link</h1>
          <p className="text-sm text-[var(--text-muted)]">Share this link to get anonymous image feedback</p>
        </div>

        <div
          className="rounded-2xl p-6 border-2 border-[var(--border)] transition-colors"
          style={{ background: "var(--bg-card)" }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "linear-gradient(135deg, var(--pink), var(--purple))" }}
            >
              <Link2 className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Copy & share</p>
              <p className="text-sm font-bold text-[var(--text-primary)] break-all">{feedbackUrl}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={copyLink}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl py-4 font-bold text-white transition-all hover:opacity-90"
              style={{
                background: "linear-gradient(135deg, var(--pink), var(--purple))",
                boxShadow: "0 4px 20px rgba(255,61,127,0.3)",
              }}
            >
              <Copy className="w-5 h-5" /> Copy link
            </button>
            <button
              type="button"
              onClick={shareLink}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl py-4 font-bold text-white transition-all hover:opacity-90"
              style={{
                background: "linear-gradient(135deg, var(--purple), var(--blue))",
                boxShadow: "0 4px 20px rgba(124,58,255,0.3)",
              }}
            >
              <Share2 className="w-5 h-5" /> Share
            </button>
          </div>
        </div>

        <Link
          href="/inbox"
          className="mt-6 flex items-center justify-center gap-2 py-4 rounded-xl font-bold text-[var(--pink)] hover:text-[var(--purple)] border-2 border-[var(--pink)]/30 hover:border-[var(--purple)]/50 transition-colors relative"
        >
          <Inbox className="w-5 h-5" /> Open inbox
          {unreadCount > 0 && (
            <span
              className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full text-xs font-black text-white"
              style={{ background: "var(--pink)" }}
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Link>

        <button
          type="button"
          onClick={() => setShowHowToPlay(true)}
          className="mt-4 w-full flex items-center justify-center gap-2 py-4 rounded-xl font-bold text-[var(--blue)] hover:text-[var(--purple)] border-2 border-[var(--blue)]/30 hover:border-[var(--purple)]/50 transition-colors"
        >
          <PlayCircle className="w-5 h-5" /> How to play
        </button>

        <HowToPlayModal
          isOpen={showHowToPlay}
          onClose={() => setShowHowToPlay(false)}
          feedbackUrl={feedbackUrl}
          onCopyLink={copyLink}
        />

        <p className="mt-8 text-center text-xs text-[var(--text-muted)]">
          Anyone with your link can send you an image reaction — 100% anonymous
        </p>
      </main>
    </div>
  );
}
