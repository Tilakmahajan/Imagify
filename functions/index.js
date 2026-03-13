const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");
const { getMessaging } = require("firebase-admin/messaging");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { defineString } = require("firebase-functions/params");

initializeApp();

// CORS: allow localhost (dev), production, and Capacitor iOS/Android WebViews
const CORS_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3002",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
  "http://127.0.0.1:3002",
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

/** Get admin UIDs from Firestore config/admin or env/param. */
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

/** Derive a stable, hashed anonymousId from an IP address */
const crypto = require("crypto");
function getIpHash(ip) {
  const salt = process.env.ANON_HASH_SALT || "picpop-anon-v1";
  return crypto.createHmac("sha256", salt).update(ip).digest("hex").substring(0, 16);
}

/**
 * When someone adds image feedback to a post, send a push notification to the post owner. (Gen 2)
 */
exports.onFeedbackCreatedV2 = onDocumentCreated("feedbacks/{feedbackId}", async (event) => {
  const snap = event.data;
  if (!snap) return;
  const feedback = snap.data();
  const feedbackId = event.params.feedbackId;
  const isOwnerReply = feedback.isOwnerReply === true;

  const db = getFirestore();

  try {
    let notifyUid = null;
    let notifySessionId = null;
    let title = isOwnerReply ? "New reply" : "New feedback";
    let body = "";
    let clickLink = "/inbox";

    // 1. Identify recipient and message body
    if (isOwnerReply) {
      // Owner is replying to a visitor (guest or logged-in)
      notifyUid = feedback.targetUid || null;
      notifySessionId = feedback.sessionId || null;
      
      const ownerSnap = await db.doc(`users/${feedback.submitterId}`).get();
      const ownerName = ownerSnap.exists ? `@${ownerSnap.data()?.coolId || 'someone'}` : "The owner";
      body = `${ownerName} replied: "${feedback.message || 'Sent an attachment'}"`;
      const threadId = feedback.threadId || feedbackId;
      clickLink = `/u/${ownerSnap.data()?.coolId || 'someone'}?thread=${threadId}`;
    } else {
      // Visitor is sending feedback to owner
      notifyUid = feedback.recipientId;
      const submitterName = feedback.submitterId ? "Someone" : "A guest";
      body = `${submitterName} sent you feedback.`;
      clickLink = feedback.imageId ? `/f?imageId=${feedback.imageId}` : "/inbox";
    }

    if (!notifyUid && !notifySessionId) return;

    // 2. Add to internal notifications collection (for permanent UI history)
    if (notifyUid) {
      await db.collection("notifications").add({
        recipientId: notifyUid,
        message: body,
        isRead: false,
        createdAt: FieldValue.serverTimestamp(),
        type: isOwnerReply ? "owner_reply" : "anonymous_feedback",
        feedbackId,
        feedbackImageUrl: feedback.feedbackImageUrl || null,
        feedbackMessage: feedback.message || null,
        sessionId: feedback.sessionId || null,
        threadId: feedback.threadId || feedbackId,
      });
    }

    // 3. Find FCM Token
    let fcmToken = null;
    if (notifyUid) {
      const userSnap = await db.doc(`users/${notifyUid}`).get();
      fcmToken = userSnap.exists ? userSnap.data()?.fcmToken : null;
    }
    if (!fcmToken && notifySessionId) {
      const sessionSnap = await db.doc(`sessions/${notifySessionId}`).get();
      fcmToken = sessionSnap.exists ? sessionSnap.data()?.fcmToken : null;
    }

    // 4. Send Push
    if (fcmToken) {
      const message = {
        token: fcmToken,
        notification: { title, body },
        data: {
          type: isOwnerReply ? "reply" : "feedback",
          feedbackId: String(feedbackId),
          title,
          body,
          link: clickLink,
        },
        webpush: { fcmOptions: { link: clickLink } },
      };
      await getMessaging().send(message);
      console.log(`Push sent to ${notifyUid || notifySessionId}`);
    }
  } catch (err) {
    console.error("Push notification failed:", err);
  }
});

/**
 * When someone visits a feedback link, notify the post/link owner. (Gen 2)
 */
