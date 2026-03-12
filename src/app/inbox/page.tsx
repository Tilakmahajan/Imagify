"use client";

import { useEffect, useState, useRef, Fragment } from "react";
import Link from "next/link";
import { Bell, Eye, Image as ImageIcon, X, MoreVertical, Trash2, Flag, MessageSquare, Send } from "lucide-react";
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  limit,
  writeBatch,
  doc,
  getDoc,
  getDocs,
} from "firebase/firestore";
import { db, ensureFirestoreNetwork } from "@/lib/firebase";
import { httpsCallable, getFunctions } from "firebase/functions";
import { getAppFunctions } from "@/lib/functions";
import {
  requestNotificationPermission,
  saveFcmToken,
  clearFcmToken,
  getIosPushHint,
} from "@/lib/notifications";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";
import { ThemeToggle } from "@/components/ThemeToggle";
import { FeedbackShareModal } from "@/components/FeedbackShareModal";
import { ReportFeedbackModal } from "@/components/ReportFeedbackModal";
import { TermsModal } from "@/components/TermsModal";
import { getErrorMessage } from "@/lib/error-utils";

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
  feedbackMessage?: string;
  feedbackId?: string;
  anonymousId?: string;
  submitterId?: string;
  submitterIp?: string;
  sessionId?: string;
  isOwnerReply?: boolean;
  targetUid?: string;
  visitorId?: string;
  recipientId?: string;
}

interface GroupedItem {
  id: string;
  itemType: "feedback" | "visit";
  threadType: "inbox" | "sent";
  threadPartnerId: string;
  items: (NotifItem & { itemType: "feedback" | "visit" })[];
  createdAt: string;
  latestItem: NotifItem & { itemType: "feedback" | "visit" };
}

