"use client";

import { getToken, onMessage } from "firebase/messaging";
import { getMessagingSafe } from "./firebase";
import { db } from "./firebase";
import { doc, setDoc } from "firebase/firestore";

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

/** Detect iOS (iPhone, iPad, iPod) */
export function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

/** Detect if running as PWA (added to home screen) - required for iOS push */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return !!(window as Window & { standalone?: boolean }).standalone || window.matchMedia("(display-mode: standalone)").matches;
}

/** Detect if running in Capacitor iOS app (WebView) */
export function isCapacitorIos(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as Window & { Capacitor?: { getPlatform?: () => string } }).Capacitor;
  return cap?.getPlatform?.() === "ios";
}

/**
 * Returns a user-facing message when push is unsupported on iOS, or null if OK to proceed.
 */
export function getIosPushHint(): string | null {
  if (!isIos()) return null;
  if (isStandalone()) return null;
  if (isCapacitorIos()) {
    return "Push in the iOS app requires the native push plugin. Use the web version (add to Home Screen) for now.";
  }
  return "Add to Home Screen first: tap Share → Add to Home Screen. Push notifications only work when the app is opened from the home screen.";
}

/**
 * Request notification permission and return FCM token.
 * Returns null if denied or not supported.
 */
export async function requestNotificationPermission(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  if (!("Notification" in window)) return null;

  // iOS Safari: push only works when app is added to home screen (standalone)
  if (isIos() && !isStandalone()) {
    console.warn("FCM iOS: Add app to Home Screen first. Push does not work in Safari browser tab.");
    return null;
  }

  let permission = Notification.permission;
  if (permission === "default") {
    permission = await Notification.requestPermission();
  }
  if (permission !== "granted") return null;

  const messaging = await getMessagingSafe();
  if (!messaging) return null;

  if (!VAPID_KEY) {
    console.error(
      "FCM requires NEXT_PUBLIC_FIREBASE_VAPID_KEY. Get it from Firebase Console → Project Settings → Cloud Messaging → Web Push certificates."
    );
    return null;
  }
  try {
    const sw = await getServiceWorkerRegistration();
    if (!sw) {
      console.error("FCM: Service worker registration failed. Ensure /firebase-messaging-sw.js is served at root.");
      return null;
    }
    if (!VAPID_KEY) {
      console.error("FCM: Set NEXT_PUBLIC_FIREBASE_VAPID_KEY in .env.local. Get it from Firebase Console → Project Settings → Cloud Messaging → Web Push certificates.");
      return null;
    }
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: sw,
    });
    return token || null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isIdbClosing = msg.includes("database connection is closing") || msg.includes("IDBDatabase");
    if (!isIdbClosing) {
      console.error("FCM getToken failed:", err);
      console.info("Push requires: 1) NEXT_PUBLIC_FIREBASE_VAPID_KEY in .env.local 2) HTTPS or localhost 3) firebase deploy --only functions");
    }
    return null;
  }
}

/**
 * Get or register the firebase-messaging-sw.js service worker.
 * register() is idempotent - returns existing registration if already registered.
 */
async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | undefined> {
  if (typeof navigator === "undefined" || !navigator.serviceWorker) return undefined;
  try {
    const reg = await navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" });
    // Wait for SW to be ready so getToken can use it
    await navigator.serviceWorker.ready;
    return reg;
  } catch {
    return undefined;
  }
}

/**
 * Save FCM token to user's Firestore document for Cloud Functions to use.
 */
export async function saveFcmToken(userId: string | null, token: string, sessionId?: string | null): Promise<void> {
  if (!db) throw new Error("Firestore not configured");
  const firestore = db;
  if (userId) {
    const userRef = doc(firestore, "users", userId);
    await setDoc(userRef, { fcmToken: token, fcmTokenUpdatedAt: new Date().toISOString() }, { merge: true });
  } else if (sessionId) {
    const sessionRef = doc(firestore, "sessions", sessionId);
    await setDoc(sessionRef, { fcmToken: token, updatedAt: new Date().toISOString() }, { merge: true });
  }
}

/**
 * Remove FCM token from user document (on logout or disable).
 */
export async function clearFcmToken(userId: string): Promise<void> {
  if (!db) return;
  const firestore = db;
  const userRef = doc(firestore, "users", userId);
  await setDoc(userRef, { fcmToken: null, fcmTokenUpdatedAt: null }, { merge: true });
}

/** Payload from FCM foreground message - notification may be present */
export interface ForegroundPayload {
  notification?: { title?: string; body?: string };
  data?: Record<string, string>;
}

/**
 * Subscribe to foreground messages (when app is open).
 * Returns unsubscribe function.
 */
export async function onForegroundMessage(
  callback: (payload: ForegroundPayload) => void
): Promise<() => void> {
  const messaging = await getMessagingSafe();
  if (!messaging) return () => {};
  return onMessage(messaging, (payload) => {
    // FCM delivers notification + data; use data fallbacks if notification stripped
    const title = payload.notification?.title ?? (payload.data as Record<string, string>)?.["title"];
    const body = payload.notification?.body ?? (payload.data as Record<string, string>)?.["body"];
    callback({
      notification: title || body ? { title, body } : undefined,
      data: (payload.data as Record<string, string>) ?? {},
    });
  });
}
