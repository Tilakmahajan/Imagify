"use client";

import { useEffect, useState, useRef } from "react";
import { ImageIcon, Loader2 } from "lucide-react";
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
} from "firebase/firestore";
import { db, ensureFirestoreNetwork } from "@/lib/firebase";

export interface SharedFeedback {
  id: string;
  feedbackImageUrl: string;
  createdAt: string;
}

function LazyImage({
  src,
  alt,
  className = "",
  scrollRoot,
}: {
  src: string;
  alt: string;
  className?: string;
  scrollRoot?: HTMLElement | null;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = imgRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setIsVisible(true);
      },
      { root: scrollRoot ?? null, rootMargin: "200px", threshold: 0.01 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [scrollRoot]);

  return (
    <div ref={imgRef} className={`w-full h-full overflow-hidden ${className}`}>
      {isVisible ? (
        <img
          src={src}
          alt={alt}
          className="w-full h-full object-cover block"
          loading="lazy"
          decoding="async"
        />
      ) : (
        <div className="w-full h-full bg-[var(--bg-card)] animate-pulse" />
      )}
    </div>
  );
}

export function ExploreImages({
  onSubmitShared,
  disabled,
}: {
  onSubmitShared?: (item: SharedFeedback) => Promise<void>;
  disabled?: boolean;
}) {
  const [shared, setShared] = useState<SharedFeedback[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [hasLoadedBrowse, setHasLoadedBrowse] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const hasTriggeredRef = useRef(false);
  const [browseScrollRoot, setBrowseScrollRoot] = useState<HTMLElement | null>(null);

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
            if (seenUrls.has(url)) return false;
            seenUrls.add(url);
            return true;
          })
          .map((d) => ({
            id: d.id,
            feedbackImageUrl: d.data().feedbackImageUrl as string,
            createdAt: d.data().createdAt || new Date().toISOString(),
          }));
        if (mounted) setShared(items);
      } catch (err: any) {
        if (mounted) setError(err.message || "Failed to load");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    run();
    return () => { mounted = false; };
  }, [hasLoadedBrowse]);

  const handleSharedSelect = async (item: SharedFeedback) => {
    if (disabled || submittingId || !onSubmitShared) return;
    setSubmittingId(item.id);
    try {
      await onSubmitShared(item);
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <section ref={sectionRef} className="mt-8 w-full min-w-0">
      <div className="flex items-center gap-2 mb-4">
        <ImageIcon className="w-5 h-5 text-[var(--purple)]" />
        <h3 className="font-black text-[var(--text-primary)]">Browse</h3>
      </div>

      {!hasLoadedBrowse ? (
        <button
          type="button"
          onClick={() => setHasLoadedBrowse(true)}
          className="w-full py-12 border-2 border-dashed border-gray-700 rounded-xl text-[var(--text-muted)]"
        >
          Tap to load images
        </button>
      ) : loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>
      ) : (
        <div
          ref={(el) => setBrowseScrollRoot(el)}
          className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[400px] overflow-y-auto p-1 rounded-xl"
          style={{ 
            gridAutoRows: "minmax(100px, auto)", // UNIVERSAL FIX: Forces height calculation
            WebkitOverflowScrolling: "touch" 
          }}
        >
          {shared.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSharedSelect(item)}
              className="relative w-full aspect-square overflow-hidden rounded-xl bg-[var(--bg-card)] border-2 border-transparent hover:border-[var(--purple)] transition-all active:scale-95"
              style={{ isolation: "isolate" }}
            >
              <LazyImage
                src={item.feedbackImageUrl}
                alt="Shared"
                scrollRoot={browseScrollRoot}
              />
              {submittingId === item.id && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 text-white animate-spin" />
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}