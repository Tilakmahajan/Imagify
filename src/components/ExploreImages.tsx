"use client";

import { useEffect, useState, useRef } from "react";
import { ImageIcon, Loader2 } from "lucide-react";
import { getAppFunctions } from "@/lib/functions";

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
    const root = scrollRoot ?? (el.closest("[data-scroll-root]") as HTMLElement | null) ?? null;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setIsVisible(true);
      },
      { root, rootMargin: root ? "100px" : "200px", threshold: 0.01 }
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
  const [categories, setCategories] = useState<BrowseCategory[]>([]);
  const [browseImages, setBrowseImages] = useState<BrowseImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
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
        const functions = getAppFunctions();
        if (!functions) throw new Error("Firebase not configured");
        const { httpsCallable } = await import("firebase/functions");
        const getBrowseData = httpsCallable<unknown, { categories: BrowseCategory[]; browseImages: BrowseImage[] }>(functions, "getBrowseData");
        const res = await getBrowseData({});
        if (mounted) {
          setCategories(res.data?.categories ?? []);
          setBrowseImages(res.data?.browseImages ?? []);
        }
      } catch {
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
        <>
          {categories.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              <button
                type="button"
                onClick={() => setSelectedCategoryId(null)}
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
                  onClick={() => setSelectedCategoryId((prev) => (prev === c.id ? null : c.id))}
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
            ref={(el) => setBrowseScrollRoot(el)}
            data-scroll-root
            className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[400px] overflow-y-auto p-1 rounded-xl"
            style={{
              gridAutoRows: "minmax(100px, auto)",
              WebkitOverflowScrolling: "touch",
            }}
          >
            {filteredImages.length === 0 ? (
              <p className="col-span-full py-8 text-center text-[var(--text-muted)] text-sm">
                {browseImages.length === 0
                  ? "No images yet. Admin can add images from the admin panel."
                  : "No images in this category."}
              </p>
            ) : (
              filteredImages.map((img) => (
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
                    scrollRoot={browseScrollRoot}
                  />
                  {submittingId === img.id && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <Loader2 className="w-6 h-6 text-white animate-spin" />
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        </>
      )}
    </section>
  );
}