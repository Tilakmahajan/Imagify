import imageCompression from "browser-image-compression";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "./firebase";

/**
 * Post images (feed): optimized for display, stored efficiently.
 * Raw phone photos are often 5–10MB+; we target ~400–600KB.
 */
const POST_MAX_SIZE_MB = 0.6;
const POST_MAX_DIM = 1920;
const POST_QUALITY = 0.85;

/**
 * Feedback reactions: aggressive compression for storage.
 * Small thumbnails, fast load — target ~200–350KB.
 */
const FEEDBACK_MAX_SIZE_MB = 0.35;
const FEEDBACK_MAX_DIM = 1024;
const FEEDBACK_QUALITY = 0.82;

export async function compressImage(
  file: File,
  preset: "post" | "feedback" = "post"
): Promise<File> {
  const isPost = preset === "post";
  const options: Parameters<typeof imageCompression>[1] = {
    maxSizeMB: isPost ? POST_MAX_SIZE_MB : FEEDBACK_MAX_SIZE_MB,
    maxWidthOrHeight: isPost ? POST_MAX_DIM : FEEDBACK_MAX_DIM,
    useWebWorker: true,
    initialQuality: isPost ? POST_QUALITY : FEEDBACK_QUALITY,
    fileType: "image/jpeg",
    preserveExif: false,
    alwaysKeepResolution: false,
  };
  return imageCompression(file, options);
}

export async function uploadImage(
  file: File,
  userId: string,
  imageId: string
): Promise<string> {
  if (!storage) throw new Error("Firebase Storage not configured");

  const compressed = await compressImage(file, "post");
  const ext = compressed.name.split(".").pop() || "jpg";
  const path = `images/${userId}/${imageId}.${ext}`;
  const storageRef = ref(storage, path);

  await uploadBytes(storageRef, compressed);
  return getDownloadURL(storageRef);
}

/** Upload feedback image (anonymous) - stored in feedback_images/ */
export async function uploadFeedbackImage(
  file: File,
  feedbackId: string
): Promise<string> {
  if (!storage) throw new Error("Firebase Storage not configured");

  const compressed = await compressImage(file, "feedback");
  const ext = compressed.name.split(".").pop() || "jpg";
  const path = `feedback_images/${feedbackId}.${ext}`;
  const storageRef = ref(storage, path);

  await uploadBytes(storageRef, compressed);
  return getDownloadURL(storageRef);
}
