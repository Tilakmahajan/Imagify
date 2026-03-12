// Firebase Cloud Messaging - Service Worker for background push notifications
// Uses config from Firebase Console. Update with your project's values if needed.

importScripts("https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyBmJpzk4Q5-DGCxJ7_BFt5qeCtr9OiuBCk",
  authDomain: "imagify-5f3d5.firebaseapp.com",
  projectId: "imagify-5f3d5",
  storageBucket: "imagify-5f3d5.firebasestorage.app",
  messagingSenderId: "206376757201",
  appId: "1:206376757201:web:790ce2b43662765fd4a2f0",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || "PicPop";
  const link = payload.notification?.click_action || payload.data?.link || (payload.data?.imageId ? `/f?imageId=${payload.data.imageId}` : "/dashboard");
  const options = {
    body: payload.notification?.body || "Someone reacted to your post",
    icon: "/logo.svg",
    badge: "/logo.svg",
    data: { ...(payload.data || {}), link },
  };
  self.registration.showNotification(title, options);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = event.notification.data?.link || "/dashboard";
  const url = new URL(link, self.location.origin).href;
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      if (list.length > 0) {
        const client = list[0];
        client.navigate(url);
        client.focus();
      } else {
        clients.openWindow(url);
      }
    })
  );
});
