const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");
const { getMessaging } = require("firebase-admin/messaging");
const functions = require("firebase-functions/v1");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineString } = require("firebase-functions/params");

initializeApp();

// CORS: allow localhost (dev), production, and Capacitor iOS/Android WebViews
const CORS_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://picpop.me",
  "https://www.picpop.me",
  "https://imagify-5f3d5.web.app",
  "https://imagify-5f3d5.firebaseapp.com",
  "capacitor://localhost",
  "ionic://localhost",
  "http://localhost",
  "https://localhost",
];

const adminUidsParam = defineString("ADMIN_UIDS", { default: "" });
const adminSecretParam = defineString("ADMIN_SECRET", { default: "" });

/** Get admin UIDs from Firestore config/admin or env/param. Firestore allows adding admins without redeploy. */
async function getAdminUids() {
  const fromEnv = adminUidsParam.value() || process.env.ADMIN_UIDS || "";
  const fromEnvList = fromEnv.split(",").map((s) => s.trim()).filter(Boolean);
  if (fromEnvList.length) return fromEnvList;

  try {
    const db = getFirestore();
    const snap = await db.doc("config/admin").get();
    if (snap.exists) {
      const data = snap.data();
      const uids = data?.uids;
      if (Array.isArray(uids) && uids.length) {
        return uids.filter((u) => typeof u === "string" && u.trim());
      }
    }
  } catch (err) {
    console.warn("getAdminUids Firestore read failed:", err);
  }
  return [];
}

async function requireAdmin(request) {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Sign in required");
  }
  const adminUids = await getAdminUids();
  if (!adminUids.length) {
    console.warn("No admins configured - set Firestore config/admin.uids or ADMIN_UIDS env");
    throw new HttpsError(
      "permission-denied",
      `Add your UID to Firestore: create document config/admin with field uids: ["${request.auth.uid}"]. Or set ADMIN_UIDS env var.`
    );
  }
  if (!adminUids.includes(request.auth.uid)) {
    throw new HttpsError("permission-denied", "Admin access required");
  }
}

/** Get client IP from callable request */
function getClientIp(req) {
  if (!req || !req.headers) return "unknown";
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    return String(forwarded).split(",")[0].trim();
  }
  return req.connection?.remoteAddress || req.socket?.remoteAddress || "unknown";
}

/**
 * When someone adds image feedback to a post, send a push notification to the post owner.
 * Uses 1st gen to avoid Eventarc setup (2nd gen needs Eventarc Service Agent permissions).
 */
exports.onFeedbackCreated = functions.firestore.document("feedbacks/{feedbackId}").onCreate(async (snap, context) => {
  const feedback = snap.data();
  const hasImage = !!feedback?.imageId;
  const hasRecipient = !!feedback?.recipientId;
  if (!hasImage && !hasRecipient) {
    console.warn("onFeedbackCreated: feedback missing imageId and recipientId");
    return;
  }

  const db = getFirestore();
  const feedbackId = context.params.feedbackId;

  let ownerUserId;
  let coolId = "someone";
  let imageIdForLink = feedback.imageId || null;

  if (hasRecipient) {
    ownerUserId = feedback.recipientId;
    const userSnap = await db.doc(`users/${ownerUserId}`).get();
    if (!userSnap.exists) return;
    coolId = userSnap.data()?.coolId || "someone";
  } else {
    const imageSnap = await db.doc(`images/${feedback.imageId}`).get();
    if (!imageSnap.exists) return;
    const imageData = imageSnap.data();
    ownerUserId = imageData?.userId;
    if (!ownerUserId) return;
    coolId = imageData?.coolId || imageSnap.data()?.coolId || "someone";
  }

  try {
    const userSnap = await db.doc(`users/${ownerUserId}`).get();
    if (!userSnap.exists) {
      console.warn("onFeedbackCreated: user not found", ownerUserId);
      return;
    }
    const userData = userSnap.data();
    coolId = userData?.coolId || coolId;
    const title = "New feedback";
    const body = hasRecipient ? `Someone sent you feedback @${coolId}` : `Someone reacted to your post @${coolId}`;

    // Always write to notifications (for inbox display), even if user has no FCM token
    await db.collection("notifications").add({
      recipientId: ownerUserId,
      message: body,
      isRead: false,
      createdAt: FieldValue.serverTimestamp(),
      type: "anonymous_feedback",
      imageId: imageIdForLink,
      coolId,
      feedbackImageUrl: feedback.feedbackImageUrl || null,
      feedbackId,
    });

    // Send push only if user has FCM token
    const fcmToken = userData?.fcmToken;
    if (fcmToken) {
      const clickLink = imageIdForLink ? `/f?imageId=${imageIdForLink}` : "/inbox";
      const message = {
        token: fcmToken,
        notification: { title, body },
        data: {
          type: "feedback",
          imageId: imageIdForLink || "",
          feedbackId: String(feedbackId),
          title,
          body,
          link: clickLink,
        },
        webpush: {
          fcmOptions: { link: clickLink },
        },
      };
      const messaging = getMessaging();
      await messaging.send(message);
      console.log("Push sent to owner", ownerUserId);
    }
  } catch (err) {
    console.error("Push notification failed:", err);
  }
});

