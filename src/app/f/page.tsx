"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Share2, X, Reply, Check, Camera, ChevronDown, Flag, Trash2 } from "lucide-react";
import {
  doc,
  getDoc,
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";
import { db, ensureFirestoreNetwork } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { uploadFeedbackImage } from "@/lib/image-upload";
import { ShareButtons } from "@/components/ShareButtons";
import { ThemeToggle } from "@/components/ThemeToggle";
import { FeedbackShareModal } from "@/components/FeedbackShareModal";
import { ReportFeedbackModal } from "@/components/ReportFeedbackModal";
import { ConfirmModal } from "@/components/ConfirmModal";
import { useToast } from "@/lib/toast-context";
import { useLoading } from "@/lib/loading-context";
import { TermsModal } from "@/components/TermsModal";

interface Feedback {
  id: string;
  imageId: string;
  parentId?: string | null;
  feedbackImageUrl: string;
  createdAt: string;
  submitterId?: string | null;
}

function buildThread(feedbacks: Feedback[]): { feedback: Feedback; replies: Feedback[] }[] {
  const topLevel = feedbacks.filter((f) => !f.parentId || f.parentId === "");
  const byParent = feedbacks.reduce<Record<string, Feedback[]>>((acc, f) => {
    const pid = f.parentId || "";
    if (!pid) return acc;
    if (!acc[pid]) acc[pid] = [];
    acc[pid].push(f);
    return acc;
  }, {});
  topLevel.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  return topLevel.map((f) => ({
    feedback: f,
    replies: (byParent[f.id] || []).sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    ),
  }));
}

