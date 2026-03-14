"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles, Flame, Rocket } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useLoading } from "@/lib/loading-context";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db, ensureFirestoreNetwork } from "@/lib/firebase";
import { ThemeToggle } from "@/components/ThemeToggle";

const COOL_ID_REGEX = /^[a-zA-Z0-9_]{3,20}$/;

export default function CreateIdPage() {
  const router = useRouter();
  const { user, profile, loading, signOut, refreshProfile } = useAuth();
  const { setActionLoading } = useLoading();
  const [coolId, setCoolId] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      const id = setTimeout(() => router.replace("/login"), 0);
      return () => clearTimeout(id);
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!loading && user && profile && profile.coolId) {
      const id = setTimeout(() => router.replace("/dashboard"), 0);
      return () => clearTimeout(id);
    }
  }, [user, profile, loading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const trimmed = coolId.trim();
    if (!trimmed) {
      setError("Pick something cool!");
      return;
    }

    if (!COOL_ID_REGEX.test(trimmed)) {
      setError("3–20 characters. Letters, numbers, underscores only.");
      return;
    }

    const lower = trimmed.toLowerCase();
    setSubmitting(true);
    setActionLoading(true);

    try {
      await ensureFirestoreNetwork();
      if (!db || !user) {
        setError("Something went wrong. Try again.");
        setSubmitting(false);
        return;
      }

      const firestore = db;
      const userRef = doc(firestore, "users", user.uid);
      const usernameRef = doc(firestore, "usernames", lower);

      const usernameSnap = await getDoc(usernameRef);
      if (usernameSnap.exists() && usernameSnap.data().uid !== user.uid) {
        setError(`"${trimmed}" is taken. Try another?`);
        setSubmitting(false);
        return;
      }

      await Promise.all([
        setDoc(userRef, { coolId: trimmed }, { merge: true }),
        setDoc(usernameRef, { uid: user.uid }),
      ]);

      await refreshProfile();
      router.replace("/dashboard");
    } catch (err) {
      console.error(err);
      setError("Couldn't save. Try again.");
    } finally {
      setSubmitting(false);
      setActionLoading(false);
    }
  };

  if (loading) return null;

  if (!user) return null;

  const suggestions = [
    "shadow_fox",
    "neon_dream",
    "pixel_vibes",
    "cool_cactus",
    "starry_nite",
    "glitch_king",
    "aura_flow",
  ];

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 bg-[var(--bg-primary)]"
    >
      <div className="absolute top-20 left-[8%] opacity-50 animate-float"><Sparkles className="w-10 h-10 text-[var(--text-muted)]" /></div>
      <div className="absolute bottom-24 right-[8%] opacity-50 animate-float animation-delay-200"><Flame className="w-10 h-10 text-[var(--text-muted)]" /></div>

      <div className="relative z-10 w-full max-w-lg">
        <div className="flex items-center justify-between mb-8">
          <Link
            href="/"
            className="text-lg font-bold bg-clip-text text-transparent"
            style={{
              backgroundImage: "linear-gradient(90deg, var(--pink), var(--purple))",
            }}
          >
            PicPop
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
            onClick={() => signOut()}
            className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            Sign out
          </button>
          </div>
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
          Create your cool ID
        </h1>
        <p className="text-[var(--text-muted)] mb-6">
          Choose a unique handle. 3–20 characters. Letters, numbers, underscores.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="text"
              value={coolId}
              onChange={(e) => {
                setCoolId(e.target.value);
                setError("");
              }}
              placeholder="e.g. neon_dream"
              className="w-full rounded-xl bg-[#1F2240] border border-white/10 px-5 py-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#8A4DFF] focus:border-transparent"
              maxLength={20}
              autoFocus
              autoComplete="off"
              disabled={submitting}
            />
            <p className="mt-2 text-xs text-[var(--text-muted)]">{coolId.length}/20</p>
          </div>

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl py-4 text-base font-semibold text-white transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
            style={{
              background: "linear-gradient(90deg, #FF4F8B, #8A4DFF)",
            }}
          >
            {submitting ? "Creating..." : <span className="flex items-center justify-center gap-2">Claim my ID <Rocket className="w-4 h-4" /></span>}
          </button>
        </form>

        <div className="mt-8">
          <p className="text-sm text-gray-500 mb-2">Need ideas?</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setCoolId(s);
                  setError("");
                }}
                className="rounded-lg bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] transition-colors border border-[var(--border)]"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
