"use client";

import { useEffect, useState, useRef } from "react";
import { ImageIcon, Clock, Loader2 } from "lucide-react";

function LazyImage({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  const [isVisible, setIsVisible] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = imgRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setIsVisible(true);
      },
      { rootMargin: "80px", threshold: 0.01 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={imgRef} className={`w-full h-full min-h-0 overflow-hidden ${className}`}>
      {isVisible ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={src} alt={alt} className="w-full h-full object-cover" loading="lazy" decoding="async" />
      ) : (
        <div className="w-full h-full min-h-[60px] bg-[var(--bg-card)] animate-pulse" />
      )}
    </div>
  );
}
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
} from "firebase/firestore";
import { db, ensureFirestoreNetwork } from "@/lib/firebase";
import {
  fetchImgflipMemes,
  getRecentMemes,
  addRecentMeme,
  type ImgflipMeme,
} from "@/lib/imgflip";

export interface SharedFeedback {
  id: string;
  feedbackImageUrl: string;
  createdAt: string;
}

type BrowseItem =
  | { type: "meme"; id: string; url: string; name: string }
  | { type: "shared"; id: string; feedbackImageUrl: string };

export function ExploreImages({
  onSubmit,
  onSubmitShared,
  disabled,
}: {
  onSubmit: (meme: ImgflipMeme) => Promise<void>;
  onSubmitShared?: (item: SharedFeedback) => Promise<void>;
  disabled?: boolean;
}) {
  const [memes, setMemes] = useState<ImgflipMeme[]>([]);
  const [shared, setShared] = useState<SharedFeedback[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingShared, setLoadingShared] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sharedError, setSharedError] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [tab, setTab] = useState<"browse" | "recent">("browse");
  const [hasLoadedBrowse, setHasLoadedBrowse] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const hasTriggeredRef = useRef(false);

  const recent = getRecentMemes();

  useEffect(() => {
    const el = sectionRef.current;
    if (!el || hasTriggeredRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && !hasTriggeredRef.current) {
          hasTriggeredRef.current = true;
          setHasLoadedBrowse(true);
        }
      },
      { rootMargin: "100px", threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!hasLoadedBrowse) return;
    let mounted = true;
    setLoading(true);
    fetchImgflipMemes()
      .then((list) => {
        if (mounted) setMemes(list);
      })
      .catch((err) => {
        if (mounted) setError(err?.message || "Failed to load");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, [hasLoadedBrowse]);

  useEffect(() => {
    if (!hasLoadedBrowse) return;
    let mounted = true;
    setLoadingShared(true);
    setSharedError(null);
    const run = async () => {
      try {
        if (!db) throw new Error("Firebase not configured");
        await ensureFirestoreNetwork();
        const q = query(
          collection(db, "feedbacks"),
          orderBy("createdAt", "desc"),
          limit(60)
        );
        const snap = await getDocs(q);
        const seenUrls = new Set<string>();
        const items = snap.docs
          .filter((d) => {
            const data = d.data();
            if (data.deleted === true || !data.feedbackImageUrl) return false;
            const url = data.feedbackImageUrl as string;
            if (seenUrls.has(url)) return false; // Dedupe: same image shared by multiple users appears only once
            seenUrls.add(url);
            return true;
          })
          .map((d) => {
            const data = d.data();
            return {
              id: d.id,
              feedbackImageUrl: data.feedbackImageUrl as string,
              createdAt: typeof data.createdAt === "string" ? data.createdAt : new Date().toISOString(),
            };
          });
        if (mounted) setShared(items);
      } catch (err) {
        if (mounted) setSharedError(err && typeof err === "object" && "message" in err ? String((err as Error).message) : "Failed to load");
      } finally {
        if (mounted) setLoadingShared(false);
      }
    };
    run();
    return () => { mounted = false; };
  }, [hasLoadedBrowse]);

  const browseItems: BrowseItem[] = [
    ...shared.map((s) => ({ type: "shared" as const, id: s.id, feedbackImageUrl: s.feedbackImageUrl })),
    ...memes.map((m) => ({ type: "meme" as const, id: m.id, url: m.url, name: m.name })),
  ];

  const handleMemeSelect = async (meme: ImgflipMeme) => {
    if (disabled || submittingId) return;
    setSubmittingId(meme.id);
    try {
      addRecentMeme(meme);
      await onSubmit(meme);
    } finally {
      setSubmittingId(null);
    }
  };

  const handleSharedSelect = async (item: SharedFeedback) => {
    if (disabled || submittingId || !onSubmitShared) return;
    setSubmittingId(item.id);
    try {
      await onSubmitShared(item);
    } finally {
      setSubmittingId(null);
    }
  };

  const handleItemSelect = async (item: BrowseItem) => {
    if (item.type === "meme") {
      const meme = memes.find((m) => m.id === item.id);
      if (meme) await handleMemeSelect(meme);
    } else {
      await handleSharedSelect({ id: item.id, feedbackImageUrl: item.feedbackImageUrl, createdAt: "" });
    }
  };

  return (
    <section ref={sectionRef} className="mt-8 w-full min-w-0 overflow-hidden">
      <div className="flex items-center gap-2 mb-4">
        <ImageIcon className="w-5 h-5 text-[var(--purple)]" />
        <h3 className="font-black text-[var(--text-primary)]">Browse</h3>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => {
            setTab("browse");
            if (!hasTriggeredRef.current) {
              hasTriggeredRef.current = true;
              setHasLoadedBrowse(true);
            }
          }}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
            tab === "browse"
              ? "text-white"
              : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          }`}
          style={
            tab === "browse"
              ? {
                  background: "linear-gradient(135deg, var(--purple), var(--blue))",
                  boxShadow: "0 4px 16px rgba(124,58,255,0.3)",
                }
              : { background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)" }
          }
        >
          Browse
        </button>
        <button
          type="button"
          onClick={() => setTab("recent")}
          className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-1.5 transition-all ${
            tab === "recent"
              ? "text-white"
              : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          }`}
          style={
            tab === "recent"
              ? {
                  background: "linear-gradient(135deg, var(--pink), var(--purple))",
                  boxShadow: "0 4px 16px rgba(255,61,127,0.3)",
                }
              : { background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)" }
          }
        >
          <Clock className="w-4 h-4" /> Recent
        </button>
      </div>

      {tab === "browse" && (!hasLoadedBrowse ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-[var(--text-muted)]">
          <p className="font-semibold text-sm">Scroll down to load images</p>
          <p className="text-xs">or tap Browse when visible</p>
        </div>
      ) : loading || loadingShared ? (
        <div className="flex items-center justify-center py-12 gap-2 text-[var(--text-muted)]">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span className="font-semibold">Loading...</span>
        </div>
      ) : browseItems.length === 0 ? (
        (error || sharedError) ? (
          <p className="text-center py-8 text-[var(--text-muted)] font-semibold">{error || sharedError}</p>
        ) : (
          <p className="text-center py-8 text-[var(--text-muted)] font-semibold text-sm">
            No images yet. Upload one to get started!
          </p>
        )
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[280px] overflow-y-auto overflow-x-hidden rounded-xl p-1 pr-2" style={{ scrollbarGutter: "stable" }}>
          {browseItems.map((item) => (
            <button
              key={`${item.type}-${item.id}`}
              type="button"
              onClick={() => handleItemSelect(item)}
              disabled={disabled || !!submittingId}
              className="group relative aspect-square rounded-xl overflow-hidden border-2 border-transparent hover:border-[var(--purple)] transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: "var(--bg-card)",
                boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
              }}
            >
              <LazyImage
                src={item.type === "meme" ? item.url : item.feedbackImageUrl}
                alt={item.type === "meme" ? item.name : "Shared response"}
                className="w-full h-full"
              />
              {submittingId === item.id && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-white animate-spin" />
                </div>
              )}
              {item.type === "meme" && (
                <div
                  className="absolute inset-x-0 bottom-0 py-1 px-1.5 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ paddingTop: "40%" }}
                >
                  <span className="text-[10px] font-bold text-white line-clamp-2 leading-tight">
                    {item.name}
                  </span>
                </div>
              )}
            </button>
          ))}
        </div>
      ))}

      {tab === "recent" && (recent.length === 0 ? (
        <p className="text-center py-8 text-[var(--text-muted)] font-semibold text-sm">
          No recent picks yet. Pick one from Browse!
        </p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[280px] overflow-y-auto overflow-x-hidden rounded-xl p-1 pr-2 w-full min-w-0" style={{ scrollbarGutter: "stable" }}>
          {recent.map((meme) => (
            <button
              key={meme.id}
              type="button"
              onClick={() => handleMemeSelect(meme)}
              disabled={disabled || !!submittingId}
              className="group relative aspect-square rounded-xl overflow-hidden border-2 border-transparent hover:border-[var(--purple)] transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed min-w-0 w-full"
              style={{
                background: "var(--bg-card)",
                boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
              }}
            >
              <LazyImage
                src={meme.url}
                alt={meme.name}
                className="w-full h-full max-w-full max-h-full"
              />
              {submittingId === meme.id && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-white animate-spin" />
                </div>
              )}
              <div
                className="absolute inset-x-0 bottom-0 py-1 px-1.5 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ paddingTop: "40%" }}
              >
                <span className="text-[10px] font-bold text-white line-clamp-2 leading-tight">
                  {meme.name}
                </span>
              </div>
            </button>
          ))}
        </div>
      ))}

      <p className="text-[10px] text-[var(--text-muted)] mt-2 font-semibold">
        Tap an image to send as feedback · Shared responses + Explore in one place
      </p>
    </section>
  );
}