function FeedbackThreadItem({
  feedback,
  replies,
  imageId,
  replyingTo,
  onReply,
  onCancelReply,
  onShare,
  onReport,
  onDelete,
  isOwner,
  depth = 0,
}: {
  feedback: Feedback;
  replies: Feedback[];
  imageId: string;
  replyingTo: string | null;
  onReply: (parentId: string) => void;
  onCancelReply: () => void;
  onShare?: (f: Feedback) => void;
  onReport?: (f: Feedback) => void;
  onDelete?: (f: Feedback) => void;
  isOwner?: boolean;
  depth?: number;
}) {
  const isReplying = replyingTo === feedback.id;
  return (
    <div className={depth > 0 ? "ml-6 sm:ml-8 mt-3 border-l-2 border-white/10 pl-3 sm:pl-4" : ""}>
      <div className="relative inline-block group">
        <div
          className={`rounded-xl overflow-hidden bg-white/5 border inline-block max-w-[180px] sm:max-w-[220px] transition-colors cursor-pointer ${isReplying ? "border-[var(--pink)] ring-2 ring-[var(--pink)]/30" : "border-white/5"
            }`}
          onClick={() => !isReplying && isOwner && onShare?.(feedback)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={feedback.feedbackImageUrl}
            alt="Reaction"
            className="w-full aspect-square object-cover"
          />
          {isOwner && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl">
              <Share2 className="w-8 h-8 text-white" />
            </div>
          )}
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={() => (isReplying ? onCancelReply() : onReply(feedback.id))}
          className="text-xs font-bold text-white/50 hover:text-white/80 transition-colors"
        >
          <span className="inline-flex items-center gap-1.5">{isReplying ? <><X className="w-3.5 h-3.5" /> cancel</> : <><Reply className="w-3.5 h-3.5" /> reply</>}</span>
        </button>
        {isOwner && (
          <>
            <button
              type="button"
              onClick={() => onShare?.(feedback)}
              className="text-xs font-bold text-[var(--pink)] hover:text-[var(--purple)] transition-colors"
            >
              share
            </button>
            <button
              type="button"
              onClick={() => onReport?.(feedback)}
              className="text-xs font-bold text-white/50 hover:text-amber-400 transition-colors flex items-center gap-1 py-2 px-1 min-h-[32px] -my-1"
              style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
              title="Report"
            >
              <Flag className="w-3 h-3" /> report
            </button>
            <button
              type="button"
              onClick={() => onDelete?.(feedback)}
              className="text-xs font-bold text-white/50 hover:text-red-400 transition-colors flex items-center gap-1"
              title="Delete"
            >
              <Trash2 className="w-3 h-3" /> delete
            </button>
          </>
        )}
      </div>
      {replies.length > 0 && (
        <div className="mt-3 space-y-2">
          {replies.map((r) => (
            <FeedbackThreadItem
              key={r.id}
              feedback={r}
              replies={[]}
              imageId={imageId}
              replyingTo={replyingTo}
              onReply={onReply}
              onCancelReply={onCancelReply}
              onShare={onShare}
              onReport={onReport}
              onDelete={onDelete}
              isOwner={isOwner}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FeedbackOnImageContent() {
  const searchParams = useSearchParams();
  const imageId = searchParams.get("imageId")?.trim() || "";
  const { user, loading: authLoading, isConfigured, signInWithGoogle, signInWithFacebook, signInWithYahoo } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<{ imageUrl: string; coolId: string; userId?: string } | null>(null);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [shareModal, setShareModal] = useState<Feedback | null>(null);
  const [reportModal, setReportModal] = useState<Feedback | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Feedback | null>(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [fetchAttempted, setFetchAttempted] = useState(false);
  const [showTerms, setShowTerms] = useState(() => {
    if (typeof window !== "undefined") {
      const universal = localStorage.getItem("picpop_legal_v1") === "true";
      if (universal) return false;
    }
    return false;
  });
  const { setPageLoading, setActionLoading } = useLoading();
  const { profile, loading: authLoadingState } = useAuth();

  useEffect(() => {
    if (!db) {
      setFetchAttempted(true);
      setLoading(false);
      return;
    }
    if (!imageId) {
      const t = setTimeout(() => {
        setFetchAttempted(true);
        setLoading(false);
      }, 300);
      return () => clearTimeout(t);
    }
    if (authLoading) return;

    const firestore = db;
    setFetchAttempted(false);
    let unsub: (() => void) | undefined;
    const init = async () => {
      try {
        await ensureFirestoreNetwork();
        let imgSnap = await getDoc(doc(firestore, "images", imageId));
        if (!imgSnap.exists()) {
          await new Promise((r) => setTimeout(r, 500));
          imgSnap = await getDoc(doc(firestore, "images", imageId));
        }
        setFetchAttempted(true);
        if (!imgSnap.exists()) {
          setImage(null);
          setLoading(false);
          return;
        }
        const imgData = imgSnap.data() as { imageUrl: string; coolId: string; userId?: string };
        setImage(imgData);

        const isOwner = !!user && !!imgData?.userId && imgData.userId === user.uid;

        if (imgData?.userId && !isOwner) {
          try {
            await addDoc(collection(firestore, "visits"), {
              imageId,
              imageOwnerId: imgData.userId,
              coolId: imgData.coolId,
              type: "visit",
              createdAt: new Date().toISOString(),
            });
          } catch {
            /* ignore visit tracking errors */
          }
        }
        const currentUserId = user?.uid ?? null;

        unsub = onSnapshot(
          query(collection(firestore, "feedbacks"), where("imageId", "==", imageId)),
          (fbSnap) => {
            const list = fbSnap.docs
              .filter((d) => d.data().deleted !== true)
              .map((d) => ({ id: d.id, ...d.data() } as Feedback));
            const withImages = list.filter((f) => f.feedbackImageUrl);

            if (isOwner) {
              setFeedbacks(withImages);
            } else if (currentUserId) {
              setFeedbacks(withImages.filter((f) => f.submitterId === currentUserId));
            } else {
              setFeedbacks([]);
            }
          }
        );
      } catch (err) {
        setFetchAttempted(true);
        setImage(null);
        setFeedbacks([]);
      } finally {
        setLoading(false);
      }
    };
    init();
    return () => unsub?.();
  }, [imageId, user?.uid, authLoading]);

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
    if (!authLoading && !authLoadingState && user && profile && profile.coolId) {
      const isAcceptedInStore = profile.termsAccepted && profile.privacyAccepted;
      if (!isAcceptedInStore) {
        setShowTerms(true);
      } else {
        setShowTerms(false);
      }
    }
  }, [user, profile, authLoading, authLoadingState]);

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !db || !imageId) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image.");
      return;
    }
    setSubmitting(true);
    setActionLoading(true);
    try {
      await ensureFirestoreNetwork();
      const feedbackId = crypto.randomUUID();
      const url = await uploadFeedbackImage(file, feedbackId);

      const { httpsCallable } = await import("firebase/functions");
      const { getAppFunctions } = await import("@/lib/functions");
      const functions = getAppFunctions();
      if (!functions) throw new Error("Firebase not configured");

      const submitFeedback = httpsCallable<
        { imageId: string; parentId: string | null; feedbackImageUrl: string },
        { success: boolean }
      >(functions, "submitFeedback");

      await submitFeedback({
        imageId,
        parentId: replyingTo || null,
        feedbackImageUrl: url,
      });

      setSubmitted(true);
      setReplyingTo(null);
      setTimeout(() => setSubmitted(false), 2000);
    } catch (err: unknown) {
      let msg = "Failed to send. Try again.";
      if (err && typeof err === "object") {
        const e = err as { message?: string; details?: { message?: string } };
        msg = e.details?.message || e.message || msg;
      }
      if (msg.includes("restricted") || msg.includes("cannot submit")) {
        setSubmitted(true);
        setReplyingTo(null);
        setTimeout(() => setSubmitted(false), 2000);
      } else if (msg.includes("Image not found") || msg.includes("expired")) {
        toast.error("This link may have expired. Try refreshing.");
      } else {
        console.error("Submit feedback error:", err);
        toast.error(msg.length > 60 ? "Failed to send. Try again." : msg);
      }
    } finally {
      setSubmitting(false);
      setActionLoading(false);
    }
  };

  const confirmDelete = async () => {
    const f = deleteConfirm;
    if (!f) return;
    setDeleteConfirm(null);
    try {
      const { httpsCallable } = await import("firebase/functions");
      const { getAppFunctions } = await import("@/lib/functions");
      const functions = getAppFunctions();
      if (!functions) throw new Error("Firebase not configured");
      const deleteFeedback = httpsCallable<{ feedbackId: string }, { success: boolean }>(functions, "deleteFeedback");
      await deleteFeedback({ feedbackId: f.id });
      toast.success("Feedback deleted.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete. Try again.");
    }
  };

  const threads = buildThread(feedbacks);
  const isOwner = !authLoading && !!user && !!image?.userId && image.userId === user.uid;

  if (loading || authLoading) return null;

  return (
    <div
      className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]"
      style={{ fontFamily: "'Nunito', var(--font-nunito), sans-serif" }}
    >
      <style>{`:root { --pink: #FF3D7F; --purple: #7C3AFF; --blue: #00C8FF; --green: #00FF94; }`}</style>

      <header className="navbar-glass sticky top-0 z-50 border-b border-[var(--border)]">
        <nav className="mx-auto flex h-16 max-w-2xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center hover:scale-105 transition-transform duration-300">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="picpop" className="h-6 w-auto" />
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href={user ? "/dashboard" : "/login"} className="text-sm font-bold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
              {user ? "dashboard" : "sign in"}
            </Link>
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-2xl px-4 sm:px-6 py-8">
        {!image && fetchAttempted ? (
          <div className="text-center py-16">
            <p className="text-white/50 font-semibold">
              {imageId ? "Image not found or link invalid." : "Invalid link — missing image ID."}
            </p>
            <Link href="/" className="mt-4 inline-block text-[var(--blue)] hover:underline font-bold">
              back to home
            </Link>
          </div>
        ) : !image ? (
          null
        ) : (
          <div className="space-y-6">
            <div>
              <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">
                react with an image
              </p>
              <p className="text-[var(--text-secondary)] font-semibold">@{image.coolId}</p>
            </div>

            <div className="rounded-2xl overflow-hidden bg-black/40 border border-white/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.imageUrl}
                alt=""
                className="w-full h-auto max-h-[400px] object-contain"
              />
            </div>

            <div className="mt-3">
              <ShareButtons
                shareUrl={`/f?imageId=${imageId}`}
                imageUrl={image.imageUrl}
                title="Check out this feedback on PicPop!"
                userFeedbackLink={
                  typeof window !== "undefined"
                    ? `${window.location.origin}/u/${image.coolId}`
                    : undefined
                }
                snapshotData={
                  isOwner
                    ? {
                      imageUrl: image.imageUrl,
                      coolId: image.coolId,
                      feedbackImageUrls: feedbacks
                        .filter((f) => f.feedbackImageUrl)
                        .map((f) => f.feedbackImageUrl),
                    }
                    : { imageUrl: image.imageUrl, coolId: image.coolId, feedbackImageUrls: [] }
                }
              />
            </div>

            {submitted && (
              <div
                className="rounded-2xl px-4 py-3 text-center font-bold text-sm"
                style={{ background: "rgba(0,255,148,0.15)", color: "var(--green)" }}
              >
                <span className="inline-flex items-center gap-2"><Check className="w-4 h-4" /> sent</span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={submitting}
                className="flex-1 rounded-xl px-6 py-4 font-bold text-white transition-all disabled:opacity-50"
                style={{
                  background: "linear-gradient(135deg, var(--pink), var(--purple))",
                  boxShadow: "0 4px 20px rgba(255,61,127,0.35)",
                }}
              >
                {submitting ? "uploading..." : <span className="inline-flex items-center gap-2"><Camera className="w-4 h-4" /> add image reaction</span>}
              </button>
              {replyingTo && (
                <button
                  type="button"
                  onClick={() => setReplyingTo(null)}
                  className="rounded-xl px-4 py-2 text-sm font-bold text-white/60 hover:text-white border border-white/20"
                >
                  cancel reply
                </button>
              )}
            </div>

            {replyingTo && (
              <p className="text-xs text-white/40 font-semibold">replying to a reaction ↓</p>
            )}

            {(isOwner || user) && (
              <div className="pt-6 border-t border-white/10">
                <h3 className="text-xs font-black uppercase tracking-widest text-white/40 mb-4">
                  {isOwner ? "image reactions" : "your reactions"}
                </h3>
                {threads.length === 0 ? (
                  <p className="text-white/40 font-semibold text-sm italic py-4">
                    {isOwner ? "no reactions yet — drop an image above" : "no reactions yet — add one above"}
                  </p>
                ) : (
                  <div className="space-y-4">
                    {threads.map(({ feedback, replies }) => (
                      <FeedbackThreadItem
                        key={feedback.id}
                        feedback={feedback}
                        replies={replies}
                        imageId={imageId}
                        replyingTo={replyingTo}
                        onReply={setReplyingTo}
                        onCancelReply={() => setReplyingTo(null)}
                        onShare={setShareModal}
                        onReport={setReportModal}
                        onDelete={(fb) => setDeleteConfirm(fb)}
                        isOwner={isOwner}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {reportModal && (
        <ReportFeedbackModal
          isOpen={!!reportModal}
          onClose={() => setReportModal(null)}
          feedbackId={reportModal.id}
          onReportSuccess={(action) => {
            if (action === "block") toast.success("Report submitted. User blocked.");
            else toast.success("Report submitted.");
            setReportModal(null);
          }}
          onReportError={(msg) => toast.error(msg)}
        />
      )}

      <ConfirmModal
        isOpen={!!deleteConfirm}
        title="Delete feedback"
        message="This cannot be undone. Delete this feedback?"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm(null)}
      />

      {shareModal && image && (
        <FeedbackShareModal
          isOpen={!!shareModal}
          onClose={() => setShareModal(null)}
          singleFeedback={{ feedbackImageUrl: shareModal.feedbackImageUrl }}
          feedbackId={shareModal.id}
          allData={{
            imageUrl: image.imageUrl,
            coolId: image.coolId,
            feedbackImageUrls: feedbacks.filter((f) => f.feedbackImageUrl).map((f) => f.feedbackImageUrl),
          }}
          shareUrl={`${typeof window !== "undefined" ? window.location.origin : ""}/f?imageId=${imageId}`}
          userFeedbackLink={
            image.coolId && typeof window !== "undefined"
              ? `${window.location.origin}/u/${image.coolId}`
              : undefined
          }
        />
      )}

      <TermsModal
        isOpen={showTerms}
        onAccept={() => setShowTerms(false)}
      />
    </div>
  );
}

export default function FeedbackOnImagePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
          <div
            className="w-12 h-12 rounded-full border-2 border-transparent animate-spin"
            style={{ borderTopColor: "var(--pink)", borderRightColor: "var(--purple)" }}
          />
        </div>
      }
    >
      <FeedbackOnImageContent />
    </Suspense>
  );
}