exports.onVisitCreatedV2 = onDocumentCreated("visits/{visitId}", async (event) => {
  const snap = event.data;
  if (!snap) return;
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

    await db.collection("notifications").add({
      recipientId: ownerUserId,
      message: body,
      isRead: false,
      createdAt: FieldValue.serverTimestamp(),
      type: "visit",
      imageId: visit.imageId || null,
      coolId,
    });

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
        webpush: { fcmOptions: { link: clickLink } },
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
 * Report feedback. (Gen 2)
 */
exports.reportFeedback = onCall({ cors: CORS_ORIGINS }, async (request) => {
  const { feedbackId, reason, otherReason, action } = request.data || {};
  if (!feedbackId) throw new HttpsError("invalid-argument", "feedbackId is required");
  const act = action || "report";
  if (!["report", "block"].includes(act)) throw new HttpsError("invalid-argument", "action must be report or block");
  if (!reason) throw new HttpsError("invalid-argument", "reason is required");

  const reporterIp = getClientIp(request.rawRequest);
  const db = getFirestore();

  try {
    const feedbackSnap = await db.doc(`feedbacks/${feedbackId}`).get();
    if (!feedbackSnap.exists) throw new HttpsError("not-found", "Feedback not found");
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
 * Delete inbox feedback - only recipient can delete. (Gen 2)
 */
exports.deleteInboxFeedback = onCall({ cors: CORS_ORIGINS }, async (request) => {
  const { feedbackId } = request.data || {};
  if (!feedbackId) throw new HttpsError("invalid-argument", "feedbackId is required");
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Sign in to delete");

  const db = getFirestore();
  const feedbackSnap = await db.doc(`feedbacks/${feedbackId}`).get();
  if (!feedbackSnap.exists) throw new HttpsError("not-found", "Feedback not found");
  const feedback = feedbackSnap.data();
  if (feedback?.recipientId !== request.auth.uid) {
    throw new HttpsError("permission-denied", "Only the recipient can delete this feedback");
  }

  await db.doc(`feedbacks/${feedbackId}`).update({ deleted: true, deletedAt: new Date().toISOString() });

  const notifSnap = await db.collection("notifications")
    .where("feedbackId", "==", feedbackId).limit(1).get();
  notifSnap.docs.forEach((d) => d.ref.delete());

  return { success: true };
});

/**
 * Delete feedback - only image owner can delete. (Gen 2)
 */
exports.deleteFeedback = onCall({ cors: CORS_ORIGINS }, async (request) => {
  const { feedbackId } = request.data || {};
  if (!feedbackId) throw new HttpsError("invalid-argument", "feedbackId is required");
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Sign in to delete");

  const db = getFirestore();
  const feedbackSnap = await db.doc(`feedbacks/${feedbackId}`).get();
  if (!feedbackSnap.exists) throw new HttpsError("not-found", "Feedback not found");
  const feedback = feedbackSnap.data();
  const imageId = feedback?.imageId;
  if (!imageId) throw new HttpsError("internal", "Invalid feedback");

  const imageSnap = await db.doc(`images/${imageId}`).get();
  if (!imageSnap.exists) throw new HttpsError("not-found", "Image not found");
  const image = imageSnap.data();
  if (image?.userId !== request.auth.uid) {
    throw new HttpsError("permission-denied", "Only the post owner can delete");
  }

  await db.doc(`feedbacks/${feedbackId}`).update({ deleted: true, deletedAt: new Date().toISOString() });
  return { success: true };
});

/**
 * Get popular memes from Imgflip API. (Gen 2)
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
 * Search images using Google Custom Search API. (Gen 2)
 */
exports.searchGoogleImages = onCall({ cors: CORS_ORIGINS }, async (request) => {
  const { query, start } = request.data || {};
  if (!query || typeof query !== "string") throw new HttpsError("invalid-argument", "query is required");

  const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const cx = process.env.GOOGLE_SEARCH_CX;
  if (!apiKey || !cx) throw new HttpsError("failed-precondition", "GOOGLE_SEARCH_API_KEY or GOOGLE_SEARCH_CX not configured");

  const url = `https://customsearch.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(query)}&searchType=image&start=${start || 1}&num=10`;
  console.log(`Searching Google: query="${query}" start=${start || 1}`);

  try {
    const res = await fetch(url);
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      console.error("Non-JSON response from Google Search:", text.slice(0, 500));
      throw new HttpsError("internal", `Google Search API returned non-JSON response (Status: ${res.status})`);
    }
    if (json.error) {
      console.error("Google Search API error:", JSON.stringify(json.error));
      throw new HttpsError("internal", json.error.message || "Search failed");
    }
    const items = (json.items || []).map((item) => ({
      id: item.link,
      imageUrl: item.link,
      name: item.title,
      width: item.image?.width,
      height: item.image?.height,
      thumbnail: item.image?.thumbnailLink,
    }));
    return { items };
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    console.error("searchGoogleImages error:", err);
    throw new HttpsError("internal", err.message || "Failed to search images");
  }
});

/**
 * Submit feedback using an Imgflip meme URL. (Gen 2)
 */
exports.submitFeedbackFromImgflip = onCall({ cors: CORS_ORIGINS }, async (request) => {
  try {
    const { imageUrl, recipientId, anonymousId, sessionId } = request.data || {};
    if (!imageUrl || typeof imageUrl !== "string") throw new HttpsError("invalid-argument", "imageUrl is required");
    if (!recipientId || typeof recipientId !== "string") throw new HttpsError("invalid-argument", "recipientId is required");
    const url = imageUrl.trim();
    if (!url.startsWith("https://i.imgflip.com/")) throw new HttpsError("invalid-argument", "Only Imgflip image URLs are allowed");

    const ip = getClientIp(request.rawRequest);
    const ipKey = ip.replace(/[.:]/g, "_");
    const db = getFirestore();

    const blockedSnap = await db.doc(`blockedIps/${ipKey}`).get();
    if (blockedSnap.exists) throw new HttpsError("permission-denied", "You cannot submit feedback. Your access has been restricted.");

    const userSnap = await db.doc(`users/${recipientId}`).get();
    if (!userSnap.exists) throw new HttpsError("not-found", "User not found.");

    const imgRes = await fetch(url);
    if (!imgRes.ok) throw new HttpsError("internal", "Could not fetch image. Try another meme.");
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

    const uid = request.auth?.uid || null;
    const resolvedAnonymousId = anonymousId || getIpHash(ip);
    const visitorId = uid || resolvedAnonymousId;

    const threadId = request.data.threadId || require("crypto").randomUUID();
    const feedbackData = {
      feedbackImageUrl,
      createdAt: new Date().toISOString(),
      submitterId: uid, 
      submitterIp: ip,
      anonymousId: resolvedAnonymousId,
      visitorId,
      sessionId: sessionId || null,
      threadId,
      deleted: false,
      recipientId,
    };
    await db.collection("feedbacks").add(feedbackData);
    return { success: true, threadId };
  } catch (err) {
    if (err && err.code) throw err;
    console.error("submitFeedbackFromImgflip error:", err);
    throw new HttpsError("internal", "Failed to send. Try again.");
  }
});

/**
 * Submit feedback - supports either imageId or recipientId. (Gen 2)
 * anonymousId is now derived server-side from the caller's IP hash.
 */
exports.submitFeedback = onCall({ cors: CORS_ORIGINS }, async (request) => {
  try {
    const { imageId, parentId, feedbackImageUrl, message, recipientId, attachmentUrl, attachmentName } = request.data || {};
    if (!feedbackImageUrl && !message && !attachmentUrl) {
      throw new HttpsError("invalid-argument", "Either feedbackImageUrl, message or attachment is required");
    }
    if (feedbackImageUrl && (typeof feedbackImageUrl !== "string" || feedbackImageUrl.length > 2048)) {
      throw new HttpsError("invalid-argument", "Valid feedbackImageUrl is required");
    }
    if (message && (typeof message !== "string" || message.length > 2048)) {
      throw new HttpsError("invalid-argument", "Valid message is required");
    }

    const uid = request.auth?.uid || null;

    const hasImage = !!imageId;
    const hasRecipient = !!recipientId;
    if (!hasImage && !hasRecipient) throw new HttpsError("invalid-argument", "Either imageId or recipientId is required");
    if (hasImage && hasRecipient) throw new HttpsError("invalid-argument", "Provide imageId or recipientId, not both");

    const ip = getClientIp(request.rawRequest);
    const ipKey = ip.replace(/[.:]/g, "_");
    const anonymousId = getIpHash(ip); // Server-derived, not client-provided
    const db = getFirestore();

    const blockedSnap = await db.doc(`blockedIps/${ipKey}`).get();
    if (blockedSnap.exists) throw new HttpsError("permission-denied", "You cannot submit feedback. Your access has been restricted.");

    let resolvedRecipientId = recipientId || null;

    if (hasImage) {
      const imageSnap = await db.doc(`images/${imageId}`).get();
      if (!imageSnap.exists) throw new HttpsError("not-found", "Image not found. The link may have expired.");
      const imageData = imageSnap.data();
      if (!resolvedRecipientId && imageData?.userId) {
        resolvedRecipientId = imageData.userId;
      }
    } else {
      const userSnap = await db.doc(`users/${recipientId}`).get();
      if (!userSnap.exists) throw new HttpsError("not-found", "User not found.");
    }

    if (!resolvedRecipientId) {
      throw new HttpsError("invalid-argument", "Could not determine recipient.");
    }

    const visitorId = uid || anonymousId;
    const feedbackData = {
      createdAt: new Date().toISOString(),
      submitterId: uid,
      submitterIp: ip,
      anonymousId,
      visitorId, // NEW: Thread Identifier
      sessionId: request.data.sessionId || null,
      threadId: request.data.threadId || require("crypto").randomUUID(),
      deleted: false,
      recipientId: resolvedRecipientId, // The profile owner
    };
    if (feedbackImageUrl) feedbackData.feedbackImageUrl = feedbackImageUrl;
    if (message) feedbackData.message = message;
    if (attachmentUrl) feedbackData.attachmentUrl = attachmentUrl;
    if (attachmentName) feedbackData.attachmentName = attachmentName;
    if (hasImage) {
      feedbackData.imageId = imageId;
      feedbackData.parentId = parentId || null;
    }

    await db.collection("feedbacks").add(feedbackData);

    // If logged in, store IP→uid mapping for history attribution
    if (request.auth?.uid) {
      await db.doc(`anonUserMappings/${anonymousId}`).set({
        uid: request.auth.uid,
        ip: ipKey,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    }

    return { success: true, anonymousId, threadId: feedbackData.threadId };
  } catch (err) {
    if (err && err.code) throw err;
    console.error("submitFeedback error:", err);
    throw new HttpsError("internal", "Failed to post. Please try again.");
  }
});

/**
 * Get the anonymous chat history for the current caller (identified by IP).
 * Returns all feedbacks to a specific recipient from this IP's hash.
 */
exports.getAnonymousChatHistory = onCall({ cors: CORS_ORIGINS }, async (request) => {
  try {
    const { recipientId, sessionId, threadId } = request.data || {};
    if (!recipientId || typeof recipientId !== "string") {
      throw new HttpsError("invalid-argument", "recipientId is required");
    }

    const ip = getClientIp(request.rawRequest);
    const anonymousId = getIpHash(ip);
    const db = getFirestore();

    // If threadId is provided, we only want THAT thread's history
    if (threadId) {
      const snap = await db.collection("feedbacks")
        .where("threadId", "==", threadId)
        .limit(200)
        .get();
      
      const items = snap.docs
        .filter(d => d.data().deleted !== true)
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      
      return { success: true, anonymousId, items };
    }

    let finalItems = snapIp.docs
      .filter(d => d.data().deleted !== true)
      .map(d => ({ id: d.id, ...d.data() }));

    // Query 2: By sessionId if provided
    if (sessionId) {
      const snapSession = await db.collection("feedbacks")
        .where("recipientId", "==", recipientId)
        .where("sessionId", "==", sessionId)
        .limit(100)
        .get();
      
      const sessionItems = snapSession.docs
        .filter(d => d.data().deleted !== true)
        .map(d => ({ id: d.id, ...d.data() }));
      
      const seenIds = new Set(finalItems.map(i => i.id));
      for (const item of sessionItems) {
        if (!seenIds.has(item.id)) {
          finalItems.push(item);
          seenIds.add(item.id);
        }
      }
    }

    // Query 3: By UID if authenticated
    if (request.auth?.uid) {
      const uid = request.auth.uid;
      // Items sent by this user or targeted to this user
      const [snapSent, snapReplies] = await Promise.all([
        db.collection("feedbacks").where("recipientId", "==", recipientId).where("submitterId", "==", uid).limit(100).get(),
        db.collection("feedbacks").where("submitterId", "==", recipientId).where("recipientId", "==", uid).limit(100).get()
      ]);

      const uidItems = [...snapSent.docs, ...snapReplies.docs]
        .filter(d => d.data().deleted !== true)
        .map(d => ({ id: d.id, ...d.data() }));

      const seenIds = new Set(finalItems.map(i => i.id));
      for (const item of uidItems) {
        if (!seenIds.has(item.id)) {
          finalItems.push(item);
          seenIds.add(item.id);
        }
      }
    }

    // Sort by time
    finalItems.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    // Security Filter: If an item has a targetUid, and it's NOT the current user's UID, remove it.
    // This prevents anon users on the same IP from seeing private replies meant for a verified user.
    finalItems = finalItems.filter(item => {
      if (!item.targetUid) return true;
      return item.targetUid === request.auth?.uid;
    });

    return { success: true, anonymousId, items: finalItems };
  } catch (err) {
    if (err && err.code) throw err;
    console.error("getAnonymousChatHistory error:", err);
    throw new HttpsError("internal", "Failed to load chat history.");
  }
});

/**
 * Called when a user logs in — maps their current IP hash to their uid.
 * This links any anonymous feedback they sent to their account.
 */
exports.mapIpToUser = onCall({ cors: CORS_ORIGINS }, async (request) => {
  try {
    if (!request.auth || !request.auth.uid) {
      throw new HttpsError("unauthenticated", "Must be logged in");
    }
    const ip = getClientIp(request.rawRequest);
    const anonymousId = getIpHash(ip);
    const db = getFirestore();

    await db.doc(`anonUserMappings/${anonymousId}`).set({
      uid: request.auth.uid,
      ip: ip.replace(/[.:]/g, "_"),
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    return { success: true, anonymousId };
  } catch (err) {
    if (err && err.code) throw err;
    console.error("mapIpToUser error:", err);
    throw new HttpsError("internal", "Failed to map user.");
  }
});

exports.submitOwnerReply = onCall({ cors: CORS_ORIGINS }, async (request) => {
  try {
    const { message, anonymousId, targetUid, sessionId, feedbackImageUrl, attachmentUrl, attachmentName, threadId } = request.data || {};
    const targetUidClean = (targetUid && typeof targetUid === "string") ? targetUid.trim() : null;
    const anonymousIdClean = (anonymousId && typeof anonymousId === "string") ? anonymousId.trim() : null;

    if (!attachmentUrl && !feedbackImageUrl && (!message || typeof message !== "string" || !message.trim())) {
      throw new HttpsError("invalid-argument", "Valid message, image, or attachment is required");
    }
    if (!anonymousIdClean && !targetUidClean) {
      throw new HttpsError("invalid-argument", "Either anonymousId or targetUid is required");
    }
    if (!threadId) {
      throw new HttpsError("invalid-argument", "threadId is required for replies");
    }
    if (!request.auth || !request.auth.uid) {
      throw new HttpsError("unauthenticated", "You must be logged in to reply");
    }

    const ip = getClientIp(request.rawRequest);
    const db = getFirestore();
    const visitorId = targetUidClean || anonymousIdClean || getIpHash(ip);

    const replyData = {
      message: message ? message.trim() : "",
      createdAt: new Date().toISOString(),
      submitterId: request.auth.uid,
      submitterIp: ip,
      anonymousId: anonymousIdClean,
      visitorId, 
      sessionId: sessionId || null, 
      targetUid: targetUidClean,
      threadId: threadId,
      recipientId: targetUidClean || request.auth.uid, 
      isOwnerReply: true,
      deleted: false,
      feedbackImageUrl: feedbackImageUrl || null,
      attachmentUrl: attachmentUrl || null,
      attachmentName: attachmentName || null,
    };

    await db.collection("feedbacks").add(replyData);
    return { success: true };
  } catch (err) {
    if (err && err.code) throw err;
    console.error("submitOwnerReply error:", err);
    throw new HttpsError("internal", "Failed to send reply. Try again.");
  }
});


/**
 * Admin: Get users, reports, blocked IPs. (Gen 2)
 */
exports.getAdminData = onCall({ cors: CORS_ORIGINS }, async (request) => {
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

  return {
    users: usersSnap.docs.map(toDoc).sort(sortByCreated),
    reports: reportsSnap.docs.map(toDoc).sort(sortByCreated),
    blockedIps: blockedSnap.docs.map(toDoc).sort(sortByCreated),
    feedbacks: feedbacksSnap.docs.map(toDoc).sort(sortByCreated),
    categories: categoriesSnap.docs.map(toDoc),
    browseImages: browseImagesSnap.docs.map(toDoc).sort(sortByCreated),
  };
});

/**
 * Admin: Unblock an IP. (Gen 2)
 */
exports.adminUnblockIp = onCall({ cors: CORS_ORIGINS }, async (request) => {
  await requireAdmin(request);
  const { ipKey } = request.data || {};
  if (!ipKey) throw new HttpsError("invalid-argument", "ipKey is required");
  const db = getFirestore();
  const docRef = db.collection("blockedIps").doc(ipKey);
  const snap = await docRef.get();
  if (!snap.exists) throw new HttpsError("not-found", "Blocked IP not found");
  await docRef.delete();
  return { success: true };
});

/**
 * Admin: Add a UID to the admin list. (Gen 2)
 */
exports.adminAddAdmin = onCall({ cors: CORS_ORIGINS }, async (request) => {
  await requireAdmin(request);
  const { uid } = request.data || {};
  if (!uid || typeof uid !== "string" || !uid.trim()) throw new HttpsError("invalid-argument", "uid is required");
  const newUid = uid.trim();
  const db = getFirestore();
  const configRef = db.doc("config/admin");
  const snap = await configRef.get();
  let uids = [];
  if (snap.exists) {
    const data = snap.data();
    uids = Array.isArray(data?.uids) ? [...data.uids] : [];
  }
  if (uids.includes(newUid)) return { success: true, message: "Already an admin" };
  uids.push(newUid);
  await configRef.set({ uids }, { merge: true });
  return { success: true, message: "Admin added" };
});

/**
 * Bootstrap: Add yourself as admin using ADMIN_SECRET. (Gen 2)
 */
exports.adminBootstrap = onCall({ cors: CORS_ORIGINS }, async (request) => {
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
  if (uids.includes(uid)) return { success: true, message: "Already an admin" };
  uids.push(uid);
  await configRef.set({ uids }, { merge: true });
  return { success: true, message: "Admin added. Reload the page." };
});

/**
 * Public: Get categories and browse images. (Gen 2)
 */
exports.getBrowseData = onCall({ cors: CORS_ORIGINS }, async () => {
  const db = getFirestore();
  const [categoriesSnap, browseImagesSnap] = await Promise.all([
    db.collection("categories").orderBy("order").get(),
    db.collection("browseImages").get(),
  ]);
  return {
    categories: categoriesSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    browseImages: browseImagesSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
  };
});

/**
 * Admin: Add a category. (Gen 2)
 */
exports.adminAddCategory = onCall({ cors: CORS_ORIGINS }, async (request) => {
  await requireAdmin(request);
  const { name } = request.data || {};
  if (!name || typeof name !== "string" || !name.trim()) throw new HttpsError("invalid-argument", "name is required");
  const db = getFirestore();
  const categoriesSnap = await db.collection("categories").orderBy("order", "desc").limit(1).get();
  const nextOrder = categoriesSnap.empty ? 0 : (categoriesSnap.docs[0].data().order || 0) + 1;
  await db.collection("categories").add({ name: name.trim(), order: nextOrder, createdAt: new Date().toISOString() });
  return { success: true };
});

/**
 * Admin: Delete a category. (Gen 2)
 */
exports.adminDeleteCategory = onCall({ cors: CORS_ORIGINS }, async (request) => {
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
 * Admin: Upload a browse image. (Gen 2)
 */
exports.adminUploadBrowseImage = onCall({ cors: CORS_ORIGINS }, async (request) => {
  await requireAdmin(request);
  const { data: base64Data, mimeType, name, categoryIds } = request.data || {};
  if (!base64Data || typeof base64Data !== "string") throw new HttpsError("invalid-argument", "Image data is required");
  const mime = (typeof mimeType === "string" && mimeType.match(/^image\//)) ? mimeType : "image/jpeg";
  const ext = mime === "image/png" ? "png" : mime === "image/gif" ? "gif" : mime === "image/webp" ? "webp" : "jpg";
  const base64 = base64Data.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(base64, "base64");
  if (buffer.length > 10 * 1024 * 1024) throw new HttpsError("invalid-argument", "Image must be under 10MB");
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
  await docRef.set({ imageUrl, name: typeof name === "string" ? name.trim() : "", source: "admin", categoryIds: ids, createdAt: new Date().toISOString() });
  return { success: true, imageId: id };
});

/**
 * Admin: Add image from feedback to browse. (Gen 2)
 */
exports.adminAddImageFromFeedback = onCall({ cors: CORS_ORIGINS }, async (request) => {
  await requireAdmin(request);
  const { feedbackId, categoryIds } = request.data || {};
  if (!feedbackId) throw new HttpsError("invalid-argument", "feedbackId is required");
  const db = getFirestore();
  const feedbackSnap = await db.collection("feedbacks").doc(feedbackId).get();
  if (!feedbackSnap.exists) throw new HttpsError("not-found", "Feedback not found");
  const d = feedbackSnap.data();
  const url = d?.feedbackImageUrl;
  if (!url) throw new HttpsError("invalid-argument", "Feedback has no image");
  const ids = Array.isArray(categoryIds) ? categoryIds : [];
  const existing = await db.collection("browseImages").where("feedbackId", "==", feedbackId).limit(1).get();
  if (!existing.empty) throw new HttpsError("already-exists", "This feedback is already in browse");
  await db.collection("browseImages").add({ imageUrl: url, feedbackId, source: "shared", categoryIds: ids, createdAt: new Date().toISOString() });
  return { success: true };
});

/**
 * Admin: Update image categories. (Gen 2)
 */
exports.adminUpdateImageCategories = onCall({ cors: CORS_ORIGINS }, async (request) => {
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
exports.adminDeleteBrowseImage = onCall({ cors: CORS_ORIGINS }, async (request) => {
  await requireAdmin(request);
  const { imageId } = request.data || {};
  if (!imageId) throw new HttpsError("invalid-argument", "imageId is required");
  const db = getFirestore();
  await db.collection("browseImages").doc(imageId).delete();
  return { success: true };
});

/**
 * Public: Log feedback interaction (view, reshare, timeSpent). (Gen 2)
 */
exports.logFeedbackActivity = onCall({ cors: CORS_ORIGINS }, async (request) => {
  const { feedbackId, type, timeSpent } = request.data || {};
  if (!feedbackId || !type) throw new HttpsError("invalid-argument", "Missing required fields");

  const db = getFirestore();
  const feedbackRef = db.collection("feedbacks").doc(feedbackId);

  try {
    const updateData = {};
    if (type === "view") updateData.viewCount = FieldValue.increment(1);
    if (type === "reshare") updateData.reshareCount = FieldValue.increment(1);
    if (type === "time" && typeof timeSpent === "number") {
      updateData.totalTimeSpent = FieldValue.increment(timeSpent);
    }
    if (Object.keys(updateData).length > 0) {
      await feedbackRef.update(updateData);
    }
    return { success: true };
  } catch (err) {
    if (err.code === 5 || (err.message && err.message.includes("NOT_FOUND"))) {
      return { success: false, reason: "not-found" };
    }
    console.error("logFeedbackActivity error:", err);
    throw new HttpsError("internal", "Failed to log activity");
  }
});
