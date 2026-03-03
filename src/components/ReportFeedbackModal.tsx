"use client";

import { useState, useRef } from "react";
import { Flag, X, Shield } from "lucide-react";

const REPORT_REASONS = [
  "Inappropriate content",
  "Spam",
  "Harassment or hate",
  "Violence or threats",
  "Copyright violation",
  "Other",
] as const;

type ReportAction = "report" | "block";

interface ReportFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  feedbackId: string;
  onReportSuccess?: (action?: ReportAction) => void;
  onReportError?: (msg: string) => void;
}

export function ReportFeedbackModal({
  isOpen,
  onClose,
  feedbackId,
  onReportSuccess,
  onReportError,
}: ReportFeedbackModalProps) {
  const [reason, setReason] = useState<string>("");
  const [otherReason, setOtherReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [selectedAction, setSelectedAction] = useState<ReportAction | null>(null);
  const lastActionRef = useRef<number>(0);

  const fireAction = (action: ReportAction) => {
    const now = Date.now();
    if (now - lastActionRef.current < 400) return;
    lastActionRef.current = now;
    handleAction(action);
  };

  const handleAction = async (action: ReportAction) => {
    if (action === "report" || action === "block") {
      if (!reason.trim()) {
        onReportError?.("Please select a reason.");
        return;
      }
      if (reason === "Other" && !otherReason.trim()) {
        onReportError?.("Please describe the reason.");
        return;
      }
    }

    setSubmitting(true);
    setSelectedAction(action);
    try {
      const { httpsCallable } = await import("firebase/functions");
      const { getAppFunctions } = await import("@/lib/functions");
      const functions = getAppFunctions();
      if (!functions) throw new Error("Firebase not configured");
      const reportFeedback = httpsCallable<
        { feedbackId: string; reason?: string; otherReason?: string; action: ReportAction },
        { success: boolean; error?: string }
      >(functions, "reportFeedback");

      const res = await reportFeedback({
        feedbackId,
        reason,
        otherReason: reason === "Other" ? otherReason.trim() : undefined,
        action,
      });

      const data = res.data;
      if (data?.error) throw new Error(data.error);
      onReportSuccess?.(action);
      onClose();
      setReason("");
      setOtherReason("");
      setSelectedAction(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Action failed. Try again.";
      onReportError?.(msg);
      setSelectedAction(null);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) {
      setReason("");
      setOtherReason("");
      setSelectedAction(null);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-overlay backdrop-blur-sm"
      onClick={handleClose}
      style={{ touchAction: "none" }}
    >
      <div
        className="rounded-2xl p-6 max-w-md w-full border border-white/10 max-h-[90vh] overflow-y-auto"
        style={{
          background: "var(--bg-card)",
          boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
          WebkitOverflowScrolling: "touch",
        }}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-black text-[var(--text-primary)] flex items-center gap-2">
            <Flag className="w-5 h-5 text-[var(--pink)]" /> Report & actions
          </h3>
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors disabled:opacity-50"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-[var(--text-muted)] mb-4">
          Choose an action. Report submits a record. Block user blocks the submitter&apos;s IP. Delete hides the feedback.
        </p>

        {/* Reason selector (for Report & Block) - touch-action for iOS Safari */}
        <div className="mb-4">
          <p className="text-xs font-bold text-[var(--text-muted)] mb-2">Reason (for Report & Block)</p>
          <div className="space-y-1.5 max-h-36 overflow-y-auto" style={{ WebkitOverflowScrolling: "touch" }}>
            {REPORT_REASONS.map((r) => (
              <label
                key={r}
                className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors hover:bg-white/5 min-h-[44px]"
                style={{
                  background: reason === r ? "rgba(255,61,127,0.15)" : "rgba(255,255,255,0.03)",
                  border: reason === r ? "1px solid rgba(255,61,127,0.4)" : "1px solid transparent",
                  touchAction: "manipulation",
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                <input
                  type="radio"
                  name="reason"
                  value={r}
                  checked={reason === r}
                  onChange={() => setReason(r)}
                  className="sr-only"
                  style={{ touchAction: "manipulation" }}
                />
                <span className="text-sm font-semibold text-white">{r}</span>
              </label>
            ))}
          </div>
          {reason === "Other" && (
            <div className="mt-2">
              <textarea
                value={otherReason}
                onChange={(e) => setOtherReason(e.target.value)}
                placeholder="Describe the reason..."
                className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 bg-white/5 border border-white/10 resize-none"
                rows={2}
                maxLength={500}
                disabled={submitting}
              />
            </div>
          )}
        </div>

        {/* 2 action sections - pointerup for iOS Safari, onClick for keyboard */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => fireAction("report")}
            onPointerUp={(e) => {
              if (e.pointerType === "touch" && !submitting && reason.trim() && (reason !== "Other" || otherReason.trim())) {
                e.preventDefault();
                fireAction("report");
              }
            }}
            disabled={submitting || !reason.trim() || (reason === "Other" && !otherReason.trim())}
            className="w-full py-3 min-h-[44px] rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            style={{
              background: "linear-gradient(135deg, var(--pink), var(--purple))",
              boxShadow: "0 4px 20px rgba(255,61,127,0.3)",
              touchAction: "manipulation",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            <Flag className="w-4 h-4" />
            {submitting && selectedAction === "report" ? "Submitting..." : "Report only"}
          </button>

          <button
            type="button"
            onClick={() => fireAction("block")}
            onPointerUp={(e) => {
              if (e.pointerType === "touch" && !submitting && reason.trim() && (reason !== "Other" || otherReason.trim())) {
                e.preventDefault();
                fireAction("block");
              }
            }}
            disabled={submitting || !reason.trim() || (reason === "Other" && !otherReason.trim())}
            className="w-full py-3 min-h-[44px] rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            style={{
              background: "linear-gradient(135deg, #d97706, #b45309)",
              boxShadow: "0 4px 20px rgba(217,119,6,0.3)",
              touchAction: "manipulation",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            <Shield className="w-4 h-4" />
            {submitting && selectedAction === "block" ? "Blocking..." : "Report & block user"}
          </button>
        </div>

        <button
          type="button"
          onClick={handleClose}
          disabled={submitting}
          className="mt-4 w-full py-3 min-h-[44px] rounded-xl text-sm font-bold text-white/60 hover:text-white border border-white/20 transition-colors disabled:opacity-50"
          style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
