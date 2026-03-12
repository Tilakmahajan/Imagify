"use client";

import { useEffect, useState, useRef, Suspense, useCallback } from "react";
import Link from "next/link";
import { Camera, X, Heart, Send, ChevronLeft, ImageIcon } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { doc, getDoc, addDoc, collection, query, where, orderBy, limit, onSnapshot } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, ensureFirestoreNetwork } from "@/lib/firebase";
import { getAppFunctions } from "@/lib/functions";
import { uploadFeedbackImage } from "@/lib/image-upload";
import { useToast } from "@/lib/toast-context";
import { useAuth } from "@/lib/auth-context";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AiImagePrompts, openProvider, type AiImageProvider } from "@/components/AiImagePrompts";
import { ExploreImages } from "@/components/ExploreImages";
import { getErrorMessage } from "@/lib/error-utils";

const SIGN_IN_NUDGE_INTERVAL_MS = 20_000;

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

interface RecentChat {
  coolId: string;
  userId: string;
  lastActive: string;
}

// Persist session ID in localStorage to avoid losing history on IP change
function getSessionId() {
  if (typeof window === "undefined") return null;
  let sid = localStorage.getItem("picpop_session_id");
  if (!sid) {
    sid = "ss_" + Math.random().toString(36).substring(2, 15) + "_" + Date.now().toString(36);
    localStorage.setItem("picpop_session_id", sid);
  }
  return sid;
}

