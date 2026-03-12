"use client";

import { useEffect, useState, useRef } from "react";
import { Bell, Eye, Image as ImageIcon } from "lucide-react";
import Link from "next/link";
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
} from "@/lib/notifications";
import { useToast } from "@/lib/toast-context";

export interface NotificationItem {
  id: string;
  recipientId: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  type: "anonymous_feedback" | "visit";
  imageId?: string;
  coolId?: string;
  feedbackImageUrl?: string;
}

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

interface NotificationsSectionProps {
  userId: string;
  images: { id: string; coolId: string }[];
}

export function NotificationsSection({ userId }: NotificationsSectionProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notifStatus, setNotifStatus] = useState<"idle" | "loading" | "enabled" | "denied" | "unsupported">("idle");
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const prevCountRef = useRef(0);
  const toast = useToast();

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const hasUnread = unreadCount > 0;

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotifStatus(
        Notification.permission === "granted" ? "enabled" : Notification.permission === "denied" ? "denied" : "idle"
      );
    }
  }, []);

  // Firestore real-time listener: notifications where recipientId == userId
  useEffect(() => {
    if (!db || !userId) {
      setLoading(false);
      return;
    }
    const firestore = db;
    let unsub: (() => void) | undefined;
    const run = async () => {
      try {
        await ensureFirestoreNetwork();
        const q = query(
          collection(firestore, "notifications"),
          where("recipientId", "==", userId),
          orderBy("createdAt", "desc"),
          limit(100)
        );
        unsub = onSnapshot(
          q,
          (snap) => {
            const list: NotificationItem[] = snap.docs.map((d) => {
              const data = d.data();
              return {
                id: d.id,
                recipientId: data.recipientId || "",
                message: data.message || "",
                isRead: data.isRead === true,
                createdAt: toIsoString(data.createdAt),
                type: data.type === "visit" ? "visit" : "anonymous_feedback",
                imageId: data.imageId,
                coolId: data.coolId || "post",
                feedbackImageUrl: data.feedbackImageUrl,
              };
            });
            setNotifications(list);

            // Foreground toast: when a new notification arrives (count increased)
            if (list.length > prevCountRef.current && prevCountRef.current > 0) {
              const latest = list[0];
              if (latest) {
                const msg = latest.type === "visit" ? "Someone viewed your link" : "New reaction on your post";
                setToastMsg(msg);
                toast.info(msg);
                setTimeout(() => setToastMsg(null), 4000);
              }
            }
            prevCountRef.current = list.length;
          },
          () => setLoading(false)
        );
      } catch {
        setNotifications([]);
      } finally {
        setLoading(false);
      }
    };
    run();
    return () => unsub?.();
  }, [userId, toast]);


  const handleEnableNotifications = async () => {
    if (notifStatus === "enabled" || notifStatus === "unsupported") return;
    setNotifStatus("loading");
    try {
      const token = await requestNotificationPermission();
      if (token) {
        await saveFcmToken(userId, token);
        setNotifStatus("enabled");
      } else {
        setNotifStatus(Notification.permission === "denied" ? "denied" : "idle");
      }
    } catch {
      setNotifStatus("idle");
    }
  };

  const handleMarkAllRead = async () => {
    const unread = notifications.filter((n) => !n.isRead);
    if (unread.length === 0) return;
    if (!db) return;
    const firestore = db;
    try {
      const batch = writeBatch(firestore);
      for (const n of unread) {
        batch.update(doc(firestore, "notifications", n.id), { isRead: true });
      }
      await batch.commit();
    } catch (err) {
      console.error("Mark read failed:", err);
      toast.error("Could not mark as read.");
    }
  };

  return (
    <div className="post-card overflow-hidden">
      <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
        <h3 className="text-sm font-black uppercase tracking-wider text-white/80">Notifications</h3>
        <div className="flex items-center gap-2">
          {hasUnread && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="text-xs font-bold text-[var(--pink)] hover:text-[var(--purple)]"
            >
              mark all read
            </button>
          )}
          {notifStatus === "enabled" ? (
            <span className="text-xs font-bold text-[var(--green)] flex items-center gap-1">
              <Bell className="w-3.5 h-3.5 shrink-0" /> push on
            </span>
          ) : notifStatus === "denied" ? (
            <span className="text-xs font-bold text-white/40">blocked</span>
          ) : notifStatus !== "unsupported" ? (
            <button
              type="button"
              onClick={handleEnableNotifications}
              disabled={notifStatus === "loading"}
              className="text-xs font-bold text-[var(--pink)] hover:text-[var(--purple)] disabled:opacity-50"
            >
              {notifStatus === "loading" ? "..." : "enable push"}
            </button>
          ) : null}
        </div>
      </div>

      {toastMsg && (
        <div
          className="mx-4 mt-3 rounded-xl px-4 py-2.5 text-sm font-bold"
          style={{
            background: "linear-gradient(135deg, rgba(255,61,127,0.2), rgba(124,58,255,0.2))",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "#fff",
          }}
        >
          <span className="inline-flex items-center gap-2"><Bell className="w-4 h-4 shrink-0" /> {toastMsg}</span>
        </div>
      )}

      <div className="max-h-[280px] overflow-y-auto">
        {loading ? (
          <div className="p-8 text-center">
            <div
              className="w-8 h-8 rounded-full border-2 border-transparent animate-spin mx-auto"
              style={{ borderTopColor: "var(--pink)", borderRightColor: "var(--purple)" }}
            />
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center">
            <p className="mb-2"><Bell className="w-12 h-12 text-white/40 mx-auto" /></p>
            <p className="text-sm text-white/50 font-semibold">No notifications yet</p>
            <p className="text-xs text-white/40 mt-1">Visits & reactions will appear here in real-time</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {notifications.map((n) => (
              <Link
                key={n.id}
                href={n.imageId ? `/f?imageId=${n.imageId}` : "/dashboard"}
                className={`flex items-center gap-3 px-4 py-3 transition-colors ${!n.isRead ? "opacity-90 hover:opacity-100" : "hover:bg-white/5"}`}
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                  style={{
                    background:
                      n.type === "visit"
                        ? "linear-gradient(135deg, rgba(0,200,255,0.3), rgba(0,200,255,0.1))"
                        : "linear-gradient(135deg, rgba(255,61,127,0.3), rgba(124,58,255,0.2))",
                  }}
                >
                  {n.type === "visit" ? (
                    <Eye className="w-5 h-5 text-white/80" />
                  ) : (
                    <ImageIcon className="w-5 h-5 text-white/80" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold truncate ${!n.isRead ? "text-white" : "text-white/70"}`}>
                    {n.type === "visit" ? "Someone viewed your link" : "New reaction on your post"}
                  </p>
                  <p className={`text-xs ${!n.isRead ? "text-white/50" : "text-white/40"}`}>
                    @{n.coolId} · {formatTimeAgo(n.createdAt)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
