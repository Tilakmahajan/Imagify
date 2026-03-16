"use client";

import { useEffect, useState, useRef, Fragment } from "react";
import Link from "next/link";
import { Bell, Eye, Image as ImageIcon, X, MoreVertical, Trash2, Flag, MessageSquare, Send, Paperclip, FileText, CheckCircle2, Share2 } from "lucide-react";
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
  onForegroundMessage,
} from "@/lib/notifications";
import { uploadAttachment } from "@/lib/image-upload";
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
  type: "anonymous_feedback" | "visit" | "owner_reply";
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
  attachmentUrl?: string;
  attachmentName?: string;
  threadId?: string;
}

interface GroupedItem {
  id: string;
  itemType: "feedback" | "visit";
  threadType: "inbox" | "sent";
  threadPartnerId: string;
  items: (NotifItem & { itemType: "feedback" | "visit" })[];
  createdAt: string;
  latestItem: NotifItem & { itemType: "feedback" | "visit" };
  sharedImageUrl?: string;
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
  const [resolvingIds, setResolvingIds] = useState<Set<string>>(new Set());
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showTerms, setShowTerms] = useState(() => {
    if (typeof window !== "undefined") {
      const universal = localStorage.getItem("picpop_legal_v1") === "true";
      if (universal) return false;
    }
    return false;
  });

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
                  feedbackMessage: data.feedbackMessage,
                  feedbackId: data.feedbackId,
                  anonymousId: data.anonymousId,
                  submitterId: data.submitterId,
                  submitterIp: data.submitterIp,
                  sessionId: data.sessionId,
                  isOwnerReply: data.isOwnerReply === true,
                  recipientId: data.recipientId,
                  visitorId: data.visitorId,
                  targetUid: data.targetUid,
                  threadId: data.threadId,
                };
              })
            );
          },
          (err) => {
            setLoadingData(false);
            if (err?.code !== "failed-precondition") console.warn("Notifications:", err);
          }
        );

        const processFeedbacksList = (snap: any) => {
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
                attachmentUrl: data.attachmentUrl,
                attachmentName: data.attachmentName,
                submitterId: data.submitterId,
                submitterIp: data.submitterIp,
                sessionId: data.sessionId,
                isOwnerReply: data.isOwnerReply === true,
                recipientId: data.recipientId,
                visitorId: data.visitorId,
                targetUid: data.targetUid,
                threadId: data.threadId,
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
            orderBy("createdAt", "desc"),
            limit(100)
          ),
          processFeedbacksList,
          (err) => {
            if (err?.code !== "failed-precondition") console.warn("Feedbacks:", err);
          }
        );

        // Also listen for feedbacks you SENT (so you see your own replies/messages in your inbox)
        const unsubFSent = onSnapshot(
          query(
            collection(firestore, "feedbacks"),
            where("submitterId", "==", uid),
            orderBy("createdAt", "desc"),
            limit(100)
          ),
          processFeedbacksList,
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
    // 1. FAST CHECK: If this device has already accepted, don't show the modal
    if (typeof window !== "undefined") {
      const universal = localStorage.getItem("picpop_legal_v1") === "true";
      const userSpecific = user?.uid ? localStorage.getItem(`picpop_terms_accepted_${user.uid}`) === "true" : false;
      if (universal || userSpecific) {
        setShowTerms(false);
        return;
      }
    }

    // 2. BACKUP CHECK: For logged-in users, check Firestore profile
    if (!loading && user && profile && profile.coolId) {
      const isAcceptedInStore = profile.termsAccepted && profile.privacyAccepted;
      if (!isAcceptedInStore) {
        setShowTerms(true);
      } else {
        setShowTerms(false);
      }
    } else if (!loading && !user) {
      // 3. GUEST CHECK: Prompt if on this device haven't accepted yet
      const universal = typeof window !== "undefined" ? localStorage.getItem("picpop_legal_v1") === "true" : false;
      if (!universal) {
        setShowTerms(true);
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
          toast.error("Notifications blocked by browser.");
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

  // Dedicated real-time listener for the active chat thread
  useEffect(() => {
    if (!selectedGroup || !db || !user?.uid) return;

    const threadId = selectedGroup.items.find(i => i.threadId)?.threadId;
    if (!threadId) return;

    const firestore = db;
    const q = query(
      collection(firestore, "feedbacks"),
      where("threadId", "==", threadId),
      orderBy("createdAt", "asc")
    );

    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs
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
            feedbackMessage: data.message || data.feedbackMessage,
            anonymousId: data.anonymousId,
            attachmentUrl: data.attachmentUrl,
            attachmentName: data.attachmentName,
            submitterId: data.submitterId,
            submitterIp: data.submitterIp,
            sessionId: data.sessionId,
            isOwnerReply: data.isOwnerReply === true,
            recipientId: data.recipientId,
            visitorId: data.visitorId,
            targetUid: data.targetUid,
            threadId: data.threadId,
            coolId: "",
          };
        });

      setFeedbacks(prev => {
        const map = new Map(prev.map(i => [i.id, i]));
        let changed = false;
        for (const item of items) {
          const existing = map.get(item.id);
          if (!existing || JSON.stringify(existing) !== JSON.stringify(item)) {
            map.set(item.id, item);
            changed = true;
          }
        }
        if (!changed) return prev;
        return Array.from(map.values()).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      });
    });

    return () => unsub();
  }, [selectedGroup, user?.uid]);

  const handleSelectItem = async (group: GroupedItem) => {
    if (group.itemType !== "visit") {
      setSelectedGroup(group);
      const docId = group.latestItem.feedbackId || group.latestItem.id;
      setFeedbackDocId(docId);
    }

    const unreadIds = group.items
      .filter((i) => !i.isRead)
      .map((i) => {
        const linked = notifications.find(n => n.id === i.id || n.feedbackId === i.id);
        return linked?.id;
      })
      .filter((id): id is string => !!id);

    const firestore = db;
    if (unreadIds.length > 0 && firestore) {
      try {
        const batch = writeBatch(firestore);
        unreadIds.forEach(id => {
          batch.update(doc(firestore, "notifications", id), { isRead: true });
        });
        await batch.commit();
      } catch (err) {
        console.error("Error marking read:", err);
      }
    }
  };

  const handleDelete = async () => {
    if (!feedbackDocId || !user || !selectedGroup) return;
    setOptionsOpen(false);
    setDeleting(true);
    try {
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

  const handleSendReply = async () => {
    if (!selectedGroup || !user) return;
    const canReply = selectedGroup.threadType === 'inbox' || selectedGroup.items.some(i => i.isOwnerReply);
    if (!replyText.trim() && !pendingFile) return;
    if (!canReply) return;

    const text = replyText.trim();
    const items = selectedGroup.items;
    const fileToUpload = pendingFile;
    const isImageFile = fileToUpload?.type.startsWith("image/") ?? false;

    const originalMessage =
      items.find(i => !i.isOwnerReply && i.submitterId !== uid) ??
      items.find(i => !i.isOwnerReply) ??
      items.find(i => i.submitterId !== uid) ??
      items[0];

    const partnerSubmitterId = (originalMessage?.submitterId && originalMessage.submitterId !== uid) ? originalMessage.submitterId : null;
    const visitorId = items.find(i => i.visitorId)?.visitorId ?? null;
    const anonymousId = items.find(i => i.anonymousId)?.anonymousId ?? visitorId ?? null;
    const sessionId = items.find(i => i.sessionId)?.sessionId ?? null;

    const routingId = partnerSubmitterId ?? anonymousId ?? sessionId;
    if (!routingId) {
      toast.error("Cannot reply to this message");
      return;
    }

    let attachmentUrl = null;
    let attachmentName = null;

    if (fileToUpload) {
      setUploadingFile(true);
      try {
        const fileId = "att_" + Math.random().toString(36).substring(2, 9);
        attachmentUrl = await uploadAttachment(fileToUpload, fileId);
        attachmentName = fileToUpload.name;
      } catch (err) {
        toast.error("Failed to upload file");
        setUploadingFile(false);
        return;
      } finally {
        setUploadingFile(false);
      }
    }

    setReplyText("");
    setPendingFile(null);

    const optId = "opt_" + Math.random().toString(36).substring(2, 9);
    const optItem: NotifItem = {
      id: optId,
      message: text || (isImageFile ? "Sent an image" : attachmentUrl ? "Sent a file" : ""),
      feedbackMessage: text || undefined,
      feedbackImageUrl: (isImageFile && attachmentUrl) ? attachmentUrl : undefined,
      attachmentUrl: (!isImageFile && attachmentUrl) ? attachmentUrl : undefined,
      attachmentName: (!isImageFile && attachmentName) ? attachmentName : undefined,
      createdAt: new Date().toISOString(),
      isRead: true,
      type: "anonymous_feedback",
      isOwnerReply: true,
      submitterId: uid,
      recipientId: partnerSubmitterId ?? anonymousId ?? sessionId ?? uid,
      visitorId: visitorId ?? undefined,
      targetUid: partnerSubmitterId ?? undefined,
      sessionId: sessionId ?? undefined,
      coolId: "",
      threadId: (items.find(i => i.threadId)?.threadId || items.find(i => i.id || i.feedbackId)?.id || items[0].id),
    };

    setFeedbacks(prev => [...prev, optItem]);
    setSendingReply(true);

    try {
      const functions = getAppFunctions();
      if (!functions) throw new Error("Firebase not configured");
      const threadId = items.find(i => i.threadId)?.threadId || items.find(i => i.feedbackId)?.feedbackId || items[0].id;

      const submitOwnerReply = httpsCallable<{
        message: string;
        anonymousId: string;
        targetUid: string | null;
        sessionId: string | null;
        feedbackImageUrl?: string | null;
        attachmentUrl?: string | null;
        attachmentName?: string | null;
        threadId: string;
      }, { success: boolean }>(functions, "submitOwnerReply");

      await submitOwnerReply({
        message: text,
        anonymousId: partnerSubmitterId ? "" : (anonymousId ?? ""),
        targetUid: partnerSubmitterId,
        sessionId: sessionId,
        feedbackImageUrl: (isImageFile && attachmentUrl) ? attachmentUrl : null,
        attachmentUrl: (!isImageFile && attachmentUrl) ? attachmentUrl : null,
        attachmentName: (!isImageFile && attachmentName) ? attachmentName : null,
      threadId: threadId,
      });

      // opt_ removed by listener sync - no timeout needed


    } catch (err) {
      setFeedbacks(prev => prev.filter(f => f.id !== optId));
      setReplyText(text);
      toast.error(getErrorMessage(err));
    } finally {
      setSendingReply(false);
    }
  };

  const handleMarkAllRead = async () => {
    const unread = notifications.filter((n) => !n.isRead);
    const firestore = db;
    if (unread.length === 0 || !firestore) return;
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

  // Grouping and filtering logic
  const mergedFeedbackItems: NotifItem[] = [];
  const seenKeys = new Set<string>();

  for (const f of feedbacks) {
    seenKeys.add(f.id);
    mergedFeedbackItems.push(f);
  }
  for (const n of notifications) {
    if (n.type === "visit") continue;
    const key = n.feedbackId || n.id;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      mergedFeedbackItems.push(n);
    }
  }

  const feedbackItems = mergedFeedbackItems.map(i => ({ ...i, itemType: "feedback" as const }));
  const visitItems = notifications.filter(n => n.type === "visit").map(i => ({ ...i, itemType: "visit" as const }));

  const allItems = [...feedbackItems, ...visitItems]
    .map(item => {
      const notif = notifications.find(n => n.feedbackId === item.id || n.id === item.id);
      return { ...item, isRead: notif ? notif.isRead : true };
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Listen for foreground notifications
  useEffect(() => {
    let unsub: (() => void) | null = null;
    let mounted = true;

    const setup = async () => {
      try {
        const cleanup = await onForegroundMessage((payload) => {
          if (!mounted) return;
          const title = payload.notification?.title || "New notification";
          const body = payload.notification?.body || "You have a new message.";
          toast.success(`${title}: ${body}`);
        });
        unsub = cleanup;
      } catch (err) {
        console.warn("Foreground notification setup failed:", err);
      }
    };

    setup();
    return () => {
      mounted = false;
      if (unsub) unsub();
    };
  }, [toast]);

  useEffect(() => {
    const ids = new Set<string>();
    allItems.forEach(item => {
      const pid = (item.submitterId && item.submitterId !== uid) ? item.submitterId :
        (item.recipientId && item.recipientId !== uid) ? item.recipientId :
          (item.targetUid && item.targetUid !== uid) ? item.targetUid : null;
      if (pid && !profileCache[pid] && !resolvingIds.has(pid)) ids.add(pid);
    });

    if (ids.size === 0 || !db) return;

    const resolve = async () => {
      const toFetch = Array.from(ids);
      setResolvingIds(prev => {
        const n = new Set(prev);
        toFetch.forEach(id => n.add(id));
        return n;
      });

      const newCache = { ...profileCache };
      const firestore = db;
      if (!firestore) return;

      for (const id of toFetch) {
        try {
          const q = query(collection(firestore, "usernames"), where("uid", "==", id), limit(1));
          const snap = await getDocs(q);
          if (!snap.empty) {
            newCache[id] = snap.docs[0].id;
          } else {
            newCache[id] = id.slice(0, 8); // Fallback
          }
        } catch (e) {
          console.error("Profile Error:", e);
        }
      }
      setProfileCache(newCache);
    };
    resolve();
  }, [allItems, uid, profileCache, resolvingIds]);

  const getStablePartnerId = (baseId: string, item: any): string => {
    if (baseId === "self-chat") return "self-chat";
    if (baseId === "unknown") return "unknown";
    return item.visitorId || item.sessionId || item.anonymousId || baseId;
  };

  const getConversationKey = (item: any): string => {
    if (item.itemType === "visit") return "all-visits";
    // Prioritize threadId for grouping to separate chats per user/thread
    if (item.threadId) return `thread_${item.threadId}`;

    // Fallback for older items without threadId
    const partnerId = (item.submitterId && item.submitterId !== uid) ? item.submitterId :
      (item.recipientId && item.recipientId !== uid) ? item.recipientId :
        (item.targetUid && item.targetUid !== uid) ? item.targetUid :
          getStablePartnerId("unknown", item);
    const pair = [uid ?? "anon", partnerId].sort();
    return `conv_${pair[0]}_${pair[1]}`;
  };

  const groupedMap = new Map<string, GroupedItem>();
  for (const item of allItems) {
    const groupId = getConversationKey(item);
    if (!groupedMap.has(groupId)) {
      groupedMap.set(groupId, {
        id: groupId,
        itemType: item.itemType,
        threadType: item.recipientId === uid ? "inbox" : "sent",
        threadPartnerId: groupId === "all-visits" ? "unknown" : groupId,
        items: [],
        createdAt: item.createdAt,
        latestItem: item,
      });
    }
    const group = groupedMap.get(groupId)!;

    const effId = item.feedbackId || item.id;
    if (!group.items.find(i => (i.feedbackId || i.id) === effId)) {
      group.items.push(item);
    }

    if (new Date(item.createdAt).getTime() > new Date(group.createdAt).getTime()) {
      group.createdAt = item.createdAt;
      group.latestItem = item;
    }
    if (item.feedbackImageUrl && !group.sharedImageUrl) group.sharedImageUrl = item.feedbackImageUrl;
  }

  const groupedItems = Array.from(groupedMap.values()).sort((a, b) => {
    if (a.itemType === "visit" && b.itemType !== "visit") return -1;
    if (b.itemType === "visit" && a.itemType !== "visit") return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const activeGroup = selectedGroup ? (groupedItems.find(g => g.id === selectedGroup.id) ?? selectedGroup) : null;
  const unreadCount = notifications.filter(n => !n.isRead).length;

  useEffect(() => {
    if (activeGroup) chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
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
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] selection:bg-[var(--pink)]/30 relative overflow-x-hidden">
      <style>{`:root { --pink: #FF3D7F; --purple: #7C3AFF; --blue: #00C8FF; --green: #00FF94; }`}</style>
      <div className="fixed -top-[10%] -left-[10%] w-[40%] h-[40%] bg-[var(--pink)]/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="fixed -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-[var(--purple)]/5 blur-[120px] rounded-full pointer-events-none" />

      <header className="fixed top-0 left-0 right-0 z-[100] border-b border-white/5 bg-black/40 backdrop-blur-2xl">
        <nav className="flex h-16 items-center justify-between px-6 max-w-[620px] mx-auto">
          <Link href="/dashboard" className="flex items-center hover:scale-110 active:scale-95 transition-all duration-300">
            <img src="/logo.svg" alt="picpop" className="h-7 w-auto" />
          </Link>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Link href="/dashboard" className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-black uppercase tracking-widest text-[var(--text-muted)] hover:text-white transition-all">
              Dashboard
            </Link>
          </div>
        </nav>
      </header>
      <div className="h-16" />

      <main className="max-w-[620px] mx-auto px-4 py-10">
        <div className="flex items-baseline gap-3 mb-8">
          <h1 className="text-3xl font-black bg-gradient-to-br from-white to-white/60 bg-clip-text text-transparent">Inbox</h1>
          <div className="w-2 h-2 rounded-full bg-[var(--pink)] shadow-[0_0_10px_var(--pink)]" />
        </div>

        <div className="relative group mb-8">
          <div className="absolute -inset-1 bg-gradient-to-r from-pink-500/20 via-purple-500/20 to-blue-500/20 rounded-2xl blur opacity-25 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
          <div className="relative flex flex-col gap-3 p-5 rounded-2xl bg-[#0a0a0a]/80 border border-white/5 backdrop-blur-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-gradient-to-br from-pink-500/20 to-purple-500/20 border border-pink-500/20">
                  <Bell className="w-5 h-5 text-[var(--pink)]" />
                </div>
                <div className="flex flex-col">
                  <p className="font-black text-sm tracking-tight">Push Notifications</p>
                  <p className="text-[10px] text-[var(--text-muted)] font-black uppercase tracking-widest opacity-60">Never miss a secret reply</p>
                </div>
              </div>
              {notifStatus === "unsupported" ? (
                <span className="text-[10px] font-black uppercase text-[var(--text-muted)] opacity-50">Not Supported</span>
              ) : (
                <button
                  onClick={() => notifStatus === "enabled" ? handleDisableNotifications() : handleEnableNotifications()}
                  className={`relative w-12 h-6 rounded-full transition-all duration-500 ${notifStatus === "enabled" ? "bg-[var(--pink)] shadow-[0_0_15px_rgba(255,61,127,0.3)]" : "bg-white/10"}`}
                >
                  <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-all duration-500 shadow-sm ${notifStatus === "enabled" ? "translate-x-6" : "translate-x-0"}`} />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mb-6 px-1">
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-[var(--text-muted)] opacity-50">Messages</h2>
          {unreadCount > 0 && (
            <button onClick={handleMarkAllRead} className="group flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[var(--pink)] hover:text-white transition-all">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Mark all read</span>
            </button>
          )}
        </div>

        <div className="space-y-3">
          {loadingData ? (
            <div className="py-12 text-center">
              <div className="w-8 h-8 rounded-full border-2 border-transparent animate-spin mx-auto" style={{ borderTopColor: "var(--pink)" }} />
            </div>
          ) : groupedItems.length === 0 ? (
            <div className="py-16 text-center">
              <ImageIcon className="w-14 h-14 text-[var(--text-muted)] mx-auto mb-4" />
              <p className="font-semibold text-[var(--text-muted)]">No messages yet</p>
              <Link href="/dashboard" className="mt-4 inline-block text-[var(--pink)] font-bold hover:underline">Go to dashboard</Link>
            </div>
          ) : (
            <>
              {groupedItems.map((item) => (
                <Fragment key={item.id}>
                  {item.itemType === "visit" ? (
                    <div className={`w-full p-4 rounded-2xl border transition-all group relative overflow-hidden ${item.items.some(i => !i.isRead) ? "border-[var(--blue)]/30 bg-white/[0.04]" : "border-white/5 bg-white/[0.02] opacity-50"}`}>
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-blue-500/10 border border-blue-500/20"><Eye className="w-5 h-5 text-[var(--blue)]" /></div>
                        <div className="flex-1 min-w-0">
                          <p className="font-extrabold text-[11px] text-[var(--text-muted)] uppercase tracking-widest flex items-center gap-2">
                            A shadow viewed your link {item.items.length > 1 && <span>× {item.items.length}</span>}
                            {item.items.some(i => !i.isRead) && <span className="w-2 h-2 rounded-full bg-[var(--pink)] shadow-[0_0_8px_var(--pink)] animate-pulse" />}
                          </p>
                          <p className="text-[10px] text-[var(--text-muted)] opacity-40 font-bold uppercase">{formatTimeAgo(item.createdAt)}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <button type="button" onClick={() => handleSelectItem(item)} className={`w-full text-left p-4 rounded-[22px] border transition-all group relative overflow-hidden ${item.items.some(i => !i.isRead) ? "border-[var(--pink)]/30 bg-white/[0.04]" : "border-white/5 bg-white/[0.02] opacity-60 hover:opacity-100"}`}>
                      <div className="flex gap-5 items-center relative z-10">
                        <div className="w-20 h-20 rounded-2xl overflow-hidden shrink-0 bg-black/40 flex items-center justify-center relative border border-white/10 shadow-2xl transition-all group-hover:scale-105">
                          {(() => {
                            const imageUrl = item.sharedImageUrl || item.items.find(i => i.feedbackImageUrl)?.feedbackImageUrl;
                            if (imageUrl) return <img src={imageUrl} alt="" className="w-full h-full object-cover" />;
                            return <div className="absolute inset-0 bg-gradient-to-br from-pink-500/30 to-purple-600/30 flex items-center justify-center"><MessageSquare className="w-10 h-10 text-white/50" /></div>;
                          })()}
                        </div>
                        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              {item.items.some(i => i.submitterId && i.submitterId !== uid && !i.isOwnerReply) ? (
                                <div className="flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full"><div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" /><span className="text-[9px] font-black text-blue-400 uppercase tracking-widest">Verified User</span></div>
                              ) : (
                                <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full"><span className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest">Anonymous Fan</span></div>
                              )}
                            </div>
                            <span className="text-[10px] text-[var(--text-muted)] font-bold opacity-40">{formatTimeAgo(item.createdAt)}</span>
                          </div>
                          <p className="font-black text-base text-[var(--text-primary)] truncate leading-tight">
                            {(() => {
                              const isUnread = item.items.some(i => !i.isRead);
                              if (isUnread) return "";
                              const last = item.latestItem;
                              const isMe = last.submitterId === uid;
                              if (last.feedbackMessage) return last.feedbackMessage;
                              if (last.attachmentUrl) return isMe ? "You sent a file" : "Sent a file";
                              if (last.feedbackImageUrl) return isMe ? "You sent an image" : "Sent an image";
                              return "Secret message";
                            })()}
                          </p>
                          <div className="flex items-center justify-between gap-4 mt-auto">
                            <span className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-tighter flex items-center gap-1.5 opacity-60"><MessageSquare className="w-3 h-3" />{item.items.length} messages</span>
                            {item.items.some(i => !i.isRead) && <span className="w-2.5 h-2.5 rounded-full bg-[var(--pink)] shadow-[0_0_15px_var(--pink)] animate-pulse border border-white/20" />}
                          </div>
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

      {activeGroup && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center sm:p-4 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedGroup(null)}>
          <div className="w-full sm:max-w-lg h-full sm:h-auto sm:max-h-[85vh] sm:rounded-2xl overflow-hidden flex flex-col relative bg-[#0a0a0a]/95 border border-white/10" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-[#101010]/80">
              <div className="flex items-center gap-3">
                <button onClick={() => setSelectedGroup(null)} className="p-2 -ml-2 rounded-lg hover:bg-white/5"><X className="w-5 h-5" /></button>
                <div>
                  <p className="text-base font-black tracking-tight">
                    {activeGroup.threadPartnerId !== "unknown" && profileCache[activeGroup.threadPartnerId]
                      ? `@${profileCache[activeGroup.threadPartnerId]}`
                      : activeGroup.threadType === "sent" ? "Chat" : "Anonymous Fan"}
                  </p>
                </div>
              </div>
              <div className="relative" ref={optionsRef}>
                <button onClick={() => setOptionsOpen(!optionsOpen)} className="p-2 rounded-lg hover:bg-white/5"><MoreVertical className="w-5 h-5" /></button>
                {optionsOpen && (
                  <div className="absolute right-0 top-full mt-1 py-1 min-w-[140px] rounded-xl border border-white/10 bg-[#151515] shadow-xl">
                    <button onClick={handleDelete} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-red-500 hover:bg-white/5"><Trash2 className="w-4 h-4" /> Delete Chat</button>
                  </div>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
              {activeGroup.items.slice().sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()).map((chatItem, idx) => {
                const isMe = chatItem.submitterId === uid;
                return (
                  <div key={idx} className={`flex flex-col gap-0.5 ${isMe ? "items-end" : "items-start"}`}>
                    <div className={`flex items-end gap-2 max-w-[78%] ${isMe ? "flex-row-reverse" : ""}`}>
                      <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-[10px] font-black text-white ${isMe ? "bg-gradient-to-br from-pink-500 to-purple-600" : "bg-white/5"}`}>
                        {isMe ? "M" : "A"}
                      </div>
                      <div className={`rounded-2xl px-4 py-3 shadow-xl transition-all duration-500 ${isMe ? "rounded-br-sm text-white" : "rounded-bl-sm border border-white/5"} ${(!isMe && chatItem.isRead) ? "opacity-60 grayscale-[0.2]" : "opacity-100"}`}
                        style={isMe ? { background: "linear-gradient(135deg, var(--pink), var(--purple))" } : { background: "rgba(255,255,255,0.03)" }}>
                        {(chatItem.feedbackImageUrl || (idx === 0 && activeGroup.sharedImageUrl)) && (
                          <img src={chatItem.feedbackImageUrl || activeGroup.sharedImageUrl} className="rounded-xl max-w-[240px] w-full mb-1 cursor-pointer" onClick={() => { setFeedbackDocId(chatItem.feedbackId || chatItem.id); setShareModalOpen(true); }} />
                        )}
                        {chatItem.attachmentUrl && (
                          <div className="mb-2">
                            <a href={chatItem.attachmentUrl} target="_blank" className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10"><FileText className="w-4 h-4 text-blue-400" /><span className="text-[10px] font-bold truncate">{chatItem.attachmentName || 'View'}</span></a>
                          </div>
                        )}
                        {chatItem.feedbackMessage && <p className="text-sm font-semibold whitespace-pre-wrap">{chatItem.feedbackMessage}</p>}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>
            <div className="p-3 border-t border-white/5 bg-[#101010]/80">
              <div className="flex flex-col gap-2">
                {pendingFile && <div className="flex items-center gap-2 p-2 bg-white/5 rounded-xl"><p className="flex-1 text-xs truncate">{pendingFile.name}</p><button onClick={() => setPendingFile(null)}><X className="w-4 h-4" /></button></div>}
                <div className="flex items-end gap-2">
                  <input type="file" ref={fileInputRef} className="hidden" onChange={(e) => setPendingFile(e.target.files?.[0] || null)} />
                  <button onClick={() => fileInputRef.current?.click()} className="p-2.5 rounded-xl bg-white/5"><Paperclip className="w-5 h-5" /></button>
                  <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), handleSendReply())} placeholder="Type a reply..." className="flex-1 min-h-[44px] rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-sm focus:outline-none focus:border-[var(--pink)] resize-none" rows={1} />
                  <button onClick={handleSendReply} disabled={(!replyText.trim() && !pendingFile) || sendingReply} className="p-2.5 rounded-full text-white" style={{ background: "linear-gradient(135deg, var(--pink), var(--purple))" }}>
                    {sendingReply ? <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <FeedbackShareModal isOpen={shareModalOpen} onClose={() => setShareModalOpen(false)} singleFeedback={{ feedbackImageUrl: activeGroup?.items.find(i => (i.feedbackId || i.id) === feedbackDocId)?.feedbackImageUrl || "" }} feedbackId={feedbackDocId}
        allData={{ imageUrl: activeGroup?.items.find(i => (i.feedbackId || i.id) === feedbackDocId)?.feedbackImageUrl || "", coolId: profile?.coolId ?? "picpop", feedbackImageUrls: [] }}
        shareUrl={`${typeof window !== "undefined" ? window.location.origin : ""}/u/${profile?.coolId ?? "picpop"}`}
        userFeedbackLink={`${typeof window !== "undefined" ? window.location.origin : ""}/u/${profile?.coolId ?? "picpop"}`} />
      <TermsModal isOpen={showTerms} onAccept={() => setShowTerms(false)} />
      <ReportFeedbackModal isOpen={reportModalOpen} onClose={() => setReportModalOpen(false)} feedbackId={feedbackDocId || ""} onReportSuccess={() => { toast.success("Reported"); setSelectedGroup(null); }} onReportError={(m) => toast.error(m)} />
    </div>
  );
}