function getRecentChats(): RecentChat[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("picpop_recent_chats");
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveRecentChat(coolId: string, userId: string) {
  if (typeof window === "undefined" || !coolId || !userId) return;
  const recent = getRecentChats();
  const filtered = recent.filter(c => c.coolId !== coolId);
  filtered.unshift({ coolId, userId, lastActive: new Date().toISOString() });
  localStorage.setItem("picpop_recent_chats", JSON.stringify(filtered.slice(0, 10)));
}

function UserFeedbackContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user: authUser, loading: authLoading } = useAuth();
  const [coolId, setCoolId] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showSignInNudge, setShowSignInNudge] = useState(false);
  const [pendingShare, setPendingShare] = useState<{ previewUrl: string; confirm: () => Promise<void> } | null>(null);

  // Chat state
  const [textMessage, setTextMessage] = useState("");
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [myChatAnonId, setMyChatAnonId] = useState<string | null>(null);
  const [showGuestSuccessModal, setShowGuestSuccessModal] = useState(false);
  const [chatMode, setChatMode] = useState(false);
  const [recentChats, setRecentChats] = useState<RecentChat[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  useEffect(() => {
    setRecentChats(getRecentChats());
  }, []);

  const handleDismissNudge = () => {
    localStorage.setItem("signInNudgeDismissedAt", Date.now().toString());
    setShowSignInNudge(false);
  };

  // Scroll to bottom whenever chatHistory updates
  useEffect(() => {
    if (chatMode) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatHistory, chatMode]);

  // Track visit
  useEffect(() => {
    if (!db || !userId || !coolId) return;
    if (authUser?.uid === userId) return;
    const firestore = db;
    const run = async () => {
      try {
        await ensureFirestoreNetwork();
        await addDoc(collection(firestore, "visits"), {
          recipientId: userId, coolId, type: "visit", createdAt: new Date().toISOString(),
        });
      } catch { /* ignore */ }
    };
    run();
  }, [userId, coolId, authUser?.uid]);

  // Sign-in nudge
  useEffect(() => {
    if (authLoading || authUser || !userId) return;
    const id = setInterval(() => {
      try {
        const dismissedAt = localStorage.getItem("signInNudgeDismissedAt");
        if (dismissedAt && Date.now() - parseInt(dismissedAt, 10) < 10 * 60 * 1000) return;
      } catch { }
      setShowSignInNudge(true);
    }, SIGN_IN_NUDGE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [authLoading, authUser, userId]);

  useEffect(() => {
    const fromPath = (pathname || "").replace(/^\/u\/?/, "").split("/")[0] || "";
    const fromQuery = searchParams.get("user") || "";
    const id = (fromPath || fromQuery).trim().toLowerCase();
    setCoolId(id);
  }, [pathname, searchParams]);

  useEffect(() => {
    if (coolId && userId) document.title = `Chat with @${coolId} — PicPop`;
    return () => { document.title = "PicPop — Anonymous Image-Based Feedback"; };
  }, [coolId, userId]);

  useEffect(() => {
    if (!db || !coolId) { setLoading(false); return; }
    const firestore = db;
    let mounted = true;
    const run = async () => {
      try {
        await ensureFirestoreNetwork();
        const snap = await getDoc(doc(firestore, "usernames", coolId));
        if (mounted && snap.exists()) setUserId((snap.data() as { uid: string }).uid);
        else setUserId(null);
      } catch { if (mounted) setUserId(null); }
      finally { if (mounted) setLoading(false); }
    };
    run();
    return () => { mounted = false; };
  }, [coolId]);

  // Load initial chat history from server (IP-based + Session-based), then set up real-time listener
  useEffect(() => {
    if (!userId) return;
    let unsub: (() => void) | null = null;
    let cancelled = false;

    const init = async () => {
      try {
        const fns = getAppFunctions();
        if (!fns || !db) return;
        const sessionId = getSessionId();
        const getHistory = httpsCallable<{ recipientId: string; sessionId: string | null }, { anonymousId: string; items: any[] }>(
          fns, "getAnonymousChatHistory"
        );
        const result = await getHistory({ recipientId: userId, sessionId });
        if (cancelled) return;

        const anonId = result.data.anonymousId;
        setMyChatAnonId(anonId);

        if (result.data.items.length > 0) {
          setChatHistory(result.data.items);
          if (authUser) setChatMode(true);
          saveRecentChat(coolId, userId);
        }

        const currentSessionId = getSessionId();

        // 1. Listen for standard visitor thread (IP-based)
        const qVisitorThread = query(
          collection(db, "feedbacks"),
          where("recipientId", "==", userId),
          where("visitorId", "==", anonId),
          limit(100)
        );
        
        // 2. Listen for session-specific targeted replies (for shared IPs)
        const qSessionThread = query(
          collection(db, "feedbacks"),
          where("recipientId", "==", userId),
          where("sessionId", "==", currentSessionId),
          limit(50)
        );

        const processSnap = (snap: any) => {
            const newItems = snap.docs
                .filter((d: any) => d.data().deleted !== true)
                .map((d: any) => ({ id: d.id, ...d.data() } as any));
            
            setChatHistory(prev => {
                const map = new Map(prev.map(i => [i.id, i]));
                let changed = false;
                for (const item of newItems) {
                    const existing = map.get(item.id);
                    if (!existing || JSON.stringify(existing) !== JSON.stringify(item)) {
                        map.set(item.id, item);
                        changed = true;
                    }
                }
                if (!changed) return prev;
                return Array.from(map.values()).sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
            });
            
            if (newItems.length > 0) {
                if (authUser) setChatMode(true);
                saveRecentChat(coolId, userId);
            }
        };

        let unSubs: (() => void)[] = [
          onSnapshot(qVisitorThread, processSnap),
          onSnapshot(qSessionThread, processSnap)
        ];

        if (authUser?.uid) {
          // 3. Listen for Messages sent BY ME to this specific owner
          const qSentToOwner = query(
            collection(db, "feedbacks"),
            where("recipientId", "==", userId),
            where("submitterId", "==", authUser.uid),
            limit(100)
          );
          unSubs.push(onSnapshot(qSentToOwner, processSnap));

          // 4. Listen for verified replies sent BY this owner TO ME
          const qRepliesFromOwner = query(
            collection(db, "feedbacks"),
            where("recipientId", "==", authUser.uid),
            where("submitterId", "==", userId),
            limit(100)
          );
          unSubs.push(onSnapshot(qRepliesFromOwner, processSnap));
        }

        unsub = () => {
          unSubs.forEach(u => u());
        };
      } catch (err) {
        // silently ignore — new user with no history is fine
      }
    };

    init();
    return () => { cancelled = true; unsub?.(); };
  }, [userId, coolId, authUser?.uid]);

  const sendTextMessage = useCallback(async (msg: string) => {
    if (!userId || !msg.trim()) return;
    const text = msg.trim();
    setTextMessage("");
    
    // OPTIMISTIC UPDATE: Add to UI immediately for speed feel
    const optimisticId = "opt_" + Math.random().toString(36).substring(2, 9);
    const optimisticMsg = {
      id: optimisticId,
      message: text,
      createdAt: new Date().toISOString(),
      anonymousId: myChatAnonId,
      isOwnerReply: false,
    };
    setChatHistory(prev => [...prev, optimisticMsg]);
    checkChatModeOrSuccess();

    try {
      const fns = getAppFunctions();
      if (!fns) throw new Error("Firebase not configured");
      const sessionId = getSessionId();
      const submitFeedback = httpsCallable<{ recipientId: string; message: string; sessionId: string | null }, { success: boolean; anonymousId?: string }>(
        fns, "submitFeedback"
      );
      const result = await submitFeedback({ recipientId: userId, message: text, sessionId });
      if (result.data.anonymousId && !myChatAnonId) setMyChatAnonId(result.data.anonymousId);
      saveRecentChat(coolId, userId);

      // Cleanup optimist after successful sync
      setTimeout(() => {
        setChatHistory(prev => prev.filter(m => m.id !== optimisticId));
      }, 4000);
    } catch (err: unknown) {
      // Rollback optimistic update on error
      setChatHistory(prev => prev.filter(m => m.id !== optimisticId));
      setTextMessage(text); // Restore text
      toast.error(getErrorMessage(err));
    }
  }, [userId, myChatAnonId, toast, coolId]);

  const doFileUpload = async (file: File) => {
    if (!userId || !db) return;
    setSubmitting(true);
    try {
      await ensureFirestoreNetwork();
      const feedbackId = crypto.randomUUID();
      
      let optimisticId = "";
      if (authUser) {
        optimisticId = "opt_" + Math.random().toString(36).substring(2, 9);
        const urlToUse = file ? URL.createObjectURL(file) : "";
        setChatHistory(prev => [...prev, {
          id: optimisticId,
          feedbackImageUrl: urlToUse,
          createdAt: new Date().toISOString(),
          anonymousId: myChatAnonId,
          isOwnerReply: false,
          submitterId: authUser.uid
        }]);
      }

      const url = await uploadFeedbackImage(file, feedbackId);
      const fns = getAppFunctions();
      if (!fns) throw new Error("Firebase not configured");
      const sessionId = getSessionId();
      const submitFeedback = httpsCallable<{ recipientId: string; feedbackImageUrl: string; sessionId: string | null }, { success: boolean; anonymousId?: string }>(
        fns, "submitFeedback"
      );
      const result = await submitFeedback({ recipientId: userId, feedbackImageUrl: url, sessionId });
      
      if (authUser && optimisticId) {
        setTimeout(() => setChatHistory(prev => prev.filter(m => m.id !== optimisticId)), 4000);
      }
      if (result.data.anonymousId && !myChatAnonId) setMyChatAnonId(result.data.anonymousId);
      saveRecentChat(coolId, userId);
      checkChatModeOrSuccess();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const checkChatModeOrSuccess = () => {
    if (!chatMode) {
      setShowGuestSuccessModal(true);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !userId || !db) return;
    if (!file.type.startsWith("image/")) { toast.error("Please select an image."); return; }
    const previewUrl = URL.createObjectURL(file);
    setPendingShare({
      previewUrl,
      confirm: async () => { URL.revokeObjectURL(previewUrl); setPendingShare(null); await doFileUpload(file); },
    });
  };

  const handleSharedSelect = async (item: { id: string; feedbackImageUrl: string }) => {
    if (!userId || !db) return;
    setSubmitting(true);
    try {
      await ensureFirestoreNetwork();

      let optimisticId = "";
      if (authUser) {
        optimisticId = "opt_" + Math.random().toString(36).substring(2, 9);
        setChatHistory(prev => [...prev, {
          id: optimisticId,
          feedbackImageUrl: item.feedbackImageUrl,
          createdAt: new Date().toISOString(),
          anonymousId: myChatAnonId,
          isOwnerReply: false,
          submitterId: authUser.uid
        }]);
      }

      const fns = getAppFunctions();
      if (!fns) throw new Error("Firebase not configured");
      const sessionId = getSessionId();
      const submit = httpsCallable<{ recipientId: string; feedbackImageUrl: string; sessionId: string | null }, { success: boolean; anonymousId?: string }>(fns, "submitFeedback");
      const result = await submit({ recipientId: userId, feedbackImageUrl: item.feedbackImageUrl, sessionId });
      
      if (authUser && optimisticId) {
        setTimeout(() => setChatHistory(prev => prev.filter(m => m.id !== optimisticId)), 4000);
      }
      if (result.data.anonymousId && !myChatAnonId) setMyChatAnonId(result.data.anonymousId);
      saveRecentChat(coolId, userId);
      checkChatModeOrSuccess();
    } catch (err: unknown) {
      const m = err && typeof err === "object" && "message" in err ? String((err as Error).message) : "Failed to send.";
      toast.error(m);
    } finally { setSubmitting(false); }
  };

  const handleMemeSelect = async (meme: { id: string; url: string }) => {
    if (!userId || !db) return;
    setSubmitting(true);
    try {
      await ensureFirestoreNetwork();

      let optimisticId = "";
      if (authUser) {
        optimisticId = "opt_" + Math.random().toString(36).substring(2, 9);
        setChatHistory(prev => [...prev, {
          id: optimisticId,
          feedbackImageUrl: meme.url,
          createdAt: new Date().toISOString(),
          anonymousId: myChatAnonId,
          isOwnerReply: false,
          submitterId: authUser.uid
        }]);
      }

      const fns = getAppFunctions();
      if (!fns) throw new Error("Firebase not configured");
      const sessionId = getSessionId();
      const submit = httpsCallable<{ imageUrl: string; recipientId: string; sessionId: string | null }, { success: boolean; anonymousId?: string }>(fns, "submitFeedbackFromImgflip");
      const result = await submit({ imageUrl: meme.url, recipientId: userId, sessionId });
      
      if (authUser && optimisticId) {
        setTimeout(() => setChatHistory(prev => prev.filter(m => m.id !== optimisticId)), 4000);
      }
      if (result.data.anonymousId && !myChatAnonId) setMyChatAnonId(result.data.anonymousId);
      saveRecentChat(coolId, userId);
      checkChatModeOrSuccess();
    } catch (err: unknown) {
      const m = err && typeof err === "object" && "message" in err ? String((err as Error).message) : "Failed to send.";
      toast.error(m);
    } finally { setSubmitting(false); }
  };

  const showShareConfirm = (previewUrl: string, confirm: () => Promise<void>) => setPendingShare({ previewUrl, confirm });
  const handleSharedSelectWithConfirm = async (item: { id: string; feedbackImageUrl: string }) => {
    showShareConfirm(item.feedbackImageUrl, () => { setPendingShare(null); return handleSharedSelect(item); });
  };

  const openAiImageWithPrompt = (prompt: string, provider: AiImageProvider) => {
    navigator.clipboard.writeText(prompt).then(() => {
      toast.success(`Copied! Opening ${provider === "chatgpt" ? "ChatGPT" : "Gemini"}...`);
    });
    const isMobile = typeof window !== "undefined" && (window.innerWidth < 768 || /Android|iPhone|iPad|iPod|webOS/i.test(navigator.userAgent));
    openProvider(prompt, provider, isMobile);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: "var(--pink)", borderRightColor: "var(--purple)" }} />
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col items-center justify-center px-4">
        <p className="text-[var(--text-muted)] font-semibold text-center">User @{coolId || "?"} not found.</p>
        <Link href="/" className="mt-4 text-[var(--pink)] hover:underline font-bold">Back to home</Link>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // CHAT MODE: Full-screen WhatsApp/Instagram-style dual channel chat
  // ─────────────────────────────────────────────────────────────────
  if (chatMode) {
    return (
      <div className="flex flex-col h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]" style={{ fontFamily: "'Nunito', sans-serif" }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');
          .chat-scroll::-webkit-scrollbar { width: 4px; }
          .chat-scroll::-webkit-scrollbar-track { background: transparent; }
          .chat-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 4px; }
          @keyframes msg-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
          .msg-in { animation: msg-in 0.2s ease-out; }
        `}</style>

        {/* Header */}
        <div className="flex h-14 items-center justify-between px-4 border-b border-[var(--border)] bg-[#101010]/80 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setChatMode(false)}
              className="p-2 -ml-2 rounded-lg hover:bg-white/5 text-[var(--text-primary)]">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div>
              <p className="text-sm font-black text-white">Chat with @{coolId}</p>
              <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest flex items-center gap-1.5">
                {authUser ? (
                  <span className="text-blue-400">Verified · My ID: {authUser.uid.slice(0, 8)}...</span>
                ) : (
                  <span className="flex items-center gap-1 font-black text-[var(--pink)]">GUEST MODE</span>
                )}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end mr-1 hidden sm:flex">
              <span className="text-[10px] font-black text-[var(--green)]">LIVE</span>
              <span className="text-[8px] font-bold text-[var(--text-muted)]">Encrypted</span>
            </div>
            <ThemeToggle />
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto chat-scroll px-4 py-4 flex flex-col gap-3">
          {chatHistory.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: "rgba(255,61,127,0.15)" }}>
                <Heart className="w-8 h-8 text-[var(--pink)]" />
              </div>
              <p className="font-bold text-[var(--text-muted)]">Start the conversation</p>
              <p className="text-sm text-[var(--text-muted)] mt-1">Send a message or image below</p>
            </div>
          )}
          {chatHistory
            .filter(item => {
               // Client-side security filter
               if (item.targetUid && item.targetUid !== authUser?.uid && item.submitterId !== authUser?.uid) return false;
               return true;
            })
            .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
            .map((msg, idx) => {
            const isOwner = msg.isOwnerReply;
            const isMe = msg.submitterId === authUser?.uid || (authUser?.uid !== userId && !msg.isOwnerReply && !msg.submitterId); 
            return (
              <div key={msg.id || idx} className={`flex flex-col gap-0.5 msg-in ${isMe ? "items-end" : "items-start"}`}>
                <div className={`flex items-end gap-2 max-w-[78%] ${isMe ? "flex-row-reverse" : ""}`}>
                  {/* Avatar */}
                  <div className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-[10px] font-black text-white ${isMe
                    ? "bg-gradient-to-br from-pink-500 to-purple-600"
                    : "bg-gradient-to-br from-blue-500 to-purple-500"
                  }`}>
                    {isMe 
                      ? "You"
                      : (msg.isOwnerReply ? coolId[0]?.toUpperCase() : (msg.submitterId ? "V" : "U"))}
                  </div>
                  {/* Bubble */}
                  <div className={`rounded-2xl px-4 py-2.5 ${isMe
                    ? "rounded-br-sm text-white"
                    : "rounded-bl-sm border border-[var(--border)]"
                  }`}
                    style={isMe ? { background: "linear-gradient(135deg, var(--pink), var(--purple))" } : { background: "var(--bg-card)" }}>
                    {msg.feedbackImageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={msg.feedbackImageUrl} alt="image" className="rounded-xl max-w-[240px] w-full object-contain mb-1" />
                    )}
                    {msg.message && (
                      <div className="flex flex-col gap-0.5">
                        {isMe && msg.submitterId && (
                           <span className="text-[7px] font-black text-white/60 uppercase tracking-tighter">Verified</span>
                        )}
                        <p className="text-sm font-semibold whitespace-pre-wrap leading-relaxed">{msg.message}</p>
                      </div>
                    )}
                  </div>
                </div>
                <span className={`text-[10px] text-[var(--text-muted)] ${isMe ? "mr-9" : "ml-9"}`}>
                  {formatTime(msg.createdAt)}
                </span>
              </div>
            );
          })}
          <div ref={chatEndRef} />
        </div>

        {/* Image preview confirm overlay */}
        {pendingShare && (
          <div className="absolute inset-0 z-50 bg-black/70 flex items-center justify-center p-6">
            <div className="rounded-2xl p-5 w-full max-w-sm flex flex-col gap-4" style={{ background: "var(--bg-card)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={pendingShare.previewUrl} alt="Preview" className="w-full rounded-xl max-h-64 object-contain" />
              <div className="flex gap-3">
                <button type="button" onClick={() => { URL.revokeObjectURL(pendingShare.previewUrl); setPendingShare(null); }}
                  className="flex-1 py-3 rounded-xl font-bold border border-[var(--border)] text-[var(--text-muted)]">Cancel</button>
                <button type="button" onClick={pendingShare.confirm} disabled={submitting}
                  className="flex-1 py-3 rounded-xl font-bold text-white"
                  style={{ background: "linear-gradient(135deg, var(--pink), var(--purple))" }}>
                  {submitting ? "Sending..." : "Send"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Upload loader */}
        {submitting && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/50">
            <div className="w-10 h-10 rounded-full animate-spin" style={{ border: "4px solid transparent", borderTopColor: "var(--pink)", borderRightColor: "var(--purple)" }} />
          </div>
        )}

        {/* Input Bar */}
        <div className="shrink-0 border-t border-[var(--border)] px-3 py-3" style={{ background: "var(--bg-card)" }}>
          <div className="flex items-end gap-2 max-w-2xl mx-auto">
            {/* Camera button */}
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={submitting}
              className="p-2.5 rounded-full shrink-0 text-[var(--text-muted)] hover:text-[var(--pink)] hover:bg-white/5 transition-colors">
              <Camera className="w-5 h-5" />
            </button>

            {/* Text input - ONLY for logged in users */}
            {authUser ? (
              <>
                <textarea
                  value={textMessage}
                  onChange={(e) => setTextMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendTextMessage(textMessage); }
                  }}
                  placeholder="Type a message..."
                  rows={1}
                  className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:border-[var(--pink)] transition-colors"
                  style={{ maxHeight: "120px", minHeight: "42px" }}
                />
                <button type="button"
                  onClick={() => sendTextMessage(textMessage)}
                  disabled={!textMessage.trim() || submitting}
                  className="p-2.5 rounded-full shrink-0 text-white disabled:opacity-40 transition-all hover:scale-105"
                  style={{ background: "linear-gradient(135deg, var(--pink), var(--purple))" }}>
                  <Send className="w-4 h-4" />
                </button>
              </>
            ) : (
              <div className="flex-1 flex items-center">
                 <Link href="/login" className="flex-1 py-2.5 px-4 rounded-xl font-bold text-center text-[10px] bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-[var(--text-muted)] uppercase tracking-widest">
                   Sign in to start chatting & see replies
                 </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // LANDING MODE: First-time visitor experience
  // ─────────────────────────────────────────────────────────────────
  const RESPONSE_PREVIEWS = [
    { src: "/images/response.png", bg: "linear-gradient(135deg,#FF3D7F,#7C3AFF)" },
    { src: "/images/response1.png", bg: "linear-gradient(135deg,#7C3AFF,#00C8FF)" },
    { src: "/images/response2.png", bg: "linear-gradient(135deg,#00C8FF,#FF3D7F)" },
    { src: "/images/response3.jpg", bg: "linear-gradient(135deg,#FF3D7F,#FFE500)" },
    { src: "/images/response4.jpg", bg: "linear-gradient(135deg,#00C8FF,#7C3AFF)" },
    { src: "/images/response5.png", bg: "linear-gradient(135deg,#00FF94,#00C8FF)" },
    { src: "/images/response6.png", bg: "linear-gradient(135deg,#7C3AFF,#FFE500)" },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] overflow-x-hidden" style={{ fontFamily: "'Nunito', var(--font-nunito), sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');
        :root { --pink: #FF3D7F; --purple: #7C3AFF; --blue: #00C8FF; --green: #00FF94; --yellow: #FFE500; }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes pulse-glow { 0%,100%{box-shadow:0 0 40px rgba(255,61,127,0.25)} 50%{box-shadow:0 0 60px rgba(255,61,127,0.45)} }
        .float { animation: float 4s ease-in-out infinite; }
        .pulse-glow { animation: pulse-glow 2.5s ease-in-out infinite; }
        .preview-scroll::-webkit-scrollbar { display: none; }
        .preview-scroll { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-0 w-[500px] h-[500px] rounded-full blur-[120px] opacity-[0.15]" style={{ background: "var(--purple)" }} />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full blur-[100px] opacity-[0.12]" style={{ background: "var(--pink)" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full blur-[80px] opacity-[0.08]" style={{ background: "var(--blue)" }} />
      </div>

      <header className="relative navbar-glass border-b border-[var(--border)]">
        <nav className="flex h-14 items-center justify-between px-4 max-w-2xl mx-auto">
          <Link href="/" className="flex items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="picpop" className="h-6 sm:h-7 w-auto hover:scale-105 transition-transform duration-300" />
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {authUser ? (
              <Link href="/dashboard" className="text-sm font-bold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">Dashboard</Link>
            ) : (
              <Link href="/login" className="text-sm font-bold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">Sign in</Link>
            )}
          </div>
        </nav>
      </header>

      <main className="relative max-w-xl mx-auto px-4 py-8 sm:py-12 pb-16">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold mb-4" style={{ background: "rgba(255,61,127,0.15)", border: "1px solid rgba(255,61,127,0.3)" }}>
            <Heart className="w-4 h-4 text-[var(--pink)]" /> 100% anonymous · no sign-up
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-[var(--text-primary)] leading-tight">
            <span className="text-[var(--pink)]">@{coolId}</span> is waiting for your feedback
          </h1>
          <p className="text-base text-[var(--text-muted)] mt-3 font-semibold max-w-sm mx-auto">
            Send one honest reaction — screenshot, selfie, meme, anything. They&apos;ll love it.
          </p>
        </div>

        {/* Response preview scrollbar */}
        <div className="mb-8">
          <p className="text-xs font-black uppercase tracking-wider text-[var(--text-muted)] mb-3 text-center">✨ Ideas: reactions like these</p>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 preview-scroll">
            {RESPONSE_PREVIEWS.map((r, i) => (
              <div key={i} className="flex-shrink-0 group cursor-default">
                <div className="p-[2px] rounded-xl transition-transform duration-300 group-hover:scale-105" style={{ background: r.bg, boxShadow: "0 4px 20px rgba(0,0,0,0.2)" }}>
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden bg-black">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={r.src} alt="reaction idea" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Chats Section */}
        {recentChats.length > 0 && (
          <div className="mb-10 max-w-[400px] mx-auto">
            <p className="text-[10px] font-black tracking-[0.2em] uppercase text-[var(--text-muted)] mb-5 text-center">Your Recent Chats</p>
            <div className="flex flex-wrap justify-center gap-4">
              {recentChats.map((chat) => (
                <Link
                  key={chat.coolId}
                  href={`/u/${chat.coolId}`}
                  className="group flex flex-col items-center gap-2"
                >
                  <div className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center transition-all group-hover:scale-110 group-hover:border-[var(--pink)] group-pulse-glow group-hover:bg-[var(--pink)]/10 shadow-lg">
                    <span className="text-lg font-black text-[var(--pink)] group-hover:text-white">
                      {chat.coolId.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-[var(--text-muted)] group-hover:text-white transition-colors">
                    @{chat.coolId}
                  </span>
                </Link>
              ))}
            </div>
            <div className="h-px w-20 bg-white/10 mx-auto mt-8" />
          </div>
        )}

        {/* Sign-in nudge modal */}
        {showSignInNudge && !authUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={handleDismissNudge}>
            <div className="rounded-2xl p-6 w-full max-w-sm flex flex-col gap-4" style={{ background: "var(--bg-card)" }} onClick={(e) => e.stopPropagation()}>
              <button type="button" onClick={handleDismissNudge} className="absolute top-3 right-3 p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-white/10"><X className="w-4 h-4" /></button>
              <p className="font-black text-lg">Get notified of replies!</p>
              <p className="text-sm text-[var(--text-muted)]">Sign in to see when @{coolId} replies to you.</p>
              <Link href="/login" className="w-full py-3 rounded-xl font-bold text-white text-center block" style={{ background: "linear-gradient(135deg, var(--pink), var(--purple))" }}>Sign in</Link>
            </div>
          </div>
        )}

        {/* Image preview confirm */}
        {pendingShare && (
          <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
            <div className="rounded-2xl p-6 w-full max-w-sm flex flex-col gap-5" style={{ background: "var(--bg-card)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={pendingShare.previewUrl} alt="preview" className="w-full rounded-xl max-h-60 object-contain" />
              <p className="font-bold text-center">Send this to @{coolId}?</p>
              <div className="flex gap-3">
                <button type="button" onClick={() => { URL.revokeObjectURL(pendingShare.previewUrl); setPendingShare(null); }}
                  className="flex-1 py-3 rounded-xl font-bold border border-[var(--border)]">Cancel</button>
                <button type="button" onClick={pendingShare.confirm} disabled={submitting}
                  className="flex-1 py-3 rounded-xl font-bold text-white" style={{ background: "linear-gradient(135deg, var(--pink), var(--purple))", boxShadow: "0 4px 20px rgba(255,61,127,0.3)" }}>
                  {submitting ? "Sending..." : "Yes, send"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Upload loader */}
        {submitting && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60">
            <div className="flex flex-col items-center gap-4">
              <div className="w-14 h-14 rounded-full animate-spin" style={{ border: "4px solid transparent", borderTopColor: "var(--pink)", borderRightColor: "var(--purple)" }} />
              <p className="font-bold text-white">Uploading...</p>
            </div>
          </div>
        )}

        {/* Upload zone */}
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
        <div className="p-[3px] rounded-3xl transition-all duration-300 hover:scale-[1.02] pulse-glow"
          style={{ background: "linear-gradient(135deg, var(--pink) 0%, var(--purple) 50%, var(--blue) 100%)", boxShadow: "0 12px 48px rgba(255,61,127,0.35), 0 0 0 1px rgba(255,255,255,0.1)" }}>
          <button type="button" onClick={() => fileInputRef.current?.click()} disabled={submitting}
            className="w-full rounded-[22px] p-12 sm:p-16 flex flex-col items-center justify-center gap-5 disabled:opacity-50 transition-all relative overflow-hidden"
            style={{ background: "var(--bg-card)", touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}>
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl flex items-center justify-center float"
              style={{ background: "linear-gradient(135deg, rgba(255,61,127,0.2), rgba(124,58,255,0.2))", border: "3px dashed rgba(255,61,127,0.5)", boxShadow: "inset 0 0 30px rgba(255,61,127,0.1)" }}>
              <Camera className="w-12 h-12 sm:w-14 sm:h-14 text-[var(--pink)]" />
            </div>
            <div className="text-center">
              <span className="font-black text-[var(--text-primary)] block text-xl sm:text-2xl">{submitting ? "Sending..." : "Tap to send image"}</span>
              <span className="text-sm text-[var(--text-muted)] font-semibold mt-2 block">Pick any image — takes 2 seconds</span>
            </div>

            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs font-bold text-[var(--green)]">✓ No sign-up</span>
              <span className="text-[var(--text-muted)]">·</span>
              <span className="text-xs font-bold text-[var(--green)]">✓ 100% anonymous</span>
            </div>
          </button>
        </div>

        {/* Text message form */}
        <div className="mt-6 mb-8">
          <div className="p-[2px] rounded-3xl" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.02))" }}>
            <form onSubmit={(e) => { e.preventDefault(); sendTextMessage(textMessage); }}
              className="rounded-[22px] p-5 flex gap-3 items-end" style={{ background: "var(--bg-card)" }}>
              <textarea
                className="flex-1 bg-black/20 text-white rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-[var(--pink)] placeholder:text-white/30 resize-none text-sm"
                style={{ minHeight: "80px" }}
                placeholder="Or type an anonymous message..."
                value={textMessage}
                onChange={(e) => setTextMessage(e.target.value)}
                disabled={submitting}
              />
              <button type="submit" disabled={submitting || !textMessage.trim()}
                className="p-3 rounded-2xl text-white disabled:opacity-40 shrink-0"
                style={{ background: "linear-gradient(135deg, var(--green), var(--blue))" }}>
                <Send className="w-5 h-5" />
              </button>
            </form>
          </div>
        </div>

        <ExploreImages onSubmitShared={handleSharedSelectWithConfirm} disabled={submitting} />
        <AiImagePrompts onPromptClick={openAiImageWithPrompt} onPromptCopy={() => toast.success("Copied! Choose a provider to generate.")} />

        <p className="mt-8 text-center text-sm text-[var(--text-muted)] font-semibold flex items-center justify-center gap-2">
          <ImageIcon className="w-4 h-4 text-[var(--pink)]" /> Send one. @{coolId} will appreciate it.
        </p>

        {/* Guest Success Modal */}
        {showGuestSuccessModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-300">
            <div className="bg-[#151515] rounded-3xl p-8 w-full max-w-sm flex flex-col items-center text-center shadow-2xl relative overflow-hidden" 
                 style={{ border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 25px 50px -12px rgba(255, 61, 127, 0.25)" }}>
              {/* Background glow */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--pink)]/20 rounded-full blur-3xl" />
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-[var(--purple)]/20 rounded-full blur-3xl" />

              <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6 z-10" 
                   style={{ background: "linear-gradient(135deg, rgba(0,255,148,0.2) 0%, rgba(0,200,255,0.2) 100%)", border: "2px solid rgba(0,255,148,0.3)" }}>
                <Heart className="w-10 h-10 text-[var(--green)] animate-pulse" />
              </div>

              <h3 className="text-2xl font-black text-white mb-2 z-10">Sent Successfully!</h3>
              <p className="text-[var(--text-muted)] text-sm mb-8 z-10 leading-relaxed font-medium">
                Your anonymous feedback was delivered to <strong className="text-white">@{coolId}</strong>. 
                <br/><br/>
                Want to see if they reply or start a real-time text chat with them?
              </p>

              <div className="flex flex-col w-full gap-3 z-10">
                {!authUser ? (
                  <>
                    <Link 
                      href="/login" 
                      className="w-full py-3.5 rounded-xl font-black text-white transition-all hover:scale-[1.02] shadow-lg flex items-center justify-center gap-2"
                      style={{ background: "linear-gradient(135deg, var(--pink), var(--purple))" }}
                    >
                      Create Free Account
                    </Link>
                    
                    <button 
                      onClick={() => setShowGuestSuccessModal(false)}
                      className="w-full py-3.5 rounded-xl font-bold text-[var(--text-muted)] hover:text-white transition-colors hover:bg-white/5 border border-transparent hover:border-white/10"
                    >
                      Done
                    </button>
                  </>
                ) : (
                  <>
                    <Link 
                      href="/inbox?tab=sent" 
                      className="w-full py-3.5 rounded-xl font-black text-white transition-all hover:scale-[1.02] shadow-lg flex items-center justify-center gap-2"
                      style={{ background: "linear-gradient(135deg, var(--green), var(--blue))" }}
                    >
                      View in Chats
                    </Link>
                    
                    <button 
                      onClick={() => setShowGuestSuccessModal(false)}
                      className="w-full py-3.5 rounded-xl font-bold text-[var(--text-muted)] hover:text-white transition-colors hover:bg-white/5 border border-transparent hover:border-white/10"
                    >
                      Send Another
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function UserFeedbackClient() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: "var(--pink)" }} />
      </div>
    }>
      <UserFeedbackContent />
    </Suspense>
  );
}
