# Firebase Setup for PicPop

## 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project (or use existing)
3. Add a **Web app** (</> icon) and copy the config values

## 2. Environment Variables

Copy `.env.example` to `.env.local` and fill in:

```
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
NEXT_PUBLIC_FIREBASE_VAPID_KEY=your-vapid-key   # For push notifications (see §7)
```

## 3. Enable Sign-In Methods

In Firebase Console → **Authentication** → **Sign-in method**:

- **Google**: Enable and configure
- **Facebook**: Enable, add App ID & Secret from [Facebook Developers](https://developers.facebook.com/)
- **Yahoo**: Enable, add Client ID & Secret from [Yahoo Developer Network](https://developer.yahoo.com/)

Add authorized domains for your app (e.g. `localhost` for dev, your production domain).

## 4. Firestore Database

1. Create a **Firestore Database** (Production mode)
2. Deploy rules: `firebase deploy --only firestore`
3. Or paste `firestore.rules` content in Console → Firestore → Rules

## 5. Firebase Storage

1. Create **Storage** in Firebase Console
2. Deploy rules: `firebase deploy --only storage`
3. Or paste `storage.rules` in Console → Storage → Rules

### 5.1 CORS (required for share/snapshot)

If you use **share to Instagram** or **snapshot** from Cloudflare tunnels or custom domains, configure CORS.

**Option A – Google Cloud Shell (easiest, no local install):**

1. Go to [Google Cloud Console](https://console.cloud.google.com/storage/browser?project=imagify-5f3d5)
2. Click the **Cloud Shell** icon (terminal) in the top-right
3. Run:
   ```bash
   gcloud config set project imagify-5f3d5
   echo '[{"origin":["*"],"method":["GET","HEAD"],"maxAgeSeconds":3600,"responseHeader":["Content-Type","Access-Control-Allow-Origin"]}]' > cors.json
   gcloud storage buckets update gs://imagify-5f3d5.firebasestorage.app --cors-file=cors.json
   ```

**Option B – Local gcloud CLI:**

```bash
gcloud config set project imagify-5f3d5
gcloud storage buckets update gs://imagify-5f3d5.firebasestorage.app --cors-file=storage-cors.json
```

If your bucket name differs, use the value from `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` in `.env.local`.

### 5.2 403 Permission denied (Storage / Firestore)

If you see `{"error":{"code":403,"message":"Permission denied."}}` when loading images or data:

| Cause | Fix |
|-------|-----|
| **Storage rules not deployed** | Run `firebase deploy --only storage` and ensure `storage.rules` has `allow read: if true` for `feedback_images/` and `images/` |
| **Domain not authorized** | Firebase Console → Authentication → Settings → Authorized domains → add your domain (e.g. `picpop.me`, `localhost`) |
| **Firestore rules not deployed** | Run `firebase deploy --only firestore` |
| **Expired download token** | Firebase Storage URLs from `getDownloadURL` include a token. If very old, re-fetch the URL from Firestore. |

**Quick check:** Open a feedback image URL directly in a new browser tab. If you get 403, redeploy storage rules and verify your domain is authorized.

## 6. Firebase Hosting (Frontend)

Deploy the Next.js static export to Firebase Hosting:

```bash
# Build + deploy everything (hosting, functions, firestore, storage)
npm run deploy

# Or build + deploy only the frontend
npm run deploy:hosting
```

**Requirements:**
- Firebase CLI: `npm install -g firebase-tools` (if not installed)
- Log in: `firebase login`
- Project: `.firebaserc` points to your project (e.g. imagify-5f3d5)

**What happens:**
1. `npm run build` runs `next build` and outputs static files to `out/`
2. `firebase deploy` serves `out/` via Firebase Hosting
3. Your site will be at `https://your-project.web.app` and `https://your-project.firebaseapp.com`

**Rewrite for /u routes:** If someone visits `/u/username` (path-based URL), the rewrite serves `/u/index.html` so the client-side app can handle it. The recommended share link format is `/u?user=username`.

## 7. Firestore Collections

Firestore will auto-create:

- **users** `/{uid}` — user profile with `coolId`, `displayName`, `email`, `photoURL`, `fcmToken`, `fcmTokenUpdatedAt`
- **usernames** `/{coolId}` — maps cool ID → `uid` for uniqueness checks
- **images** `/{imageId}` — uploaded images (imageUrl, userId, coolId)
- **feedbacks** — anonymous feedback on images (imageId, parentId?, feedbackImageUrl, createdAt)

## 8. Push Notifications (optional)

When someone responds to your post, you receive a push notification.

1. **VAPID key**: Firebase Console → Project Settings (⚙️) → **Cloud Messaging** → Web Push certificates → generate/copy key → add `NEXT_PUBLIC_FIREBASE_VAPID_KEY` to `.env.local`
2. **Deploy Cloud Functions** (required — notifications won't work without this):
   ```bash
   cd Imagify
   npm install --prefix functions
   firebase deploy --only functions
   ```
3. On the dashboard, click **enable** next to the bell icon. The FCM token is saved to `users/{uid}` and refreshed automatically on each visit.

### Notifications not working?

| Check | Action |
|-------|--------|
| **VAPID key** | `NEXT_PUBLIC_FIREBASE_VAPID_KEY` in `.env.local`. Get from Firebase Console → Project Settings → Cloud Messaging → Web Push certificates → generate key pair. |
| **Blaze plan** | Cloud Functions need Firebase Blaze (pay-as-you-go). Upgrade in Console → ⚙️ → Usage. |
| **Deploy functions** | `firebase deploy --only functions` — notifications require this. Also deploy indexes: `firebase deploy --only firestore:indexes` |
| **Token in Firestore?** | Firestore → `users` → your doc → verify `fcmToken` exists. If missing, click "enable push" in Notifications section. |
| **Service worker** | `public/firebase-messaging-sw.js` must be served at `/firebase-messaging-sw.js`. If using a different Firebase project, update the config object in that file to match your project. |
| **HTTPS or localhost** | Push requires secure context. |
| **Cloud Function logs** | Firebase Console → Functions → Logs — "Push sent" = success; "user has no fcmToken" = enable in dashboard. |

### iOS-specific (Safari / PWA)

| Issue | Solution |
|-------|----------|
| **Push not working on iOS** | Web push on iOS requires: 1) **iOS 16.4+** 2) **Add to Home Screen** — tap Share → Add to Home Screen. Push does NOT work in a regular Safari tab. 3) `manifest.json` with `display: "standalone"` (already configured). |
| **Capacitor iOS app** | Web push (FCM JS SDK) is unreliable in WKWebView. For native iOS app, use `@capacitor/push-notifications` or `@capacitor-firebase/messaging` with APNs. See [Capacitor Push Notifications](https://capacitorjs.com/docs/apis/push-notifications). |

## 9. Admin Panel

The admin panel at `/admin` shows users, reports, blocked IPs, and recent feedbacks.

**Setup:**

1. Get your Firebase Auth UID (sign in, then check Firebase Console → Authentication → Users, or add `console.log(user.uid)` in your app).
2. Set `ADMIN_UIDS` for Cloud Functions (one of):
   - **Option A:** On first deploy, the CLI will prompt for `ADMIN_UIDS`. Enter your UID (comma-separated for multiple admins).
   - **Option B:** Create `functions/.env.local` with `ADMIN_UIDS=your-uid-here`
   - **Option C:** Google Cloud Console → Cloud Functions → select `getAdminData` → Edit → Environment variables
3. Deploy: `firebase deploy --only functions`
4. Visit `/admin` or click "Admin panel" in the dashboard dropdown (next to your @username).
