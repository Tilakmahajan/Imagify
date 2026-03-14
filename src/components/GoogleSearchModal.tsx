"use client";

import { useState, useRef, useEffect } from "react";
import { Search, X, Loader2, Globe } from "lucide-react";
import { useToast } from "@/lib/toast-context";

interface GoogleImage {
  id: string;
  imageUrl: string;
  name: string;
  thumbnail?: string;
}

export function GoogleSearchModal({
  isOpen,
  onClose,
  onSelect,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (imageUrl: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GoogleImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [startIndex, setStartIndex] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSearch = async (newSearch = true) => {
    if (!query.trim()) return;
    setSearching(true);
    if (newSearch) {
      setResults([]);
      setStartIndex(1);
    }

    try {
      const res = await fetch("/api/search-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, start: newSearch ? 1 : startIndex }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Search failed");
      const items: GoogleImage[] = data.items || [];
      setResults(prev => newSearch ? items : [...prev, ...items]);
      setHasMore(items.length === 10);
      setStartIndex(prev => prev + 10);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Search failed. Make sure Google Search API keys are set.");
    } finally {
      setSearching(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="relative w-full max-w-2xl h-[80vh] flex flex-col rounded-3xl border border-[var(--border)] overflow-hidden"
        style={{ background: "var(--bg-card)" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-[var(--border)] flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-1 relative">
            <Search className="absolute left-3 w-5 h-5 text-[var(--text-muted)]" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSearch(true)}
              placeholder="Search for memes, stickers, anything..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--purple)] text-sm"
            />
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-white/10 text-[var(--text-muted)]"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {!searching && results.length === 0 && !query && (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-50">
              <Globe className="w-16 h-16 mb-4 text-[var(--purple)]" />
              <p className="font-bold">Search the whole world</p>
              <p className="text-sm">Find any reaction from Google Images</p>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {results.map((img, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onSelect(img.imageUrl)}
                className="group relative aspect-square rounded-2xl overflow-hidden bg-black/20 border-2 border-transparent hover:border-[var(--purple)] transition-all active:scale-95"
              >
                <img 
                  src={img.thumbnail || img.imageUrl} 
                  alt={img.name} 
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="text-xs font-bold text-white bg-[var(--purple)] px-2 py-1 rounded-full">Select</span>
                </div>
              </button>
            ))}
          </div>

          {searching && (
            <div className="py-12 flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-[var(--pink)]" />
              <p className="text-sm font-bold text-[var(--text-muted)]">Searching Google...</p>
            </div>
          )}

          {!searching && hasMore && (
            <button
              type="button"
              onClick={() => handleSearch(false)}
              className="w-full mt-6 py-3 rounded-xl border border-[var(--border)] font-bold text-sm hover:bg-white/5 transition-colors"
            >
              Load more
            </button>
          )}

          {!searching && results.length > 0 && results.length < 5 && (
            <p className="text-center mt-8 text-xs text-[var(--text-muted)]">
              Pro tip: Be specific in your search for better results!
            </p>
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 bg-white/5 border-t border-[var(--border)] text-[10px] text-center text-[var(--text-muted)] flex items-center justify-center gap-1.5 font-bold">
          <Globe className="w-3 h-3 text-[var(--purple)]" />
          POWRED BY GOOGLE IMAGE SEARCH
        </div>
      </div>
    </div>
  );
}