export default function InboxPage() {
  const { user, profile, loading } = useAuth();
  const uid = user?.uid;
  const [notifications, setNotifications] = useState<NotifItem[]>([]);
  const [feedbacks, setFeedbacks] = useState<NotifItem[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [notifStatus, setNotifStatus] = useState<"idle" | "loading" | "enabled" | "denied" | "unsupported">("idle");
  const [selectedGroup, setSelectedGroup] = useState<GroupedItem | null>(null);
  const [feedbackDocId, setFeedbackDocId] = useState<string | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [profileCache, setProfileCache] = useState<Record<string, string>>({});
  const [showTerms, setShowTerms] = useState(() => {
    if (typeof window !== "undefined") {
      const universal = localStorage.getItem("picpop_legal_v1") === "true";
      if (universal) return false;
    }
    return false;
  const optionsRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const viewStartTime = useRef<number>(0);
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
                  feedbackMessage: data.feedbackMessage,
                  feedbackId: data.feedbackId,
                  anonymousId: data.anonymousId,
                  status: data.submitterId ? "verified" : "anonymous",
                  submitterId: data.submitterId,
                  submitterIp: data.submitterIp,
                  sessionId: data.sessionId,
                  isOwnerReply: data.isOwnerReply === true,
                  recipientId: data.recipientId,
                  visitorId: data.visitorId,
                  targetUid: data.targetUid,
                };
              })
            );
          },
          (err) => {
            setLoadingData(false);
            if (err?.code !== "failed-precondition") console.warn("Notifications:", err);
          }
        );

        const processFeedbacks = (snap: any) => {
          const items = snap.docs
            .filter((d: any) => d.data().deleted !== true)
            .map((d: any) => {
              const data = d.data();
              return {
                id: d.id,
                message: "New feedback",
                isRead: false,
                createdAt: toIsoString(data.createdAt),
                type: "anonymous_feedback" as const,
                feedbackImageUrl: data.feedbackImageUrl,
                feedbackMessage: data.message || data.feedbackMessage,
                anonymousId: data.anonymousId,
                submitterId: data.submitterId,
                submitterIp: data.submitterIp,
                sessionId: data.sessionId,
                isOwnerReply: data.isOwnerReply === true,
                recipientId: data.recipientId,
                visitorId: data.visitorId,
                targetUid: data.targetUid,
                coolId: "",
              };
            });

          setFeedbacks(prev => {
            const map = new Map(prev.map(i => [i.id, i]));
            let changed = false;
            for (const item of items) {
              const existing = map.get(item.id);
              if (!existing || JSON.stringify(existing) !== JSON.stringify(item)) {
                // If this is a real item, check if it matches an optimistic one
                if (!item.id.startsWith("opt_")) {
                  for (const [k, v] of map.entries()) {
                    if (k.startsWith("opt_") && v.feedbackMessage === item.feedbackMessage) {
                      map.delete(k);
                      changed = true;
                    }
                  }
                }
                map.set(item.id, item);
                changed = true;
              }
            }
            if (!changed) return prev;
            return Array.from(map.values()).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
          });
        };

        unsubF = onSnapshot(
          query(
            collection(firestore, "feedbacks"),
            where("recipientId", "==", uid),
            limit(100)
          ),
          processFeedbacks,
          (err) => {
            if (err?.code !== "failed-precondition") console.warn("Feedbacks:", err);
          }
        );

        // Also listen for feedbacks you SENT (so you see your own replies/messages in your inbox)
        const unsubFSent = onSnapshot(
          query(
            collection(firestore, "feedbacks"),
            where("submitterId", "==", uid),
            limit(100)
          ),
          processFeedbacks,
          (err) => {
            if (err?.code !== "failed-precondition") console.warn("Sent Feedbacks:", err);
          }
        );

        // Chain the cleanup
        const originalUnsubF = unsubF;
        unsubF = () => {
          originalUnsubF?.();
          unsubFSent?.();
        };

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
      if (typeof unsubF === 'function') unsubF();
    };
  }, [user?.uid]);

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
        if (perm === "denied") {
          toast.error("Notifications blocked by browser. Click the lock icon in the address bar to reset permissions.");
        }
      }
    } catch (err) {
      console.error("Enable notifications:", err);
      setNotifStatus("idle");
      toast.error(getErrorMessage(err));
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

  const latestFeedbackId = selectedGroup ? (selectedGroup.latestItem.feedbackId || selectedGroup.latestItem.id) : null;

  useEffect(() => {
    if (!selectedGroup || !latestFeedbackId) return;
    setReplyText("");
    viewStartTime.current = Date.now();

    const logView = async () => {
      try {
        const { httpsCallable } = await import("firebase/functions");
        const { getAppFunctions } = await import("@/lib/functions");
        const functions = getAppFunctions();
        if (functions) {
          await httpsCallable(functions, "logFeedbackActivity")({ feedbackId: latestFeedbackId, type: "view" });
        }
      } catch (err) { }
    };
    logView();

    return () => {
      const timeSpent = Date.now() - viewStartTime.current;
      if (timeSpent > 500) {
        const logTime = async () => {
          try {
            const { httpsCallable } = await import("firebase/functions");
            const { getAppFunctions } = await import("@/lib/functions");
            const functions = getAppFunctions();
            if (functions) {
              await httpsCallable(functions, "logFeedbackActivity")({ feedbackId: latestFeedbackId, type: "time", timeSpent });
            }
          } catch (err) { }
        };
        logTime();
      }
    };
  }, [selectedGroup, latestFeedbackId]);

  const handleShareClick = () => {
    if (!feedbackDocId) return;
    setShareModalOpen(true);
    const logReshare = async () => {
      try {
        const { httpsCallable } = await import("firebase/functions");
        const { getAppFunctions } = await import("@/lib/functions");
        const functions = getAppFunctions();
        if (functions) {
          await httpsCallable(functions, "logFeedbackActivity")({ feedbackId: feedbackDocId, type: "reshare" });
        }
      } catch (err) { }
    };
    logReshare();
  };

  const handleSelectItem = async (group: GroupedItem) => {
    setSelectedGroup(group);
    // Also set feedbackDocId so the report/share modal has a valid ID immediately
    const docId = group.latestItem.feedbackId || group.latestItem.id;
    setFeedbackDocId(docId);

    // Mark all unread notifications in this group as read
    const unreadIds = group.items
      .filter((i: NotifItem) => !i.isRead)
      .map((i: NotifItem) => {
        if (notifications.some((n: NotifItem) => n.id === i.id)) return i.id;
        const linkedNotif = notifications.find((n: NotifItem) => n.feedbackId === i.id);
        return linkedNotif?.id;
      })
      .filter((id): id is string => !!id);

    if (unreadIds.length > 0 && db) {
      try {
        const firestoreDb = db;
        const batch = writeBatch(firestoreDb);
        unreadIds.forEach(id => {
          batch.update(doc(firestoreDb, "notifications", id), { isRead: true });
        });
        await batch.commit();
      } catch (err) {
        console.error("Error marking group as read:", err);
      }
    }
  };

  const handleDelete = async () => {
    if (!feedbackDocId || !user || !selectedGroup) return;
    setOptionsOpen(false);
    setDeleting(true);
    try {
      const { httpsCallable } = await import("firebase/functions");
      const { getAppFunctions } = await import("@/lib/functions");
      const functions = getAppFunctions();
      if (!functions) throw new Error("Firebase not configured");
      const deleteInboxFeedback = httpsCallable<{ feedbackId: string }, { success: boolean }>(functions, "deleteInboxFeedback");

      for (const item of selectedGroup.items) {
        const id = item.feedbackId || item.id;
        if (id) {
          try {
            await deleteInboxFeedback({ feedbackId: id });
          } catch (e) { }
        }
      }
      setSelectedGroup(null);
      toast.success("Chat deleted");
    } catch (err) {
      console.error(err);
      toast.error(getErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  // ─── FIXED handleSendReply ────────────────────────────────────────────────
  const handleSendReply = async () => {
    if (!replyText.trim() || !selectedGroup || !user) return;

    const text = replyText.trim();
    const items = selectedGroup.items;

    // Find the original non-owner message — this is the person we're replying TO
    const originalMessage =
      items.find(i => !i.isOwnerReply && i.submitterId !== uid) ??
      items.find(i => !i.isOwnerReply) ??
      items.find(i => i.submitterId !== uid) ??
      items[0];

    // Partner's Firebase UID — only set if they are a verified (logged-in) user
    const partnerSubmitterId =
      originalMessage?.submitterId && originalMessage.submitterId !== uid
        ? originalMessage.submitterId
        : null;

    // Anonymous / visitor routing identifiers — prefer visitorId over anonymousId over sessionId
    const visitorId = items.find(i => i.visitorId)?.visitorId ?? null;
    const anonymousId = items.find(i => i.anonymousId)?.anonymousId ?? visitorId ?? null;
    const sessionId = items.find(i => i.sessionId)?.sessionId ?? null;

    // Final routing: UID takes priority, then anonymousId (which includes visitorId), then sessionId
    const routingId = partnerSubmitterId ?? anonymousId ?? sessionId;

    if (!routingId) {
      toast.error("Cannot reply to this message");
      return;
    }

    setReplyText("");

    // Optimistic update — show message in UI immediately
    const optId = "opt_" + Math.random().toString(36).substring(2, 9);
    const optItem: NotifItem = {
      id: optId,
      message: text,
      feedbackMessage: text,
      createdAt: new Date().toISOString(),
      isRead: true,
      type: "anonymous_feedback",
      isOwnerReply: true,
      submitterId: uid,
      recipientId: uid,
      visitorId: visitorId ?? undefined,
      targetUid: partnerSubmitterId ?? undefined,
      sessionId: sessionId ?? undefined,
      coolId: "",
    };

    setFeedbacks(prev => [...prev, optItem]);
    setSendingReply(true);

    try {
      const functions = getAppFunctions();
      if (!functions) throw new Error("Firebase not configured");

      const submitOwnerReply = httpsCallable<{
        message: string;
        anonymousId: string;
        targetUid: string | null;
        sessionId: string | null;
      }, { success: boolean }>(functions, "submitOwnerReply");

      await submitOwnerReply({
        message: text,
        // When routing by UID, send empty anonymousId so the cloud function
        // doesn't get confused about which path to take
        anonymousId: partnerSubmitterId ? "" : (anonymousId ?? ""),
        targetUid: partnerSubmitterId,
        sessionId: sessionId,
      });

      // Remove optimistic item after listener has time to deliver the real doc
      setTimeout(() => {
        setFeedbacks(prev => prev.filter(f => f.id !== optId));
      }, 2000);

    } catch (err: unknown) {
      // Roll back optimistic update and restore the draft text
      setFeedbacks(prev => prev.filter(f => f.id !== optId));
      setReplyText(text);
      toast.error(getErrorMessage(err));
    } finally {
      setSendingReply(false);
    }
  };
  // ─────────────────────────────────────────────────────────────────────────

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

  // Merge: use feedback doc data when available (it has anonymousId, isOwnerReply, etc.)
  // Notifications fill in items not yet fetched via the feedbacks listener
  const fromNotifsFeedback = notifications.filter((n) => n.feedbackImageUrl || n.feedbackMessage);
  const seenKeys = new Set<string>();
  const mergedFeedbackItems: NotifItem[] = [];

  // First add all feedback documents (authoritative source)
  for (const f of feedbacks) {
    if (f.feedbackImageUrl || f.feedbackMessage) {
      seenKeys.add(f.id);
      mergedFeedbackItems.push(f);
    }
  }
  // Then add notification items not already covered by a feedback doc
  for (const n of fromNotifsFeedback) {
    const key = (n as NotifItem & { feedbackId?: string }).feedbackId || n.id;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      mergedFeedbackItems.push(n);
    }
  }

  const feedbackItems = mergedFeedbackItems
    .map((item) => ({ ...item, itemType: "feedback" as const }));

  // Profile resolution for Chats
  useEffect(() => {
    if (!db || feedbackItems.length === 0) return;
    const itemsToResolve = feedbackItems.filter(item => {
      const isMySentFeedbackToOther = item.submitterId === uid && item.recipientId !== uid;
      return isMySentFeedbackToOther && item.recipientId && !profileCache[item.recipientId];
    });

    if (itemsToResolve.length === 0) return;

    const resolve = async () => {
      const newCache = { ...profileCache };
      let changed = false;
      for (const item of itemsToResolve) {
        const rid = item.recipientId!;
        const firestoreDb = db as any;
        try {
          const q = query(collection(firestoreDb, "usernames"), where("uid", "==", rid), limit(1));
          const snap = await getDocs(q);
          if (!snap.empty) {
            newCache[rid] = snap.docs[0].id;
            changed = true;
          }
        } catch (e) {
          console.error("Error resolving profile:", e);
        }
      }
      if (changed) setProfileCache(newCache);
    };
    resolve();
  }, [feedbackItems, uid, profileCache]);

  const fromNotifsVisit = notifications.filter((n) => n.type === "visit");
  const visitItems = fromNotifsVisit.map((item) => ({ ...item, itemType: "visit" as const }));
  const allItems = [...feedbackItems, ...visitItems]
    .filter((item) => {
      if (item.itemType === "visit") return true;
      const isSentToMe = item.recipientId === uid;
      const isSentByMe = item.submitterId === uid;
      const isMyReplyAsOwner = item.submitterId === uid && item.isOwnerReply === true;
      const isMySentFeedbackToOther = item.submitterId === uid && item.recipientId !== uid && item.isOwnerReply === false;
      const isReplyToMySentFeedback = item.recipientId === uid && item.submitterId !== uid && item.isOwnerReply === true;

      if (!isSentToMe && !isSentByMe && !isMyReplyAsOwner && !isMySentFeedbackToOther && !isReplyToMySentFeedback) {
        return false;
      }
      return true;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());


  const groupedMap = new Map<string, GroupedItem>();

  for (const item of allItems) {
    if (item.itemType === "visit") {
      const groupId = "all-visits";
      if (!groupedMap.has(groupId)) {
        groupedMap.set(groupId, {
          id: groupId,
          itemType: "visit",
          threadType: "inbox",
          threadPartnerId: "unknown",
          items: [],
          createdAt: item.createdAt,
          latestItem: item,
        });
      }
      const group = groupedMap.get(groupId)!;
      group.items.push(item);
      if (new Date(item.createdAt).getTime() > new Date(group.createdAt).getTime()) {
        group.createdAt = item.createdAt;
        group.latestItem = item;
      }
    } else {
      let threadType: "inbox" | "sent" = "inbox";
      let threadPartnerId = "unknown";

      const isSentToMe = item.recipientId === uid;
      const isSentByMe = item.submitterId === uid;

      if (isSentToMe && isSentByMe && !item.isOwnerReply) {
        threadType = "inbox";
        threadPartnerId = "self-chat";
      } else if (item.isOwnerReply) {
        if (isSentByMe) {
          threadType = "inbox";
          threadPartnerId = item.visitorId || item.targetUid || item.anonymousId || item.sessionId || "unknown";
        } else {
          threadType = "sent";
          threadPartnerId = item.submitterId || item.visitorId || item.anonymousId || "unknown";
        }
      } else {
        if (isSentToMe) {
          threadType = "inbox";
          threadPartnerId = item.visitorId || item.submitterId || item.anonymousId || item.sessionId || "unknown";
        } else {
          threadType = "sent";
          threadPartnerId = item.recipientId || "unknown";
        }
      }

      // Stability: always use visitorId as the canonical partner key if available
      if (item.visitorId && item.visitorId !== "unknown" && item.visitorId !== "unknown_partner") {
        threadPartnerId = item.visitorId;
      }

      const groupId = `${threadType}_${threadPartnerId}`;

      if (!groupedMap.has(groupId)) {
        groupedMap.set(groupId, {
          id: groupId,
          itemType: "feedback",
          threadType,
          threadPartnerId,
          items: [],
          createdAt: item.createdAt,
          latestItem: item,
        });
      }
      const group = groupedMap.get(groupId)!;
      group.items.push(item);
      if (new Date(item.createdAt).getTime() > new Date(group.createdAt).getTime()) {
        group.createdAt = item.createdAt;
        group.latestItem = item;
      }
    }
  }

  const groupedItems = Array.from(groupedMap.values())
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const getGroupKey = (group: GroupedItem) => `${group.itemType}-${group.id}`;

  // Derive the LIVE group from groupedItems so new messages appear without reopening
  const activeGroup = selectedGroup
    ? (groupedItems.find((g: GroupedItem) => g.id === selectedGroup.id) ?? selectedGroup)
    : null;
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  // Scroll chat modal to bottom when new items arrive
  useEffect(() => {
    if (activeGroup) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeGroup?.items.length]);

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
          <Link href="/dashboard" className="flex items-center hover:scale-105 transition-transform duration-300">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="picpop" className="h-6 w-auto" />
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
        </div>

        {/* Feedback list */}
        <div className="space-y-3">
          {loadingData ? (
            <div className="py-12 text-center">
              <div className="w-8 h-8 rounded-full border-2 border-transparent animate-spin mx-auto" style={{ borderTopColor: "var(--pink)" }} />
            </div>
          ) : groupedItems.length === 0 ? (
            <div className="py-16 text-center">
              <ImageIcon className="w-14 h-14 text-[var(--text-muted)] mx-auto mb-4" />
              <p className="font-semibold text-[var(--text-muted)]">No messages yet</p>
              <p className="text-sm text-[var(--text-muted)] mt-1">Share your link to get started</p>
              <Link href="/dashboard" className="mt-4 inline-block text-[var(--pink)] font-bold hover:underline">Go to dashboard</Link>
            </div>
          ) : (
            <>
              {groupedItems.map((item, index) => (
                <Fragment key={getGroupKey(item)}>
                  {item.itemType === "visit" ? (
                    <div
                      className="w-full p-4 rounded-xl border border-[var(--border)] cursor-pointer hover:bg-white/[0.02] transition-colors"
                      style={{ background: "var(--bg-card)" }}
                      onClick={() => handleSelectItem(item)}
                    >
                      <div className="flex gap-4">
                        <div
                          className="w-16 h-16 rounded-lg flex items-center justify-center shrink-0"
                          style={{ background: "linear-gradient(135deg, rgba(0,200,255,0.2), rgba(0,200,255,0.05))" }}
                        >
                          <Eye className="w-8 h-8 text-[var(--blue)]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm flex items-center gap-2">
                            Someone viewed your link {item.items.length > 1 && <span className="text-[var(--text-muted)] text-xs">({item.items.length})</span>}
                            {item.items.some(i => !i.isRead) && <span className="text-[10px] bg-[var(--pink)] text-white px-1.5 py-0.5 rounded-full font-black uppercase">New!</span>}
                          </p>
                          <p className="text-xs text-[var(--text-muted)]">{formatTimeAgo(item.createdAt)}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSelectItem(item)}
                      className="w-full text-left p-4 rounded-xl border border-[var(--border)] hover:border-[var(--pink)]/30 transition-all hover:bg-white/[0.02] group"
                      style={{ background: "var(--bg-card)" }}
                    >
                      <div className="flex gap-4 items-center">
                        <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0 bg-black/20 flex items-center justify-center relative border border-white/5 shadow-lg transition-transform group-hover:scale-[1.02]">
                          {(() => {
                            const lastImageItem = [...item.items]
                              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                              .find(i => i.feedbackImageUrl);

                            if (lastImageItem?.feedbackImageUrl) {
                              return <img src={lastImageItem.feedbackImageUrl} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />;
                            }
                            return (
                              <div className="absolute inset-0 bg-gradient-to-br from-pink-500/20 to-purple-500/20 flex items-center justify-center">
                                <MessageSquare className="w-10 h-10 text-[var(--pink)] opacity-80" />
                              </div>
                            );
                          })()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-extrabold text-sm text-[var(--text-primary)] truncate flex items-center gap-2">
                            {(() => {
                              const last = item.latestItem;
                              const isMe = last.submitterId === uid;
                              if (last.feedbackMessage) return last.feedbackMessage;
                              if (last.feedbackImageUrl) return isMe ? "You sent an image" : "Sent an image";
                              return "New interaction";
                            })()}

                            {item.threadType === "sent" ? (
                              <span className="text-[9px] bg-[var(--green)]/20 text-[var(--green)] px-1.5 py-0.5 rounded-md font-black uppercase tracking-tighter shrink-0 border border-[var(--green)]/30">
                                @{item.threadPartnerId !== "unknown" ? (profileCache[item.threadPartnerId] || item.threadPartnerId.slice(0, 8)) : "User"}
                              </span>
                            ) : item.items.some(i => i.submitterId && i.submitterId !== uid && !i.isOwnerReply) ? (
                              <span className="text-[9px] bg-[var(--blue)]/20 text-[var(--blue)] px-1.5 py-0.5 rounded-md font-black uppercase tracking-tighter shrink-0 border border-[var(--blue)]/30">Verified User</span>
                            ) : (
                              <span className="text-[9px] bg-white/10 text-[var(--text-muted)] px-1.5 py-0.5 rounded-md font-black uppercase tracking-tighter shrink-0 border border-white/10">Anonymous</span>
                            )}
                          </p>
                          <p className="text-xs text-[var(--text-muted)] mt-1 font-semibold flex items-center gap-1.5">
                            {item.items.some(i => !i.isRead) && <span className="w-1.5 h-1.5 rounded-full bg-[var(--pink)] animate-pulse"></span>}
                            {item.items.length} {item.items.length === 1 ? 'message' : 'interactions'}
                          </p>
                          <p className="text-[10px] text-[var(--text-muted)] mt-2 font-medium opacity-60">{formatTimeAgo(item.createdAt)}</p>
                        </div>
                      </div>
                    </button>
                  )}
                </Fragment>
              ))}
            </>
          )}
        </div>
      </main>

      {/* Chat modal */}
      {activeGroup && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-overlay"
          onClick={() => { setSelectedGroup(null); setOptionsOpen(false); }}
        >
          <div
            className="max-w-lg w-full min-h-[85vh] max-h-[95vh] rounded-2xl overflow-hidden flex flex-col relative"
            style={{ background: "var(--modal-card-bg)", border: "1px solid rgba(255,255,255,0.15)" }}
            onClick={(e) => e.stopPropagation()}
          >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[#101010]/80 backdrop-blur-md sticky top-0 z-10">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedGroup(null)}
                    className="p-2 -ml-2 rounded-lg hover:bg-white/5 text-[var(--text-primary)]"
                  >
                    <X className="w-5 h-5" />
                  </button>
                  <div>
                    <p className="text-sm font-black text-[var(--text-primary)] flex items-center gap-2">
                      {activeGroup.threadType === "sent"
                        ? `@${activeGroup.threadPartnerId !== "unknown" ? (profileCache[activeGroup.threadPartnerId] || activeGroup.threadPartnerId.slice(0, 8)) : "User"}`
                        : (activeGroup.items.find(i => !i.isOwnerReply && i.submitterId)) ? "Verified User" : "Anonymous User"}
                    </p>
                    <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest flex items-center gap-3">
                      <span>{activeGroup?.items.length} {activeGroup?.items.length === 1 ? 'message' : 'messages'}</span>
                      {activeGroup?.latestItem.sessionId && (
                        <span className="opacity-40">SID: {activeGroup.latestItem.sessionId.slice(0, 8)}...</span>
                      )}
                    </p>
                  </div>
                </div>

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
                          <Trash2 className="w-4 h-4" /> Delete Chat
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setOptionsOpen(false);
                            setFeedbackDocId(latestFeedbackId || "");
                            setReportModalOpen(true);
                          }}
                          className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm font-bold text-[var(--text-primary)] hover:bg-white/5 min-h-[44px]"
                          style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
                        >
                          <Flag className="w-4 h-4" /> Report User
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 pb-2 flex flex-col gap-3" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.1) transparent" }}>
                {activeGroup.items.slice().sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()).map((chatItem, idx) => {
                  const isMe = chatItem.submitterId === uid || (chatItem.isOwnerReply && activeGroup.threadType === "inbox");
                  return (
                    <div key={idx} className={`flex flex-col gap-0.5 ${isMe ? "items-end" : "items-start"}`}>
                      <div className={`flex items-end gap-2 max-w-[78%] ${isMe ? "flex-row-reverse" : ""}`}>
                        <div className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-xs font-black text-white ${isMe
                          ? "bg-gradient-to-br from-pink-500 to-purple-600"
                          : chatItem.submitterId
                            ? "bg-gradient-to-br from-blue-500 to-blue-600"
                            : "bg-gradient-to-br from-gray-600 to-gray-700"
                          }`}>
                          {isMe ? "You" : chatItem.submitterId ? "V" : "U"}
                        </div>
                        <div className={`rounded-2xl px-4 py-2.5 ${isMe
                          ? "rounded-br-sm text-white"
                          : "rounded-bl-sm border border-[var(--border)]"
                          }`}
                          style={isMe
                            ? { background: "linear-gradient(135deg, var(--pink), var(--purple))" }
                            : { background: "var(--bg-secondary)" }}>
                          {chatItem.feedbackImageUrl && (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img src={chatItem.feedbackImageUrl} alt="img" className="rounded-xl max-w-[240px] w-full object-contain mb-1 cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                setFeedbackDocId(chatItem.feedbackId || chatItem.id);
                                setShareModalOpen(true);
                              }}
                            />
                          )}
                          {chatItem.feedbackMessage && (
                            <div className="flex flex-col gap-1">
                              {chatItem.submitterId && !isMe && idx === 0 && (
                                <span className="text-[8px] font-black text-blue-400 uppercase tracking-tighter">Verified Sender</span>
                              )}
                              <p className="text-sm font-semibold whitespace-pre-wrap leading-relaxed">{chatItem.feedbackMessage}</p>
                            </div>
                          )}
                        </div>
                      </div>
                      <span className={`text-[10px] text-[var(--text-muted)] ${isMe ? "mr-9" : "ml-9"}`}>
                        {formatTimeAgo(chatItem.createdAt)}
                      </span>
                    </div>
                  );
                })}
                <div ref={chatEndRef} />
              </div>

              {/* Reply input */}
              <div className="p-3 border-t border-[var(--border)] bg-[#101010]/80 backdrop-blur-md sticky bottom-0">
                <div className="flex items-center gap-2">
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendReply();
                      }
                    }}
                    placeholder="Type a reply... (Enter to send)"
                    className="flex-1 max-h-32 min-h-[44px] rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-sm focus:outline-none focus:border-[var(--pink)] resize-none"
                    rows={1}
                  />
                  <button
                    type="button"
                    disabled={!replyText.trim() || sendingReply}
                    onClick={handleSendReply}
                    className="p-2.5 rounded-full text-white hover:opacity-90 disabled:opacity-40 shrink-0 transition-all hover:scale-105"
                    style={{ background: "linear-gradient(135deg, var(--pink), var(--purple))" }}
                  >
                    {sendingReply ? (
                      <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
              </div>
            </div>
          )}

      {shareModalOpen && profile && (
        <FeedbackShareModal
          isOpen={shareModalOpen}
          onClose={() => setShareModalOpen(false)}
          singleFeedback={{
            feedbackImageUrl: activeGroup?.items.find(i => (i.feedbackId || i.id) === feedbackDocId)?.feedbackImageUrl || ""
          }}
          feedbackId={feedbackDocId}
          allData={{
            imageUrl: activeGroup?.items.find(i => (i.feedbackId || i.id) === feedbackDocId)?.feedbackImageUrl || "",
            coolId: profile.coolId ?? "picpop",
            feedbackImageUrls: [],
          }}
          shareUrl={`${typeof window !== "undefined" ? window.location.origin : ""}/u/${profile.coolId ?? "picpop"}`}
          userFeedbackLink={`${typeof window !== "undefined" ? window.location.origin : ""}/u/${profile.coolId ?? "picpop"}`}
        />
      )}

      <TermsModal
        isOpen={showTerms}
        onAccept={() => setShowTerms(false)}
      />

      <ReportFeedbackModal
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        feedbackId={feedbackDocId || ""}
        onReportSuccess={(action) => {
          if (action === "block") toast.success?.("Report submitted. User blocked.");
          else toast.success?.("Report submitted");
          setSelectedGroup(null);
        }}
        onReportError={(msg) => toast.error?.(msg)}
      />
    </div>
  );
}