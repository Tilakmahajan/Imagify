import { getAppFunctions } from "./functions";
import { httpsCallable } from "firebase/functions";

export interface ImgflipMeme {
  id: string;
  name: string;
  url: string;
  width: number;
  height: number;
  box_count: number;
  captions?: number;
}

const RECENT_KEY = "picpop_recent_memes";

export function getRecentMemes(): ImgflipMeme[] {
  if (typeof window === "undefined") return [];
  try {
    const s = localStorage.getItem(RECENT_KEY);
    if (!s) return [];
    const parsed = JSON.parse(s) as ImgflipMeme[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function addRecentMeme(meme: ImgflipMeme) {
  if (typeof window === "undefined") return;
  try {
    const recent = getRecentMemes().filter((m) => m.id !== meme.id);
    recent.unshift(meme);
    const trimmed = recent.slice(0, 20);
    localStorage.setItem(RECENT_KEY, JSON.stringify(trimmed));
  } catch {
    /* ignore */
  }
}

export async function fetchImgflipMemes(): Promise<ImgflipMeme[]> {
  const functions = getAppFunctions();
  if (!functions) throw new Error("Firebase not configured");
  const fn = httpsCallable<unknown, { memes: ImgflipMeme[] }>(functions, "getImgflipMemes");
  const { data } = await fn({});
  return data.memes || [];
}