/**
 * When someone visits a feedback link, notify the post/link owner.
 * Supports both imageOwnerId (/f page) and recipientId (/u page).
 */
exports.onVisitCreated = functions.firestore.document("visits/{visitId}").onCreate(async (snap, context) => {
  const visit = snap.data();
  const ownerUserId = visit?.imageOwnerId || visit?.recipientId;
  if (!ownerUserId) {
    console.warn("onVisitCreated: visit missing imageOwnerId or recipientId");
    return;
  }

  const db = getFirestore();

  try {
    const userSnap = await db.doc(`users/${ownerUserId}`).get();
    if (!userSnap.exists) return;
    const userData = userSnap.data();
    const coolId = visit.coolId || userData?.coolId || "your link";
    const title = "Link viewed";
    const body = `Someone viewed your feedback link @${coolId}`;

    // Always write to notifications (for inbox display)
    await db.collection("notifications").add({
      recipientId: ownerUserId,
      message: body,
      isRead: false,
      createdAt: FieldValue.serverTimestamp(),
      type: "visit",
      imageId: visit.imageId || null,
      coolId,
    });

    // Send push only if user has FCM token
    const fcmToken = userData?.fcmToken;
    if (fcmToken) {
      const clickLink = visit.imageId ? `/f?imageId=${visit.imageId}` : "/inbox";
      const message = {
        token: fcmToken,
        notification: { title, body },
        data: {
          type: "visit",
          imageId: String(visit.imageId || ""),
          title,
          body,
          link: clickLink,
        },
        webpush: {
          fcmOptions: { link: clickLink },
        },
      };
      const messaging = getMessaging();
      await messaging.send(message);
      console.log("Visit push sent to owner", ownerUserId);
    }
  } catch (err) {
    console.error("Visit push failed:", err);
  }
});

/**
 * Report feedback - supports 2 actions: report (submit only), block (submit + block submitter IP). (Gen 2)
 */
exports.reportFeedback = onCall({ cors: CORS_ORIGINS }, async (request) => {
  const { feedbackId, reason, otherReason, action } = request.data || {};
  if (!feedbackId) {
    throw new HttpsError("invalid-argument", "feedbackId is required");
  }
  const act = action || "report";
  if (!["report", "block"].includes(act)) {
    throw new HttpsError("invalid-argument", "action must be report or block");
  }
  if (!reason) {
    throw new HttpsError("invalid-argument", "reason is required");
  }

  const reporterIp = getClientIp(request.rawRequest);
  const db = getFirestore();

  try {
    const feedbackSnap = await db.doc(`feedbacks/${feedbackId}`).get();
    if (!feedbackSnap.exists) {
      throw new HttpsError("not-found", "Feedback not found");
    }
    const feedback = feedbackSnap.data();
    const submitterIp = feedback?.submitterIp || null;

    await db.runTransaction(async (tx) => {
      const reportRef = db.collection("reports").doc();
      tx.set(reportRef, {
        feedbackId,
        reason,
        otherReason: reason === "Other" ? (otherReason || "") : null,
        reporterIp,
        action: act,
        createdAt: new Date().toISOString(),
      });

      if (act === "block" && submitterIp) {
        const ipKey = submitterIp.replace(/[.:]/g, "_");
        tx.set(db.collection("blockedIps").doc(ipKey), {
          ip: submitterIp,
          reason: "Blocked via report",
          feedbackId,
          createdAt: new Date().toISOString(),
        });
      }
    });
    return { success: true };
  } catch (err) {
    if (err && err.code) throw err;
    console.error("reportFeedback failed:", err);
    throw new HttpsError("internal", "Report failed");
  }
});

