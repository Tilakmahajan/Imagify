"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import Link from "next/link";
import { Camera, Check, X, Heart, Sparkles } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { doc, getDoc, addDoc, collection } from "firebase/firestore";
import { db, ensureFirestoreNetwork } from "@/lib/firebase";
import { uploadFeedbackImage } from "@/lib/image-upload";
import { useToast } from "@/lib/toast-context";
import { useAuth } from "@/lib/auth-context";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AiImagePrompts } from "@/components/AiImagePrompts";
import { ExploreImages } from "@/components/ExploreImages";

const SIGN_IN_NUDGE_INTERVAL_MS = 20_000;

function UserFeedbackContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user: authUser, loading: authLoading } = useAuth();
  const [coolId, setCoolId] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showSignInNudge, setShowSignInNudge] = useState(false);
  const [pendingShare, setPendingShare] = useState<{ previewUrl: string; confirm: () => Promise<void> } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  // Track visit when someone views the feedback page (not when owner views own link)
  useEffect(() => {
    if (!db || !userId || !coolId) return;
    if (authUser?.uid === userId) return; // Don't track when owner views own link
    const firestore = db;
    const run = async () => {
      try {
        await ensureFirestoreNetwork();
        await addDoc(collection(firestore, "visits"), {
          recipientId: userId,
          coolId,
          type: "visit",
          createdAt: new Date().toISOString(),
        });
      } catch {
        /* ignore visit tracking */
      }
    };
    run();
  }, [userId, coolId, authUser?.uid]);

  // Show sign-in nudge every 20 sec when user is not logged in
  useEffect(() => {
    if (authLoading || authUser || !userId) return;
    const id = setInterval(() => setShowSignInNudge(true), SIGN_IN_NUDGE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [authLoading, authUser, userId]);

  useEffect(() => {
    const fromPath = (pathname || "").replace(/^\/u\/?/, "").split("/")[0] || "";
    const fromQuery = searchParams.get("user") || "";
    const id = (fromPath || fromQuery).trim().toLowerCase();
    setCoolId(id);
  }, [pathname, searchParams]);

  useEffect(() => {
    if (coolId && userId) {
      document.title = `Send feedback to @${coolId} — PicPop`;
    }
    return () => { document.title = "PicPop — Anonymous Image-Based Feedback"; };
  }, [coolId, userId]);

  useEffect(() => {
    if (!db || !coolId) {
      setLoading(false);
      return;
    }
    const firestore = db;
    let mounted = true;
    const run = async () => {
      try {
        await ensureFirestoreNetwork();
        const usernameRef = doc(firestore, "usernames", coolId);
        const snap = await getDoc(usernameRef);
        if (mounted && snap.exists()) {
          setUserId((snap.data() as { uid: string }).uid);
        } else {
          setUserId(null);
        }
      } catch {
        if (mounted) setUserId(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    run();
    return () => { mounted = false; };
  }, [coolId]);

  const doFileUpload = async (file: File) => {
    if (!userId || !db) return;
    setSubmitting(true);
    try {
      await ensureFirestoreNetwork();
      const feedbackId = crypto.randomUUID();
      const url = await uploadFeedbackImage(file, feedbackId);

      const { httpsCallable } = await import("firebase/functions");
      const { getAppFunctions } = await import("@/lib/functions");
      const functions = getAppFunctions();
      if (!functions) throw new Error("Firebase not configured");

      const submitFeedback = httpsCallable<
        { recipientId: string; feedbackImageUrl: string },
        { success: boolean }
      >(functions, "submitFeedback");

      await submitFeedback({
        recipientId: userId,
        feedbackImageUrl: url,
      });

      setSubmitted(true);
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "message" in err ? String((err as Error).message) : "Failed to send.";
      if (msg.includes("restricted") || msg.includes("cannot submit")) {
        setSubmitted(true);
      } else {
        console.error(err);
        toast.error("Failed to send. Try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !userId || !db) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image.");
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    setPendingShare({
      previewUrl,
      confirm: async () => {
        URL.revokeObjectURL(previewUrl);
        setPendingShare(null);
        await doFileUpload(file);
      },
    });
  };

  const handleSharedSelect = async (item: { id: string; feedbackImageUrl: string }) => {
    if (!userId || !db) return;
    setSubmitting(true);
    try {
      await ensureFirestoreNetwork();
      const { httpsCallable } = await import("firebase/functions");
      const { getAppFunctions } = await import("@/lib/functions");
      const functions = getAppFunctions();
      if (!functions) throw new Error("Firebase not configured");

      const submitFeedback = httpsCallable<
        { recipientId: string; feedbackImageUrl: string },
        { success: boolean }
      >(functions, "submitFeedback");

      await submitFeedback({
        recipientId: userId,
        feedbackImageUrl: item.feedbackImageUrl,
      });

      setSubmitted(true);
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "message" in err ? String((err as Error).message) : "Failed to send.";
      if (msg.includes("restricted") || msg.includes("cannot submit")) {
        setSubmitted(true);
      } else {
        console.error(err);
        toast.error("Failed to send. Try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleMemeSelect = async (meme: { id: string; url: string }) => {
    if (!userId || !db) return;
    setSubmitting(true);
    try {
      await ensureFirestoreNetwork();
      const { httpsCallable } = await import("firebase/functions");
      const { getAppFunctions } = await import("@/lib/functions");
      const functions = getAppFunctions();
      if (!functions) throw new Error("Firebase not configured");

      const submitFromImgflip = httpsCallable<
        { imageUrl: string; recipientId: string },
        { success: boolean }
      >(functions, "submitFeedbackFromImgflip");

      await submitFromImgflip({
        imageUrl: meme.url,
        recipientId: userId,
      });

      setSubmitted(true);
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "message" in err ? String((err as Error).message) : "Failed to send.";
      if (msg.includes("restricted") || msg.includes("cannot submit")) {
        setSubmitted(true);
      } else {
        console.error(err);
        toast.error("Failed to send. Try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const showShareConfirm = (previewUrl: string, confirm: () => Promise<void>) => {
    setPendingShare({ previewUrl, confirm });
  };

  const handleMemeSelectWithConfirm = async (meme: { id: string; url: string }) => {
    showShareConfirm(meme.url, () => {
      setPendingShare(null);
      return handleMemeSelect(meme);
    });
  };

  const handleSharedSelectWithConfirm = async (item: { id: string; feedbackImageUrl: string }) => {
    showShareConfirm(item.feedbackImageUrl, () => {
      setPendingShare(null);
      return handleSharedSelect(item);
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div
          className="w-12 h-12 rounded-full border-2 border-transparent animate-spin"
          style={{ borderTopColor: "var(--pink)", borderRightColor: "var(--purple)" }}
        />
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col items-center justify-center px-4">
        <p className="text-[var(--text-muted)] font-semibold text-center">User @{coolId || "?"} not found.</p>
        <Link href="/" className="mt-4 text-[var(--pink)] hover:underline font-bold">Back to home</Link>
      </div>
    );
  }

  const openAiImageWithPrompt = (prompt: string) => {
    navigator.clipboard.writeText(prompt).then(() => {
      toast.success("Copied! Opening ChatGPT...");
    });
    const isMobile = typeof window !== "undefined" && (window.innerWidth < 768 || /Android|iPhone|iPad|iPod|webOS/i.test(navigator.userAgent));
    const base = "https://chatgpt.com";
    const url = `${base}/?q=${encodeURIComponent(prompt)}`;
    if (isMobile) {
      window.location.href = url;
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  const RESPONSE_PREVIEWS = [
    { src: "/images/response.png", bg: "linear-gradient(135deg,#FF3D7F,#7C3AFF)" },
    { src: "/images/response1.png", bg: "linear-gradient(135deg,#7C3AFF,#00C8FF)" },
    { src: "/images/response2.png", bg: "linear-gradient(135deg,#00C8FF,#FF3D7F)" },
    { src: "/images/response3.jpg", bg: "linear-gradient(135deg,#FF3D7F,#FFE500)" },
    { src: "/images/response4.jpg", bg: "linear-gradient(135deg,#00C8FF,#7C3AFF)" },
    { src: "/images/response5.png", bg: "linear-gradient(135deg,#00FF94,#00C8FF)" },
    { src: "/images/response6.png", bg: "linear-gradient(135deg,#7C3AFF,#FFE500)" },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] overflow-x-hidden" style={{ fontFamily: "'Nunito', var(--font-nunito), sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');
        :root { --pink: #FF3D7F; --purple: #7C3AFF; --blue: #00C8FF; --green: #00FF94; --yellow: #FFE500; }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes pulse-glow { 0%,100%{box-shadow:0 0 40px rgba(255,61,127,0.25)} 50%{box-shadow:0 0 60px rgba(255,61,127,0.45)} }
        @keyframes gradient-shift { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
        @keyframes bounce-subtle { 0%,100%{transform:scale(1)} 50%{transform:scale(1.02)} }
        .float { animation: float 4s ease-in-out infinite; }
        .pulse-glow { animation: pulse-glow 2.5s ease-in-out infinite; }
        .preview-scroll::-webkit-scrollbar { display: none; }
        .preview-scroll { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* Richer gradient blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-0 w-[500px] h-[500px] rounded-full blur-[120px] opacity-[0.15]" style={{ background: "var(--purple)" }} />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full blur-[100px] opacity-[0.12]" style={{ background: "var(--pink)" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full blur-[80px] opacity-[0.08]" style={{ background: "var(--blue)" }} />
      </div>

      <header className="relative navbar-glass border-b border-[var(--border)]">
        <nav className="flex h-14 items-center justify-between px-4 max-w-2xl mx-auto">
          <Link href="/" className="text-lg font-black tracking-tight">
            picpop<span className="text-[var(--pink)]">.</span>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/login" className="text-sm font-bold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">Sign in</Link>
          </div>
        </nav>
      </header>

      <main className="relative max-w-xl mx-auto px-4 py-8 sm:py-12 pb-16">
        {/* Hero — punchy and personal */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold mb-4" style={{ background: "rgba(255,61,127,0.15)", border: "1px solid rgba(255,61,127,0.3)" }}>
            <Heart className="w-4 h-4 text-[var(--pink)]" /> 100% anonymous · no sign-up
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-[var(--text-primary)] leading-tight">
            <span className="text-[var(--pink)]">@{coolId}</span> is waiting for your feedback
          </h1>
          <p className="text-base text-[var(--text-muted)] mt-3 font-semibold max-w-sm mx-auto">
            Send one honest reaction — screenshot, selfie, meme, anything. They&apos;ll love it.
          </p>
        </div>

        {/* Image preview — "You could send something like this" */}
        <div className="mb-8">
          <p className="text-xs font-black uppercase tracking-wider text-[var(--text-muted)] mb-3 text-center">✨ Ideas: reactions like these</p>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 preview-scroll">
            {RESPONSE_PREVIEWS.map((r, i) => (
              <div key={i} className="flex-shrink-0 group cursor-default">
                <div className="p-[2px] rounded-xl transition-transform duration-300 group-hover:scale-105" style={{ background: r.bg, boxShadow: "0 4px 20px rgba(0,0,0,0.2)" }}>
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden bg-black">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={r.src} alt="reaction idea" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {showSignInNudge && !authUser && !submitted && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
            onClick={() => setShowSignInNudge(false)}
          >
            <div
              className="relative max-w-sm w-full rounded-2xl p-6 text-center border border-[var(--border)]"
              style={{ background: "var(--bg-card)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setShowSignInNudge(false)}
                className="absolute top-3 right-3 p-2 rounded-lg hover:bg-white/5 text-[var(--text-muted)]"
              >
                <X className="w-5 h-5" />
              </button>
              <h2 className="text-lg font-black text-[var(--text-primary)] mb-2">Love sending feedback?</h2>
              <p className="text-sm text-[var(--text-primary)] font-semibold mb-2">
                Get your own link. Friends send you honest reactions anonymously — just like you did for @{coolId}.
              </p>
              <p className="text-xs text-[var(--text-muted)] mb-5">
                Your link. Share anywhere. Friends react anonymously. Takes 10 seconds.
              </p>
              <Link
                href="/login"
                className="block w-full py-3.5 rounded-xl font-black text-white text-center"
                style={{
                  background: "linear-gradient(135deg, var(--pink), var(--purple))",
                  boxShadow: "0 4px 20px rgba(255,61,127,0.3)",
                }}
              >
                Sign in to get my link →
              </Link>
              <button
                type="button"
                onClick={() => setShowSignInNudge(false)}
                className="mt-3 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                Maybe later
              </button>
            </div>
          </div>
        )}

        {submitted && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-overlay"
            onClick={() => setSubmitted(false)}
          >
            <div
              className="relative max-w-sm w-full rounded-2xl p-6 text-center border border-[var(--border)]"
              style={{ background: "var(--bg-card)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setSubmitted(false)}
                className="absolute top-3 right-3 p-2 rounded-lg hover:bg-white/5 text-[var(--text-muted)]"
              >
                <X className="w-5 h-5 text-[var(--text-muted)]" />
              </button>
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4" style={{ background: "rgba(0,255,148,0.25)", boxShadow: "0 0 30px rgba(0,255,148,0.3)" }}>
                <Check className="w-10 h-10 text-[var(--green)]" />
              </div>
              <h2 className="text-2xl font-black text-[var(--text-primary)] mb-2">You did it! 🎉</h2>
              <p className="text-sm text-[var(--text-primary)] font-semibold mb-2">
                @{coolId} will see your feedback in their inbox. You made someone&apos;s day!
              </p>
              <p className="text-xs text-[var(--text-muted)] mb-4">
                Your own link. Share on Instagram, WhatsApp, anywhere. Friends send reactions anonymously — they never have to sign up. You get an inbox full of real feedback.
              </p>
              <p className="text-xs font-bold text-[var(--pink)] mb-5">
                Takes 10 seconds.
              </p>
              <Link
                href="/login"
                className="block w-full py-3.5 rounded-xl font-black text-white text-center"
                style={{
                  background: "linear-gradient(135deg, var(--pink), var(--purple))",
                  boxShadow: "0 4px 20px rgba(255,61,127,0.3)",
                }}
              >
                Get my free link →
              </Link>
              <button
                type="button"
                onClick={() => setSubmitted(false)}
                className="mt-3 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                I&apos;ll pass for now
              </button>
            </div>
          </div>
        )}

        {/* Share confirmation modal */}
        {pendingShare && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
            onClick={() => {
              if (pendingShare.previewUrl.startsWith("blob:")) {
                URL.revokeObjectURL(pendingShare.previewUrl);
              }
              setPendingShare(null);
            }}
          >
            <div
              className="relative max-w-sm w-full rounded-2xl overflow-hidden border border-[var(--border)]"
              style={{ background: "var(--bg-card)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4">
                <h2 className="text-lg font-black text-[var(--text-primary)] mb-2 text-center">Do you want to share this image?</h2>
                <div className="rounded-xl overflow-hidden bg-black/20 mb-4 aspect-square max-h-[280px]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={pendingShare.previewUrl}
                    alt="Preview"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (pendingShare.previewUrl.startsWith("blob:")) {
                        URL.revokeObjectURL(pendingShare.previewUrl);
                      }
                      setPendingShare(null);
                    }}
                    className="flex-1 py-3 rounded-xl font-bold text-[var(--text-muted)] hover:text-[var(--text-primary)] border border-[var(--border)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await pendingShare.confirm();
                    }}
                    disabled={submitting}
                    className="flex-1 py-3 rounded-xl font-bold text-white"
                    style={{
                      background: "linear-gradient(135deg, var(--pink), var(--purple))",
                      boxShadow: "0 4px 20px rgba(255,61,127,0.3)",
                    }}
                  >
                    Yes, share
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Upload loader overlay */}
        {submitting && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60">
            <div className="flex flex-col items-center gap-4">
              <div
                className="w-14 h-14 rounded-full animate-spin"
                style={{
                  border: "4px solid transparent",
                  borderTopColor: "var(--pink)",
                  borderRightColor: "var(--purple)",
                }}
              />
              <p className="font-bold text-white">Uploading...</p>
            </div>
          </div>
        )}

        {/* Upload zone — hero CTA, impossible to miss */}
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
        <div
          className="p-[3px] rounded-3xl transition-all duration-300 hover:scale-[1.02] pulse-glow"
          style={{
            background: "linear-gradient(135deg, var(--pink) 0%, var(--purple) 50%, var(--blue) 100%)",
            backgroundSize: "200% 200%",
            boxShadow: "0 12px 48px rgba(255,61,127,0.35), 0 0 0 1px rgba(255,255,255,0.1)",
          }}
        >
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={submitting}
            className="w-full rounded-[22px] p-12 sm:p-16 flex flex-col items-center justify-center gap-5 disabled:opacity-50 transition-all relative overflow-hidden"
            style={{
              background: "var(--bg-card)",
              touchAction: "manipulation",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            <div
              className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl flex items-center justify-center float"
              style={{
                background: "linear-gradient(135deg, rgba(255,61,127,0.2), rgba(124,58,255,0.2))",
                border: "3px dashed rgba(255,61,127,0.5)",
                boxShadow: "inset 0 0 30px rgba(255,61,127,0.1)",
              }}
            >
              <Camera className="w-12 h-12 sm:w-14 sm:h-14 text-[var(--pink)]" />
            </div>
            <div className="text-center">
              <span className="font-black text-[var(--text-primary)] block text-xl sm:text-2xl">
                {submitting ? "Sending..." : "Tap to send feedback"}
              </span>
              <span className="text-sm text-[var(--text-muted)] font-semibold mt-2 block">Pick any image — takes 2 seconds</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs font-bold text-[var(--green)]">✓ No sign-up</span>
              <span className="text-[var(--text-muted)]">·</span>
              <span className="text-xs font-bold text-[var(--green)]">✓ 100% anonymous</span>
            </div>
          </button>
        </div>

        <ExploreImages
          onSubmit={handleMemeSelectWithConfirm}
          onSubmitShared={handleSharedSelectWithConfirm}
          disabled={submitting}
        />

        <AiImagePrompts onPromptClick={openAiImageWithPrompt} />

        <p className="mt-8 text-center text-sm text-[var(--text-muted)] font-semibold flex items-center justify-center gap-2">
          <Sparkles className="w-4 h-4 text-[var(--pink)]" /> Send one. @{coolId} will appreciate it.
        </p>
      </main>
    </div>
  );
}

export default function UserFeedbackClient() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
          <div className="w-12 h-12 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: "var(--pink)" }} />
        </div>
      }
    >
      <UserFeedbackContent />
    </Suspense>
  );
}
