# Admin Panel Hosting (admin.picpop.me)

The admin panel is configured to be hosted at **admin.picpop.me**. Admins are created by hardcoding only (no UI).

**Note:** Until the admin site is created, use `npm run deploy:hosting:main` for main site deploys. Full `firebase deploy` will fail if the admin target is not set up.

1. **Create admin site in Firebase Console**
   - Go to [Firebase Console](https://console.firebase.google.com) → your project → Hosting
   - Click "Add another site"
   - Create site with ID: `imagify-admin` (or your choice)

2. **Add custom domain**
   - In the admin site settings, add custom domain: `admin.picpop.me`
   - Follow DNS verification (add the TXT/CNAME records)

3. **Apply deploy target** (one-time)
   ```bash
   firebase target:apply hosting admin imagify-admin
   ```
   (Use your actual site ID if different)

4. **Deploy admin site**
   ```bash
   npm run deploy:admin
   ```
   Or deploy both: `npm run build && firebase deploy --only hosting`

## Admin creation (hardcoded only)

Admins are added by writing UIDs directly to Firestore `admins` collection, or by using the bootstrap flow with `ADMIN_SECRET` (Firebase Functions config) when signing in for the first time. There is no "Create Admin" UI.