/**
 * Delete inbox feedback - only recipient can delete (feedback with recipientId). (Gen 2)
 */
exports.deleteInboxFeedback = onCall({ cors: CORS_ORIGINS }, async (request) => {
  const { feedbackId } = request.data || {};
  if (!feedbackId) {
    throw new HttpsError("invalid-argument", "feedbackId is required");
  }
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Sign in to delete");
  }

  const db = getFirestore();
  const feedbackSnap = await db.doc(`feedbacks/${feedbackId}`).get();
  if (!feedbackSnap.exists) {
    throw new HttpsError("not-found", "Feedback not found");
  }
  const feedback = feedbackSnap.data();
  if (feedback?.recipientId !== request.auth.uid) {
    throw new HttpsError("permission-denied", "Only the recipient can delete this feedback");
  }

  await db.doc(`feedbacks/${feedbackId}`).update({
    deleted: true,
    deletedAt: new Date().toISOString(),
  });

  // Also delete/update related notification if exists
  const notifSnap = await db.collection("notifications")
    .where("feedbackId", "==", feedbackId)
    .limit(1)
    .get();
  notifSnap.docs.forEach((d) => d.ref.delete());

  return { success: true };
});

/**
 * Delete feedback - only image owner can delete. (Gen 2)
 */
exports.deleteFeedback = onCall({ cors: true }, async (request) => {
  const { feedbackId } = request.data || {};
  if (!feedbackId) {
    throw new HttpsError("invalid-argument", "feedbackId is required");
  }
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Sign in to delete");
  }

  const db = getFirestore();
  const feedbackSnap = await db.doc(`feedbacks/${feedbackId}`).get();
  if (!feedbackSnap.exists) {
    throw new HttpsError("not-found", "Feedback not found");
  }
  const feedback = feedbackSnap.data();
  const imageId = feedback?.imageId;
  if (!imageId) {
    throw new HttpsError("internal", "Invalid feedback");
  }

  const imageSnap = await db.doc(`images/${imageId}`).get();
  if (!imageSnap.exists) {
    throw new HttpsError("not-found", "Image not found");
  }
  const image = imageSnap.data();
  if (image?.userId !== request.auth.uid) {
    throw new HttpsError("permission-denied", "Only the post owner can delete");
  }

  await db.doc(`feedbacks/${feedbackId}`).update({
    deleted: true,
    deletedAt: new Date().toISOString(),
  });
  return { success: true };
});

/**
 * Submit feedback - supports either imageId (reaction to post) or recipientId (inbox feedback). (Gen 2)
 * Checks IP against blocked list, then adds to Firestore.
 */
/**
 * Get popular memes from Imgflip API. Proxied to avoid CORS. (Gen 2)
 */
exports.getImgflipMemes = onCall({ cors: CORS_ORIGINS }, async () => {
  const res = await fetch("https://api.imgflip.com/get_memes");
  const json = await res.json();
  if (!json.success || !Array.isArray(json.data?.memes)) {
    throw new HttpsError("internal", "Failed to fetch memes");
  }
  return { memes: json.data.memes };
});

/**
 * Submit feedback using an Imgflip meme URL. Fetches image server-side, uploads to Storage, creates feedback. (Gen 2)
 */
exports.submitFeedbackFromImgflip = onCall({ cors: CORS_ORIGINS }, async (request) => {
  try {
    const { imageUrl, recipientId } = request.data || {};
    if (!imageUrl || typeof imageUrl !== "string") {
      throw new HttpsError("invalid-argument", "imageUrl is required");
    }
    if (!recipientId || typeof recipientId !== "string") {
      throw new HttpsError("invalid-argument", "recipientId is required");
    }
    const url = imageUrl.trim();
    if (!url.startsWith("https://i.imgflip.com/")) {
      throw new HttpsError("invalid-argument", "Only Imgflip image URLs are allowed");
    }

    const ip = getClientIp(request.rawRequest);
    const ipKey = ip.replace(/[.:]/g, "_");
    const db = getFirestore();

    const blockedSnap = await db.doc(`blockedIps/${ipKey}`).get();
    if (blockedSnap.exists) {
      throw new HttpsError("permission-denied", "You cannot submit feedback. Your access has been restricted.");
    }

    const userSnap = await db.doc(`users/${recipientId}`).get();
    if (!userSnap.exists) {
      throw new HttpsError("not-found", "User not found.");
    }

    const imgRes = await fetch(url);
    if (!imgRes.ok) {
      throw new HttpsError("internal", "Could not fetch image. Try another meme.");
    }
    const buffer = Buffer.from(await imgRes.arrayBuffer());
    const ext = url.includes(".png") ? "png" : "jpg";
    const feedbackId = require("crypto").randomUUID();
    const storage = getStorage();
    const bucket = storage.bucket();
    const path = `feedback_images/${feedbackId}.${ext}`;
    const file = bucket.file(path);
    await file.save(buffer, { contentType: imgRes.headers.get("content-type") || `image/${ext}` });
    await file.makePublic();
    const feedbackImageUrl = `https://storage.googleapis.com/${bucket.name}/${path}`;

    const feedbackData = {
      feedbackImageUrl,
      createdAt: new Date().toISOString(),
      submitterId: request.auth?.uid || null,
      submitterIp: ip,
      deleted: false,
      recipientId,
    };
    await db.collection("feedbacks").add(feedbackData);
    return { success: true };
  } catch (err) {
    if (err && err.code) {
      throw err;
    }
    console.error("submitFeedbackFromImgflip error:", err);
    throw new HttpsError("internal", "Failed to send. Try again.");
  }
});

