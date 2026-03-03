"use client";

import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  limit,
} from "firebase/firestore";
import { db, ensureFirestoreNetwork } from "@/lib/firebase";

const BASE_TITLE = "PicPop - Anonymous Image-Based Feedback";

export function NotificationTitleUpdater() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.uid || !db) {
      document.title = BASE_TITLE;
      return;
    }
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
        unsub = onSnapshot(
          q,
          (snap) => {
            const unread = snap.docs.filter((d) => d.data().isRead !== true).length;
            document.title = unread > 0 ? `(${unread}) ${BASE_TITLE}` : BASE_TITLE;
          },
          (err) => {
            document.title = BASE_TITLE;
            if (err?.code !== "failed-precondition") console.warn("Notification title listener:", err);
          }
        );
      } catch {
        document.title = BASE_TITLE;
      }
    };
    run();
    return () => {
      unsub?.();
      document.title = BASE_TITLE;
    };
  }, [user?.uid]);

  return null;
}
