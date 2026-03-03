"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { Bell, Eye, Image as ImageIcon, X, MoreVertical, Trash2, Flag } from "lucide-react";
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  limit,
  writeBatch,
  doc,
} from "firebase/firestore";
import { db, ensureFirestoreNetwork } from "@/lib/firebase";
import {
  requestNotificationPermission,
  saveFcmToken,
  clearFcmToken,
  onForegroundMessage,
  getIosPushHint,
} from "@/lib/notifications";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";
import { ThemeToggle } from "@/components/ThemeToggle";
import { FeedbackShareModal } from "@/components/FeedbackShareModal";
import { ReportFeedbackModal } from "@/components/ReportFeedbackModal";

function formatTimeAgo(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function toIsoString(val: unknown): string {
  if (!val) return new Date().toISOString();
  if (typeof val === "string") return val;
  if (val && typeof val === "object" && "toDate" in val && typeof (val as { toDate: () => Date }).toDate === "function") {
    return (val as { toDate: () => Date }).toDate().toISOString();
  }
  return new Date().toISOString();
}

interface NotifItem {
  id: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  type: "anonymous_feedback" | "visit";
  imageId?: string;
  coolId?: string;
  feedbackImageUrl?: string;
  feedbackId?: string;
}

export default function InboxPage() {
  const { user, profile, loading } = useAuth();
  const [notifications, setNotifications] = useState<NotifItem[]>([]);
  const [feedbacks, setFeedbacks] = useState<NotifItem[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [notifStatus, setNotifStatus] = useState<"idle" | "loading" | "enabled" | "denied" | "unsupported">("idle");
  const [selectedFeedback, setSelectedFeedback] = useState<NotifItem | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [filter, setFilter] = useState<"all" | "responses">("all");
  const optionsRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (optionsRef.current && !optionsRef.current.contains(e.target as Node)) {
        setOptionsOpen(false);
      }
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotifStatus(
        Notification.permission === "granted" ? "enabled" : Notification.permission === "denied" ? "denied" : "idle"
      );
    } else {
      setNotifStatus("unsupported");
    }
  }, []);

  useEffect(() => {
    if (!db || !user?.uid) {
      setLoadingData(false);
      return;
    }
    const firestore = db;
    const uid = user.uid;
    let unsubN: (() => void) | undefined;
    let unsubF: (() => void) | undefined;

    const run = async () => {
      try {
        await ensureFirestoreNetwork();

        unsubN = onSnapshot(
          query(
            collection(firestore, "notifications"),
            where("recipientId", "==", uid),
            orderBy("createdAt", "desc"),
            limit(100)
          ),
          (snap) => {
            setNotifications(
              snap.docs.map((d) => {
                const data = d.data();
                return {
                  id: d.id,
                  message: data.message || "",
                  isRead: data.isRead === true,
                  createdAt: toIsoString(data.createdAt),
                  type: data.type === "visit" ? "visit" : "anonymous_feedback",
                  imageId: data.imageId,
                  coolId: data.coolId || "post",
                  feedbackImageUrl: data.feedbackImageUrl,
                  feedbackId: data.feedbackId,
                };
              })
            );
          },
          (err) => {
            setLoadingData(false);
            if (err?.code !== "failed-precondition") console.warn("Notifications:", err);
          }
        );

        unsubF = onSnapshot(
          query(
            collection(firestore, "feedbacks"),
            where("recipientId", "==", uid),
            orderBy("createdAt", "desc"),
            limit(100)
          ),
          (snap) => {
            setFeedbacks(
              snap.docs
                .filter((d) => d.data().deleted !== true)
                .map((d) => {
                  const data = d.data();
                  return {
                    id: d.id,
                    message: "New feedback",
                    isRead: false,
                    createdAt: toIsoString(data.createdAt),
                    type: "anonymous_feedback" as const,
                    feedbackImageUrl: data.feedbackImageUrl,
                    coolId: "",
                  };
                })
            );
          },
          (err) => {
            if (err?.code !== "failed-precondition") console.warn("Feedbacks:", err);
          }
        );
      } catch {
        setNotifications([]);
        setFeedbacks([]);
      } finally {
        setLoadingData(false);
      }
    };
    run();
    return () => {
      unsubN?.();
      unsubF?.();
    };
  }, [user?.uid]);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    onForegroundMessage((payload) => {
      const body = payload.notification?.body ?? payload.data?.body;
      if (body) toast.info(body);
    }).then((fn) => { unsub = fn; });
    return () => unsub?.();
  }, [toast]);

  const handleEnableNotifications = async () => {
    if (notifStatus === "enabled" || notifStatus === "unsupported") return;
    if (!user) {
      toast.error("Please sign in first");
      return;
    }
    const iosHint = getIosPushHint();
    if (iosHint) {
      toast.error(iosHint);
      return;
    }
    setNotifStatus("loading");
    try {
      const token = await requestNotificationPermission();
      if (token && user) {
        await saveFcmToken(user.uid, token);
        setNotifStatus("enabled");
        toast.success("Notifications enabled");
      } else {
        const perm = typeof Notification !== "undefined" ? Notification.permission : "denied";
        setNotifStatus(perm === "denied" ? "denied" : "idle");
        if (perm === "denied") toast.error("Notifications blocked");
      }
    } catch (err) {
      console.error("Enable notifications:", err);
      setNotifStatus("idle");
      toast.error("Could not enable notifications");
    }
  };

  const handleDisableNotifications = async () => {
    if (notifStatus !== "enabled" || !user) return;
    setNotifStatus("loading");
    try {
      await clearFcmToken(user.uid);
      setNotifStatus("idle");
      toast.success("Notifications disabled");
    } catch (err) {
      console.error("Disable notifications:", err);
      setNotifStatus("enabled");
      toast.error("Could not disable notifications");
    }
  };

  const feedbackDocId = selectedFeedback ? ((selectedFeedback as NotifItem & { feedbackId?: string }).feedbackId || selectedFeedback.id) : null;

  const handleDelete = async () => {
    if (!feedbackDocId || !user) return;
    setOptionsOpen(false);
    setDeleting(true);
    try {
      const { httpsCallable } = await import("firebase/functions");
      const { getAppFunctions } = await import("@/lib/functions");
      const functions = getAppFunctions();
      if (!functions) throw new Error("Firebase not configured");
      const deleteInboxFeedback = httpsCallable<{ feedbackId: string }, { success: boolean }>(functions, "deleteInboxFeedback");
      await deleteInboxFeedback({ feedbackId: feedbackDocId });
      setSelectedFeedback(null);
      toast.success("Deleted");
    } catch (err) {
      console.error(err);
      toast.error("Could not delete");
    } finally {
      setDeleting(false);
    }
  };

  const handleMarkAllRead = async () => {
    const unread = notifications.filter((n) => !n.isRead);
    if (unread.length === 0 || !db) return;
    const firestore = db;
    try {
      const batch = writeBatch(firestore);
      for (const n of unread) {
        batch.update(doc(firestore, "notifications", n.id), { isRead: true });
      }
      await batch.commit();
      toast.success("Marked all as read");
    } catch {
      toast.error("Could not mark as read");
    }
  };

  // Feedback items: notifications + feedbacks with image. Visit items: notifications with type "visit".
  const fromNotifsFeedback = notifications.filter((n) => n.feedbackImageUrl);
  const fromNotifsVisit = notifications.filter((n) => n.type === "visit");
  const fromFeedbacks = feedbacks.filter((f) => f.feedbackImageUrl);
  const seenKeys = new Set<string>();
  const feedbackItems = [...fromNotifsFeedback, ...fromFeedbacks]
    .filter((item) => {
      const key = (item as NotifItem & { feedbackId?: string }).feedbackId || item.id;
      if (seenKeys.has(key)) return false;
      seenKeys.add(key);
      return true;
    })
    .map((item) => ({ ...item, itemType: "feedback" as const }));
  const visitItems = fromNotifsVisit.map((item) => ({ ...item, itemType: "visit" as const }));
  const allItems = [...feedbackItems, ...visitItems]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const responsesItems = [...feedbackItems].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const filteredItems = filter === "responses" ? responsesItems : allItems;

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: "var(--pink)" }} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col items-center justify-center">
        <p className="text-[var(--text-muted)] font-semibold">Sign in to view your inbox</p>
        <Link href="/login" className="mt-4 text-[var(--pink)] font-bold hover:underline">Sign in</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <style>{`:root { --pink: #FF3D7F; --purple: #7C3AFF; --blue: #00C8FF; --green: #00FF94; }`}</style>

      <header className="navbar-glass sticky top-0 z-50 border-b border-[var(--border)]">
        <nav className="flex h-14 items-center justify-between px-4 max-w-[600px] mx-auto">
          <Link href="/dashboard" className="text-lg font-black">
            picpop<span className="text-[var(--pink)]">.</span>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/dashboard" className="text-sm font-bold text-[var(--text-muted)] hover:text-[var(--text-primary)]">Dashboard</Link>
          </div>
        </nav>
      </header>

      <main className="max-w-[600px] mx-auto px-4 py-6">
        <h1 className="text-xl font-black mb-6">Inbox</h1>

        {/* Notifications toggle */}
        <div className="flex flex-col gap-2 p-4 rounded-2xl mb-6 border border-[var(--border)]" style={{ background: "var(--bg-card)" }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-[var(--pink)]" />
              <span className="font-bold text-sm">Push notifications</span>
            </div>
            {notifStatus === "unsupported" ? (
              <span className="text-xs text-[var(--text-muted)]">Not supported</span>
          ) : notifStatus === "denied" ? (
            <span className="text-xs text-[var(--text-muted)]">Blocked by browser</span>
          ) : notifStatus === "loading" ? (
            <span className="text-xs font-bold text-[var(--text-muted)]">...</span>
          ) : notifStatus === "enabled" ? (
            <button
              type="button"
              onClick={handleDisableNotifications}
              className="relative w-12 h-7 rounded-full transition-colors flex-shrink-0 cursor-pointer"
              style={{ background: "var(--green)" }}
              aria-label="Turn off notifications"
            >
              <span
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-white shadow"
              />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleEnableNotifications}
              className="relative w-12 h-7 rounded-full transition-colors flex-shrink-0 cursor-pointer"
              style={{ background: "var(--bg-secondary)", border: "2px solid var(--border)" }}
              aria-label="Turn on notifications"
            >
              <span
                className="absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow"
              />
            </button>
          )}
          </div>
          {getIosPushHint() && (
            <p className="text-xs text-amber-400/90">
              {getIosPushHint()}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between mb-4">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="text-xs font-bold text-[var(--pink)] hover:text-[var(--purple)]"
            >
              Mark all read
            </button>
          )}
          <div className="flex gap-1 ml-auto">
            <button
              type="button"
              onClick={() => setFilter("all")}
              style={{ touchAction: "manipulation" }}
              className={`px-4 py-2 min-h-[36px] rounded-xl text-xs font-bold transition-colors ${
                filter === "all"
                  ? "bg-[var(--pink)] text-white"
                  : "bg-white/5 text-[var(--text-muted)] hover:text-white"
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setFilter("responses")}
              style={{ touchAction: "manipulation" }}
              className={`px-4 py-2 min-h-[36px] rounded-xl text-xs font-bold transition-colors ${
                filter === "responses"
                  ? "bg-[var(--pink)] text-white"
                  : "bg-white/5 text-[var(--text-muted)] hover:text-white"
              }`}
            >
              Responses
            </button>
          </div>
        </div>

        {/* Feedback list */}
        <div className="space-y-3">
          {loadingData ? (
            <div className="py-12 text-center">
              <div className="w-8 h-8 rounded-full border-2 border-transparent animate-spin mx-auto" style={{ borderTopColor: "var(--pink)" }} />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-16 text-center">
              <ImageIcon className="w-14 h-14 text-[var(--text-muted)] mx-auto mb-4" />
              <p className="font-semibold text-[var(--text-muted)]">
                {filter === "responses" ? "No responses yet" : "No feedback yet"}
              </p>
              <p className="text-sm text-[var(--text-muted)] mt-1">
                {filter === "responses" ? "Feedback with images will appear here" : "Share your link to get started"}
              </p>
              <Link href="/dashboard" className="mt-4 inline-block text-[var(--pink)] font-bold hover:underline">Go to dashboard</Link>
            </div>
          ) : (
            filteredItems.map((item) =>
              item.itemType === "visit" ? (
                <div
                  key={item.id}
                  className="w-full p-4 rounded-xl border border-[var(--border)]"
                  style={{ background: "var(--bg-card)" }}
                >
                  <div className="flex gap-4">
                    <div
                      className="w-16 h-16 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: "linear-gradient(135deg, rgba(0,200,255,0.2), rgba(0,200,255,0.05))" }}
                    >
                      <Eye className="w-8 h-8 text-[var(--blue)]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm">Someone viewed your link</p>
                      <p className="text-xs text-[var(--text-muted)]">{formatTimeAgo(item.createdAt)}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedFeedback(item)}
                  className="w-full text-left p-4 rounded-xl border border-[var(--border)] hover:border-[var(--pink)]/30 transition-colors"
                  style={{ background: "var(--bg-card)" }}
                >
                  <div className="flex gap-4">
                    <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0 bg-black/20">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.feedbackImageUrl} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm">New feedback</p>
                      <p className="text-xs text-[var(--text-muted)]">{formatTimeAgo(item.createdAt)}</p>
                    </div>
                  </div>
                </button>
              )
            )
          )}
        </div>
      </main>

      {/* Feedback modal */}
      {selectedFeedback && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-overlay"
          onClick={() => { setSelectedFeedback(null); setOptionsOpen(false); }}
        >
          <div
            className="max-w-lg w-full min-h-[85vh] max-h-[95vh] rounded-2xl overflow-y-auto flex flex-col"
            style={{ background: "var(--modal-card-bg)", border: "1px solid rgba(255,255,255,0.15)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header: close + options menu */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)]">
              <p className="text-xs font-bold text-[var(--text-muted)]">{formatTimeAgo(selectedFeedback.createdAt)}</p>
              <div className="flex items-center gap-1">
                <div className="relative" ref={optionsRef}>
                  <button
                    type="button"
                    onClick={() => setOptionsOpen(!optionsOpen)}
                    disabled={deleting}
                    className="p-2 rounded-lg hover:bg-white/5 text-[var(--text-muted)]"
                    aria-label="More options"
                  >
                    <MoreVertical className="w-5 h-5" />
                  </button>
                  {optionsOpen && (
                    <div
                      className="absolute right-0 top-full mt-1 py-1 min-w-[140px] rounded-xl border border-[var(--border)] shadow-xl z-10"
                      style={{ background: "var(--bg-card)" }}
                    >
                      <button
                        type="button"
                        onClick={handleDelete}
                        disabled={deleting}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm font-bold text-red-500 hover:bg-white/5 disabled:opacity-50 min-h-[44px]"
                        style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
                      >
                        <Trash2 className="w-4 h-4" /> Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => { setOptionsOpen(false); setReportModalOpen(true); }}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm font-bold text-[var(--text-primary)] hover:bg-white/5 min-h-[44px]"
                        style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
                      >
                        <Flag className="w-4 h-4" /> Report
                      </button>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedFeedback(null)}
                  className="p-2 rounded-lg hover:bg-white/5 text-[var(--text-muted)]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-4 pb-6 flex-1 min-h-0 flex flex-col">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selectedFeedback.feedbackImageUrl}
                alt="Feedback"
                className="w-full rounded-xl object-contain max-h-[70vh] min-h-[280px]"
              />

              <div className="mt-5">
                <button
                  type="button"
                  onClick={() => setShareModalOpen(true)}
                  className="w-full py-3.5 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all hover:opacity-90"
                  style={{
                    background: "linear-gradient(135deg, var(--pink), var(--purple))",
                    boxShadow: "0 4px 20px rgba(255,61,127,0.3)",
                    touchAction: "manipulation",
                    WebkitTapHighlightColor: "transparent",
                  }}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  Share
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedFeedback?.feedbackImageUrl && shareModalOpen && profile && (
        <FeedbackShareModal
          isOpen={shareModalOpen}
          onClose={() => setShareModalOpen(false)}
          singleFeedback={{ feedbackImageUrl: selectedFeedback.feedbackImageUrl }}
          allData={{
            imageUrl: selectedFeedback.feedbackImageUrl,
            coolId: profile.coolId,
            feedbackImageUrls: [],
          }}
          shareUrl={`${typeof window !== "undefined" ? window.location.origin : ""}/u/${profile.coolId}`}
          userFeedbackLink={`${typeof window !== "undefined" ? window.location.origin : ""}/u/${profile.coolId}`}
        />
      )}

      <ReportFeedbackModal
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        feedbackId={feedbackDocId || ""}
        onReportSuccess={(action) => {
          if (action === "block") toast.success("Report submitted. User blocked.");
          else toast.success("Report submitted");
          setSelectedFeedback(null);
        }}
        onReportError={(msg) => toast.error(msg)}
      />
    </div>
  );
}