exports.submitFeedback = onCall({ cors: CORS_ORIGINS }, async (request) => {
  try {
    const { imageId, parentId, feedbackImageUrl, recipientId } = request.data || {};
    if (!feedbackImageUrl || (typeof feedbackImageUrl !== "string") || feedbackImageUrl.length > 2048) {
      throw new HttpsError("invalid-argument", "Valid feedbackImageUrl is required");
    }

    const hasImage = !!imageId;
    const hasRecipient = !!recipientId;
    if (!hasImage && !hasRecipient) {
      throw new HttpsError("invalid-argument", "Either imageId or recipientId is required");
    }
    if (hasImage && hasRecipient) {
      throw new HttpsError("invalid-argument", "Provide imageId or recipientId, not both");
    }

    const ip = getClientIp(request.rawRequest);
    const ipKey = ip.replace(/[.:]/g, "_");

    const db = getFirestore();

    const blockedSnap = await db.doc(`blockedIps/${ipKey}`).get();
    if (blockedSnap.exists) {
      throw new HttpsError("permission-denied", "You cannot submit feedback. Your access has been restricted.");
    }

    if (hasImage) {
      const imageSnap = await db.doc(`images/${imageId}`).get();
      if (!imageSnap.exists) {
        throw new HttpsError("not-found", "Image not found. The link may have expired.");
      }
    } else {
      const userSnap = await db.doc(`users/${recipientId}`).get();
      if (!userSnap.exists) {
        throw new HttpsError("not-found", "User not found.");
      }
    }

    const feedbackData = {
      feedbackImageUrl,
      createdAt: new Date().toISOString(),
      submitterId: request.auth?.uid || null,
      submitterIp: ip,
      deleted: false,
    };
    if (hasImage) {
      feedbackData.imageId = imageId;
      feedbackData.parentId = parentId || null;
    } else {
      feedbackData.recipientId = recipientId;
    }

    await db.collection("feedbacks").add(feedbackData);
    return { success: true };
  } catch (err) {
    if (err && err.code) {
      throw err;
    }
    console.error("submitFeedback error:", err);
    throw new HttpsError("internal", "Failed to post. Please try again.");
  }
});

/**
 * Admin: Get users, reports, blocked IPs. Requires ADMIN_UIDS env var. (Gen 2)
 */
exports.getAdminData = onCall({ cors: true }, async (request) => {
  await requireAdmin(request);
  const db = getFirestore();

  const [usersSnap, reportsSnap, blockedSnap, feedbacksSnap, categoriesSnap, browseImagesSnap] = await Promise.all([
    db.collection("users").limit(500).get(),
    db.collection("reports").limit(200).get(),
    db.collection("blockedIps").limit(200).get(),
    db.collection("feedbacks").limit(100).get(),
    db.collection("categories").orderBy("order").get(),
    db.collection("browseImages").get(),
  ]);

  const toDoc = (d) => ({ id: d.id, ...d.data() });
  const sortByCreated = (a, b) => (new Date(b.createdAt || 0)).getTime() - (new Date(a.createdAt || 0)).getTime();

  const users = usersSnap.docs.map(toDoc).sort(sortByCreated);
  const reports = reportsSnap.docs.map(toDoc).sort(sortByCreated);
  const blockedIps = blockedSnap.docs.map(toDoc).sort(sortByCreated);
  const feedbacks = feedbacksSnap.docs.map(toDoc).sort(sortByCreated);
  const categories = categoriesSnap.docs.map(toDoc);
  const browseImages = browseImagesSnap.docs.map(toDoc).sort(sortByCreated);

  return { users, reports, blockedIps, feedbacks, categories, browseImages };
});

