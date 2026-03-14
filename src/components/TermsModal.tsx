"use client";

import { useState } from "react";
import { Check, ShieldCheck, ScrollText, AlertTriangle, ChevronDown } from "lucide-react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";

interface TermsModalProps {
  isOpen: boolean;
  onAccept: () => void;
}

export function TermsModal({ isOpen, onAccept }: TermsModalProps) {
  const { user, refreshProfile } = useAuth();
  const toast = useToast();
  const [accepting, setAccepting] = useState(false);
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const [termsChecked, setTermsChecked] = useState(false);
  const [privacyChecked, setPrivacyChecked] = useState(false);

  if (!isOpen) return null;

  const handleAccept = async () => {
    if (!user || !db) return;
    setAccepting(true);
    try {
      const userRef = doc(db, "users", user.uid);
      const timestamp = new Date().toISOString();
      await updateDoc(userRef, {
        termsAccepted: true,
        termsAcceptedAt: timestamp,
        privacyAccepted: true,
        privacyAcceptedAt: timestamp,
      });

      // Save to localStorage as a fallback/quick check
      try {
        localStorage.setItem("picpop_legal_v1", "true");
        if (user?.uid) {
          localStorage.setItem(`picpop_terms_accepted_${user.uid}`, "true");
        }
      } catch (e) {
        console.warn("Failed to save terms acceptance to localStorage:", e);
      }

      await refreshProfile();
      onAccept();
      toast.success("Legal terms accepted. Welcome!");
    } catch (err) {
      console.error("Error accepting terms:", err);
      toast.error("Failed to save acceptance. Please try again.");
    } finally {
      setAccepting(false);
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const scrollPercent = (target.scrollTop / (target.scrollHeight - target.clientHeight)) * 100;
    const progressEl = document.getElementById("terms-progress");
    if (progressEl) progressEl.style.width = `${scrollPercent}%`;

    const isBottom = target.scrollHeight - target.scrollTop >= target.clientHeight - 80;
    if (isBottom) setScrolledToBottom(true);
  };

  return (
    <div 
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/80 animate-in fade-in duration-500"
      style={{ backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}
    >
      <div 
        className="w-full max-w-2xl max-h-[90vh] bg-[#12121c] rounded-[2.5rem] border border-white/10 shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-500 delay-150 relative transform translate-z-0"
      >
        {/* PROGRESS BAR */}
        <div className="absolute top-0 left-0 w-full h-1.5 bg-white/5 z-20">
          <div 
            id="terms-progress"
            className="h-full bg-gradient-to-r from-[var(--pink)] to-[var(--purple)] transition-all duration-200"
            style={{ width: "0%" }}
          />
        </div>

        {/* HEADER */}
        <div className="p-8 pb-6 border-b border-white/5 flex flex-col items-center text-center relative overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-40 bg-pink-500/10 blur-[60px] rounded-full -z-10" />
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#FF3D7F] to-[#A033FF] flex items-center justify-center mb-5 shadow-2xl shadow-pink-500/20 rotate-3 hover:rotate-0 transition-transform duration-500">
            <ShieldCheck className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-3xl font-black text-white mb-2 tracking-tight">Legal Agreements</h2>
          <p className="text-white/40 text-sm font-medium">Please review our updated Terms & Privacy Policy.</p>
        </div>

        {/* CONTENT */}
        <div 
          className="flex-1 overflow-y-auto p-8 custom-scrollbar text-white/70 leading-relaxed text-sm"
          onScroll={handleScroll}
        >
          <div className="space-y-8">
            <div className="p-5 rounded-[1.5rem] bg-orange-500/5 border border-orange-500/10 flex gap-4 text-orange-200/80 text-[13px] leading-relaxed">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-orange-400" />
              </div>
              <p>
                <strong className="text-orange-400 block mb-0.5">Safety & Privacy Notice</strong>
                By using PicPop, you acknowledge that you may receive anonymous images and that we process limited data to ensure platform safety.
              </p>
            </div>

            {/* SECTION 1: TERMS */}
            <div className="flex items-center gap-3 text-white font-black text-xl mb-4">
              <ScrollText className="w-6 h-6 text-pink-500" />
              <span>1. Terms of Service</span>
            </div>
            
            <p className="text-white/30 font-bold uppercase tracking-widest text-[10px]">Updated: March 2026</p>

            <div className="prose prose-invert prose-sm max-w-none space-y-8">
              <p className="text-base text-white/60">
                These Terms and Conditions (“Terms”) govern your access to and use of PicPop.me.
                By accessing or using PicPop, you agree to these Terms. If you do not agree, you must discontinue use of the Service.
              </p>

              <section className="space-y-4 pt-4 border-t border-white/5">
                <h3 className="text-white font-black text-lg flex items-center gap-2">
                  <span className="w-6 h-6 rounded-md bg-white/5 flex items-center justify-center text-[10px]">01</span>
                  Platform Overview
                </h3>
                <p>PicPop is a secure web platform for creating personal links, sharing images anonymously, and interacting with user-generated content. We reserve the right to modify or discontinue any feature at any time without prior notice.</p>
              </section>

              <section className="space-y-4">
                <h3 className="text-white font-black text-lg flex items-center gap-2">
                  <span className="w-6 h-6 rounded-md bg-white/5 flex items-center justify-center text-[10px]">02</span>
                  Eligibility
                </h3>
                <p>Usage is restricted to individuals aged 13 and older. Users in jurisdictions with higher age requirements must have explicit parental consent. By continuing, you represent that you meet these global standards.</p>
              </section>

              <section className="space-y-4 p-6 rounded-[2rem] bg-pink-500/5 border border-pink-500/10">
                <h3 className="text-pink-400 font-black text-lg flex items-center gap-2">
                  <span className="w-6 h-6 rounded-md bg-pink-500/10 flex items-center justify-center text-[10px]">03</span>
                  Anonymous Disclaimer
                </h3>
                <p className="text-pink-100/70">Our platform enables anonymous photo sharing. You voluntarily accept the risk of receiving content that may be unexpected, humorous, or critical. PicPop is not liable for emotional impact resulting from user-generated content.</p>
              </section>

              <section className="space-y-4 p-6 rounded-[2rem] bg-red-500/5 border border-red-500/10">
                <h3 className="text-red-400 font-black text-lg flex items-center gap-2">
                  <span className="w-6 h-6 rounded-md bg-red-500/10 flex items-center justify-center text-[10px]">05</span>
                  Zero Tolerance: Harassment
                </h3>
                <p className="text-red-100/70">Bullying, threatening, or abusive behavior is strictly prohibited. Accounts found violating these community standards will be permanently banned and reported to legal authorities if necessary.</p>
              </section>
            </div>

            {/* SECTION 2: PRIVACY */}
            <div className="pt-12 border-t border-white/10 flex items-center gap-3 text-white font-black text-xl mb-4">
              <ShieldCheck className="w-6 h-6 text-blue-400" />
              <span>2. Privacy Policy</span>
            </div>

            <div className="prose prose-invert prose-sm max-w-none space-y-8">
              <p className="text-base text-white/60">
                At PicPop, we prioritize your privacy while enabling social interaction. This policy outlines how we handle data.
              </p>

              <section className="space-y-4">
                <h4 className="text-white font-bold">A. Information We Collect</h4>
                <ul className="list-disc pl-5 space-y-2">
                  <li><strong>Account Data:</strong> We store your CoolId, display name, and authentication details via Firebase.</li>
                  <li><strong>Content:</strong> Images you upload for feedback are stored securely in our cloud storage.</li>
                  <li><strong>Logs:</strong> We collect anonymous device data, IP addresses (for DDoS protection), and user activity logs to improve service quality.</li>
                </ul>
              </section>

              <section className="space-y-4">
                <h4 className="text-white font-bold">B. How We Use Data</h4>
                <p>Your data is used solely to operate the platform, send notifications, prevent harassment, and analyze global usage trends via Google Analytics & Microsoft Clarity.</p>
              </section>

              <section className="space-y-4">
                <h4 className="text-white font-bold">C. Sharing & Disclosure</h4>
                <p>We do not sell your data. Information is shared with service providers (Firebase, Vercel) only as necessary to host the application. We may disclose data if required by legal mandates or to protect users from imminent harm.</p>
              </section>

              <section className="space-y-4 p-6 rounded-[2rem] bg-blue-500/5 border border-blue-500/10">
                <h4 className="text-blue-400 font-bold">D. Data Deletion</h4>
                <p className="text-blue-100/70">You can request account deletion at any time. Upon deletion, your profile data and uploaded images are permanently removed from our active production database.</p>
              </section>
            </div>

            <div className="mt-12 p-6 rounded-2xl bg-white/5 border border-white/10 text-xs text-white/30 text-center">
              <p>By clicking "AGREE AND ENTER", you confirm you have read and consent to both the <strong>Terms of Service</strong> and the <strong>Privacy Policy</strong> for PicPop.me.</p>
            </div>

            <div className="pb-12 h-4" />
          </div>
        </div>

        {/* FOOTER */}
        <div className="p-8 border-t border-white/5 bg-white/[0.02] flex flex-col gap-6">
          <div className="space-y-4">
            {/* Terms Checkbox */}
            <label className="flex items-start gap-3 cursor-pointer group">
              <div className="relative flex items-center justify-center mt-0.5">
                <input
                  type="checkbox"
                  checked={termsChecked}
                  onChange={(e) => setTermsChecked(e.target.checked)}
                  className="peer appearance-none w-5 h-5 rounded-md border border-white/10 bg-white/5 checked:bg-pink-500 checked:border-pink-500 transition-all cursor-pointer"
                />
                <Check className="absolute w-3.5 h-3.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" />
              </div>
              <span className="text-sm text-white/50 group-hover:text-white/80 transition-colors select-none">
                I have read and agree to the <strong className="text-pink-400">Terms of Service</strong>
              </span>
            </label>

            {/* Privacy Checkbox */}
            <label className="flex items-start gap-3 cursor-pointer group">
              <div className="relative flex items-center justify-center mt-0.5">
                <input
                  type="checkbox"
                  checked={privacyChecked}
                  onChange={(e) => setPrivacyChecked(e.target.checked)}
                  className="peer appearance-none w-5 h-5 rounded-md border border-white/10 bg-white/5 checked:bg-blue-500 checked:border-blue-500 transition-all cursor-pointer"
                />
                <Check className="absolute w-3.5 h-3.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" />
              </div>
              <span className="text-sm text-white/50 group-hover:text-white/80 transition-colors select-none">
                I consent to the <strong className="text-blue-400">Privacy Policy</strong> for data processing
              </span>
            </label>
          </div>

          <div className="flex flex-col items-center gap-4">
            {!scrolledToBottom && (
              <div className="flex items-center gap-2 mb-1 animate-bounce">
                <ChevronDown className="w-4 h-4 text-pink-500" />
                <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">Scroll to bottom to enable</p>
              </div>
            )}
            <button
              onClick={handleAccept}
              disabled={!scrolledToBottom || !termsChecked || !privacyChecked || accepting}
              className="group relative w-full overflow-hidden rounded-[1.5rem] p-5 transition-all duration-300 disabled:opacity-20 disabled:grayscale hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: "linear-gradient(135deg, #FF3D7F, #A033FF)",
                boxShadow: (scrolledToBottom && termsChecked && privacyChecked) ? "0 20px 40px -10px rgba(255, 61, 127, 0.4)" : "none",
              }}
            >
              <div className="relative z-10 flex items-center justify-center gap-3 font-black text-white tracking-[0.1em] text-sm">
                {accepting ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                ) : (
                  <>
                    <Check className="w-5 h-5 group-hover:scale-125 transition-transform" />
                    AGREE AND ENTER
                  </>
                )}
              </div>
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </div>
  );
}
