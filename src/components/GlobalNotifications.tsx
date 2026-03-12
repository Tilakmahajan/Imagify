"use client";

import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";
import {
  requestNotificationPermission,
  saveFcmToken,
  onForegroundMessage,
} from "@/lib/notifications";

export function GlobalNotifications() {
  const { user } = useAuth();
  const toast = useToast();

  useEffect(() => {
    if (!user?.uid) return;

    let unsub: (() => void) | undefined;

    const init = async () => {
      try {
        const fn = await onForegroundMessage((payload) => {
          const body = payload.notification?.body ?? payload.data?.body ?? payload.data?.message;
          const title = payload.notification?.title ?? payload.data?.title;
          if (body || title) {
            toast.info(body || title || "New activity");
          }
        });
        unsub = fn;

        if (typeof window !== "undefined" && "Notification" in window) {
          if (Notification.permission === "granted") {
            const token = await requestNotificationPermission();
            if (token) {
              await saveFcmToken(user.uid, token);
            }
          }
        }
      } catch {
        // ignore errors
      }
    };

    init();

    return () => unsub?.();
  }, [user?.uid, toast]);

  return null;
}