/**
 * Admin: Unblock an IP. (Gen 2)
 */
exports.adminUnblockIp = onCall({ cors: true }, async (request) => {
  await requireAdmin(request);
  const { ipKey } = request.data || {};
  if (!ipKey) {
    throw new HttpsError("invalid-argument", "ipKey is required");
  }

  const db = getFirestore();
  const docRef = db.collection("blockedIps").doc(ipKey);
  const snap = await docRef.get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "Blocked IP not found");
  }
  await docRef.delete();
  return { success: true };
});

/**
 * Admin: Add a UID to the admin list (Firestore config/admin). (Gen 2)
 */
exports.adminAddAdmin = onCall({ cors: true }, async (request) => {
  await requireAdmin(request);
  const { uid } = request.data || {};
  if (!uid || typeof uid !== "string") {
    throw new HttpsError("invalid-argument", "uid is required");
  }
  const newUid = uid.trim();
  if (!newUid) {
    throw new HttpsError("invalid-argument", "uid is required");
  }

  const db = getFirestore();
  const configRef = db.doc("config/admin");

  const snap = await configRef.get();
  let uids = [];
  if (snap.exists) {
    const data = snap.data();
    uids = Array.isArray(data?.uids) ? [...data.uids] : [];
  }
  if (uids.includes(newUid)) {
    return { success: true, message: "Already an admin" };
  }
  uids.push(newUid);
  await configRef.set({ uids }, { merge: true });
  return { success: true, message: "Admin added" };
});

/**
 * Bootstrap: Add yourself as admin using ADMIN_SECRET. No existing admin required. (Gen 2)
 * Sign in first, then enter the admin key to add your UID to Firestore config/admin.
 */
exports.adminBootstrap = onCall({ cors: true }, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Sign in first, then use the admin key to add yourself.");
  }
  const { secret } = request.data || {};
  const expected = adminSecretParam.value() || process.env.ADMIN_SECRET || "";
  if (!expected) {
    throw new HttpsError("failed-precondition", "ADMIN_SECRET not configured. Set it in Firebase Console → Functions → Configuration.");
  }
  if (!secret || String(secret).trim() !== expected.trim()) {
    throw new HttpsError("permission-denied", "Invalid admin key");
  }

  const db = getFirestore();
  const configRef = db.doc("config/admin");
  const snap = await configRef.get();
  let uids = [];
  if (snap.exists) {
    const data = snap.data();
    uids = Array.isArray(data?.uids) ? [...data.uids] : [];
  }
  const uid = request.auth.uid;
  if (uids.includes(uid)) {
    return { success: true, message: "Already an admin" };
  }
  uids.push(uid);
  await configRef.set({ uids }, { merge: true });
  return { success: true, message: "Admin added. Reload the page." };
});

/**
 * Public: Get categories and browse images for the feedback page. (Gen 2)
 */
exports.getBrowseData = onCall({ cors: true }, async () => {
  const db = getFirestore();
  const [categoriesSnap, browseImagesSnap] = await Promise.all([
    db.collection("categories").orderBy("order").get(),
    db.collection("browseImages").get(),
  ]);
  const categories = categoriesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const browseImages = browseImagesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return { categories, browseImages };
});

/**
 * Admin: Add a category. (Gen 2)
 */
exports.adminAddCategory = onCall({ cors: true }, async (request) => {
  await requireAdmin(request);
  const { name } = request.data || {};
  if (!name || typeof name !== "string" || !name.trim()) {
    throw new HttpsError("invalid-argument", "name is required");
  }
  const db = getFirestore();
  const categoriesSnap = await db.collection("categories").orderBy("order", "desc").limit(1).get();
  const nextOrder = categoriesSnap.empty ? 0 : (categoriesSnap.docs[0].data().order || 0) + 1;
  await db.collection("categories").add({
    name: name.trim(),
    order: nextOrder,
    createdAt: new Date().toISOString(),
  });
  return { success: true };
});

/**
 * Admin: Delete a category. (Gen 2)
 */
