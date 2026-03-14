"use client";

import { useEffect, useState, useRef } from "react";
import { ImageIcon, Loader2, Globe } from "lucide-react";
import { getFirestore, collection, getDocs, orderBy, query } from "firebase/firestore";
import { app } from "@/lib/firebase";
import { GoogleSearchModal } from "./GoogleSearchModal";

export interface SharedFeedback {
  id: string;
  feedbackImageUrl: string;
  createdAt: string;
}

export interface BrowseCategory {
  id: string;
  name: string;
  order?: number;
}

export interface BrowseImage {
  id: string;
  imageUrl: string;
  name?: string;
  source?: "admin" | "shared";
  categoryIds?: string[];
  createdAt?: string;
}

function LazyImage({
  src,
  alt,
  className = "",
  id,
  isVisible,
}: {
  src: string;
  alt: string;
  className?: string;
  id: string;
  isVisible: boolean;
}) {
  return (
    <div data-lazy-placeholder data-lazy-id={id} className={`w-full h-full overflow-hidden ${className}`}>
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
  const [categories, setCategories] = useState<BrowseCategory[]>([]);
  const [browseImages, setBrowseImages] = useState<BrowseImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [hasLoadedBrowse, setHasLoadedBrowse] = useState(false);
  const [visibleIds, setVisibleIds] = useState<Set<string>>(new Set());
  const [displayLimit, setDisplayLimit] = useState(24);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const hasTriggeredRef = useRef(false);
  const scrollRootRef = useRef<HTMLDivElement | null>(null);

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
        if (!app) throw new Error("Firebase not configured");
        const db = getFirestore(app);
        const [catSnap, imgSnap] = await Promise.all([
          getDocs(query(collection(db, "categories"), orderBy("order"))),
          getDocs(collection(db, "browseImages")),
        ]);
        if (mounted) {
          setCategories(catSnap.docs.map((d) => ({ id: d.id, ...d.data() } as BrowseCategory)));
          setBrowseImages(imgSnap.docs.map((d) => ({ id: d.id, ...d.data() } as BrowseImage)));
        }
      } catch (err) {
        console.error("ExploreImages: failed to load browse data", err);
        if (mounted) {
          setCategories([]);
          setBrowseImages([]);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    run();
    return () => { mounted = false; };
  }, [hasLoadedBrowse]);

  const filteredImages = selectedCategoryId
    ? browseImages.filter((img) => img.categoryIds?.includes(selectedCategoryId))
    : browseImages;

  const displayedImages = filteredImages.slice(0, displayLimit);

  useEffect(() => {
    const root = scrollRootRef.current;
    if (!root || displayedImages.length === 0) return;
    const placeholders = root.querySelectorAll<HTMLElement>("[data-lazy-placeholder]");
    const observer = new IntersectionObserver(
      (entries) => {
        setVisibleIds((prev) => {
          const next = new Set(prev);
          entries.forEach((entry) => {
            const id = (entry.target as HTMLElement).dataset.lazyId;
            if (id && entry.isIntersecting) next.add(id);
          });
          return next;
        });
      },
      { root, rootMargin: "120px", threshold: 0.01 }
    );
    placeholders.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [loading, selectedCategoryId, displayedImages.length]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop <= clientHeight + 100) {
      if (displayLimit < filteredImages.length) {
        setDisplayLimit((prev) => prev + 24);
      }
    }
  };

  const handleSelect = async (img: BrowseImage) => {
    if (disabled || submittingId || !onSubmitShared) return;
    setSubmittingId(img.id);
    try {
      await onSubmitShared({ id: img.id, feedbackImageUrl: img.imageUrl, createdAt: "" });
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <section ref={sectionRef} className="mt-8 w-full min-w-0">
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <ImageIcon className="w-5 h-5 text-[var(--purple)]" />
          <h3 className="font-black text-[var(--text-primary)]">Browse</h3>
        </div>
        <button
          type="button"
          onClick={() => setIsSearchOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-[var(--border)] hover:bg-[var(--purple)]/10 hover:border-[var(--purple)]/30 transition-all text-xs font-bold text-[var(--text-primary)] group"
        >
          <Globe className="w-3.5 h-3.5 text-[var(--purple)] group-hover:scale-110 transition-transform" />
          Search Global
        </button>
      </div>

      <GoogleSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelect={async (url) => {
          setIsSearchOpen(false);
          if (onSubmitShared) {
            await onSubmitShared({ id: "google-search-" + Date.now(), feedbackImageUrl: url, createdAt: "" });
          }
        }}
      />

      {!hasLoadedBrowse ? (
        <button
          type="button"
          onClick={() => setHasLoadedBrowse(true)}
          className="w-full py-12 border-2 border-dashed border-gray-700/50 rounded-xl text-[var(--text-muted)] hover:border-[var(--purple)]/50 transition-colors"
        >
          Tap to explore reactions
        </button>
      ) : loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-[var(--pink)]" /></div>
      ) : (
        <>
          {categories.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              <button
                type="button"
                onClick={() => { setSelectedCategoryId(null); setDisplayLimit(24); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  selectedCategoryId === null
                    ? "bg-[var(--purple)] text-white"
                    : "bg-white/5 text-[var(--text-muted)] hover:bg-white/10"
                }`}
              >
                All
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => { setSelectedCategoryId((prev) => (prev === c.id ? null : c.id)); setDisplayLimit(24); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    selectedCategoryId === c.id
                      ? "bg-[var(--purple)] text-white"
                      : "bg-white/5 text-[var(--text-muted)] hover:bg-white/10"
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}
          <div
            ref={scrollRootRef}
            onScroll={handleScroll}
            className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[400px] overflow-y-auto p-1 rounded-xl"
            style={{
              gridAutoRows: "minmax(100px, auto)",
              WebkitOverflowScrolling: "touch",
            }}
          >
            {displayedImages.length === 0 ? (
              <p className="col-span-full py-8 text-center text-[var(--text-muted)] text-sm">
                {browseImages.length === 0
                  ? "No images yet. Admin can add images from the admin panel."
                  : "No images in this category."}
              </p>
            ) : (
              displayedImages.map((img) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => handleSelect(img)}
                  disabled={disabled || !!submittingId}
                  className="relative w-full aspect-square overflow-hidden rounded-xl bg-[var(--bg-card)] border-2 border-transparent hover:border-[var(--purple)] transition-all active:scale-95 disabled:opacity-50"
                  style={{ isolation: "isolate" }}
                >
                  <LazyImage
                    src={img.imageUrl}
                    alt={img.name || "Browse"}
                    id={img.id}
                    isVisible={visibleIds.has(img.id)}
                  />
                  {submittingId === img.id && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <Loader2 className="w-6 h-6 text-white animate-spin" />
                    </div>
                  )}
                </button>
              ))
            )}
            {displayLimit < filteredImages.length && (
              <div className="col-span-full py-4 flex justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-[var(--text-muted)] opacity-50" />
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}