exports.adminDeleteCategory = onCall({ cors: true }, async (request) => {
  await requireAdmin(request);
  const { categoryId } = request.data || {};
  if (!categoryId) throw new HttpsError("invalid-argument", "categoryId is required");
  const db = getFirestore();
  await db.collection("categories").doc(categoryId).delete();
  const imagesSnap = await db.collection("browseImages").get();
  const batch = db.batch();
  imagesSnap.docs.forEach((doc) => {
    const data = doc.data();
    const categoryIds = Array.isArray(data.categoryIds) ? data.categoryIds.filter((id) => id !== categoryId) : [];
    batch.update(doc.ref, { categoryIds });
  });
  await batch.commit();
  return { success: true };
});

/**
 * Admin: Upload a browse image (file upload). (Gen 2)
 */
exports.adminUploadBrowseImage = onCall({ cors: true }, async (request) => {
  await requireAdmin(request);
  const { data: base64Data, mimeType, name, categoryIds } = request.data || {};
  if (!base64Data || typeof base64Data !== "string") {
    throw new HttpsError("invalid-argument", "Image data is required");
  }
  const mime = (typeof mimeType === "string" && mimeType.match(/^image\//)) ? mimeType : "image/jpeg";
  const ext = mime === "image/png" ? "png" : mime === "image/gif" ? "gif" : mime === "image/webp" ? "webp" : "jpg";
  const base64 = base64Data.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(base64, "base64");
  if (buffer.length > 10 * 1024 * 1024) {
    throw new HttpsError("invalid-argument", "Image must be under 10MB");
  }
  const db = getFirestore();
  const docRef = db.collection("browseImages").doc();
  const id = docRef.id;
  const path = `browse_images/${id}.${ext}`;
  const bucket = getStorage().bucket();
  const file = bucket.file(path);
  await file.save(buffer, { contentType: mime, metadata: { cacheControl: "public, max-age=31536000" } });
  await file.makePublic();
  const imageUrl = `https://storage.googleapis.com/${bucket.name}/${path}`;
  const ids = Array.isArray(categoryIds) ? categoryIds : [];
  await docRef.set({
    imageUrl,
    name: typeof name === "string" ? name.trim() : "",
    source: "admin",
    categoryIds: ids,
    createdAt: new Date().toISOString(),
  });
  return { success: true, imageId: id };
});

/**
 * Admin: Add image from feedback to browse. (Gen 2)
 */
exports.adminAddImageFromFeedback = onCall({ cors: true }, async (request) => {
  await requireAdmin(request);
  const { feedbackId, categoryIds } = request.data || {};
  if (!feedbackId) throw new HttpsError("invalid-argument", "feedbackId is required");
  const db = getFirestore();
  const feedbackSnap = await db.collection("feedbacks").doc(feedbackId).get();
  if (!feedbackSnap.exists) throw new HttpsError("not-found", "Feedback not found");
  const data = feedbackSnap.data();
  const url = data?.feedbackImageUrl;
  if (!url) throw new HttpsError("invalid-argument", "Feedback has no image");
  const ids = Array.isArray(categoryIds) ? categoryIds : [];
  const existing = await db.collection("browseImages").where("feedbackId", "==", feedbackId).limit(1).get();
  if (!existing.empty) throw new HttpsError("already-exists", "This feedback is already in browse");
  await db.collection("browseImages").add({
    imageUrl: url,
    feedbackId,
    source: "shared",
    categoryIds: ids,
    createdAt: new Date().toISOString(),
  });
  return { success: true };
});

/**
 * Admin: Update image categories (many-to-many). (Gen 2)
 */
exports.adminUpdateImageCategories = onCall({ cors: true }, async (request) => {
  await requireAdmin(request);
  const { imageId, categoryIds } = request.data || {};
  if (!imageId) throw new HttpsError("invalid-argument", "imageId is required");
  const ids = Array.isArray(categoryIds) ? categoryIds : [];
  const db = getFirestore();
  const ref = db.collection("browseImages").doc(imageId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Image not found");
  await ref.update({ categoryIds: ids });
  return { success: true };
});

/**
 * Admin: Delete a browse image. (Gen 2)
 */
exports.adminDeleteBrowseImage = onCall({ cors: true }, async (request) => {
  await requireAdmin(request);
  const { imageId } = request.data || {};
  if (!imageId) throw new HttpsError("invalid-argument", "imageId is required");
  const db = getFirestore();
  await db.collection("browseImages").doc(imageId).delete();
  return { success: true };
});
