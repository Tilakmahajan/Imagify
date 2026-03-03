"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Shield,
  Users,
  Flag,
  Ban,
  MessageSquare,
  ArrowLeft,
  RefreshCw,
  Unlock,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useToast } from "@/lib/toast-context";

type Tab = "users" | "reports" | "blocked" | "feedbacks";

interface AdminData {
  users: Array<Record<string, unknown> & { id: string }>;
  reports: Array<Record<string, unknown> & { id: string }>;
  blockedIps: Array<Record<string, unknown> & { id: string }>;
  feedbacks: Array<Record<string, unknown> & { id: string }>;
}

function formatDate(val: unknown): string {
  if (!val) return "—";
  if (typeof val === "string") return new Date(val).toLocaleString();
  if (val && typeof val === "object" && "toDate" in val && typeof (val as { toDate: () => Date }).toDate === "function") {
    return (val as { toDate: () => Date }).toDate().toLocaleString();
  }
  return String(val);
}

export default function AdminPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const toast = useToast();
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("users");
  const [unblocking, setUnblocking] = useState<string | null>(null);
  const [bootstrapKey, setBootstrapKey] = useState("");
  const [bootstrapping, setBootstrapping] = useState(false);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const { httpsCallable } = await import("firebase/functions");
      const { getAppFunctions } = await import("@/lib/functions");
      const functions = getAppFunctions();
      if (!functions) throw new Error("Firebase not configured");
      const getAdminData = httpsCallable<unknown, AdminData>(functions, "getAdminData");
      const res = await getAdminData({});
      setData(res.data);
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string; details?: { message?: string } };
      if (e?.code === "permission-denied" || e?.message?.includes("Admin") || e?.details?.message?.includes("Admin")) {
        setError("admin-denied");
      } else if (e?.code === "unauthenticated") {
        setError("Sign in required.");
      } else {
        setError(e?.message || e?.details?.message || "Failed to load admin data");
      }
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login");
      return;
    }
    if (user) fetchData();
  }, [user, authLoading, router]);

  const handleBootstrap = async (e: React.FormEvent) => {
    e.preventDefault();
    const key = bootstrapKey.trim();
    if (!key) {
      toast.error("Enter the admin key");
      return;
    }
    setBootstrapping(true);
    setError(null);
    try {
      const { httpsCallable } = await import("firebase/functions");
      const { getAppFunctions } = await import("@/lib/functions");
      const functions = getAppFunctions();
      if (!functions) throw new Error("Firebase not configured");
      const adminBootstrap = httpsCallable<{ secret: string }, { success: boolean; message?: string }>(functions, "adminBootstrap");
      const res = await adminBootstrap({ secret: key });
      toast.success(res.data?.message || "Admin added");
      setBootstrapKey("");
      fetchData();
    } catch (err: unknown) {
      const e = err as { message?: string; details?: { message?: string } };
      setError("admin-denied");
      toast.error(e?.details?.message || e?.message || "Invalid admin key");
    } finally {
      setBootstrapping(false);
    }
  };

  const handleUnblock = async (ipKey: string) => {
    setUnblocking(ipKey);
    try {
      const { httpsCallable } = await import("firebase/functions");
      const { getAppFunctions } = await import("@/lib/functions");
      const functions = getAppFunctions();
      if (!functions) throw new Error("Firebase not configured");
      const adminUnblockIp = httpsCallable<{ ipKey: string }, { success: boolean }>(functions, "adminUnblockIp");
      await adminUnblockIp({ ipKey });
      toast.success("IP unblocked");
      fetchData();
    } catch (err) {
      toast.error("Failed to unblock");
    } finally {
      setUnblocking(null);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: "var(--pink)" }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <style>{`:root { --pink: #FF3D7F; --purple: #7C3AFF; --blue: #00C8FF; --green: #00FF94; }`}</style>

      <header className="navbar-glass sticky top-0 z-50 border-b border-[var(--border)]">
        <nav className="flex h-14 items-center justify-between px-4 max-w-[900px] mx-auto">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/5">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <Shield className="w-5 h-5 text-amber-400" />
            <span className="font-black text-lg">Admin Panel</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              type="button"
              onClick={fetchData}
              disabled={loading}
              className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--pink)] hover:bg-white/5 disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </nav>
      </header>

      <main className="max-w-[900px] mx-auto px-4 py-6">
        {error && (
          <div className="mb-6 p-6 rounded-2xl border border-amber-500/50 bg-amber-500/10 text-amber-200">
            {error === "admin-denied" ? (
              <>
                <p className="font-bold mb-2">Add yourself as admin</p>
                <p className="text-sm mb-4 opacity-80">
                  Sign in with your account, then enter the admin key below to grant yourself admin access. Set ADMIN_SECRET in Firebase Console → Functions → Configuration.
                </p>
                <form onSubmit={handleBootstrap} className="flex gap-3">
                  <input
                    type="password"
                    value={bootstrapKey}
                    onChange={(e) => setBootstrapKey(e.target.value)}
                    placeholder="Admin key"
                    className="flex-1 rounded-xl px-4 py-2.5 text-sm bg-white/10 border border-white/20 focus:outline-none focus:ring-2 focus:ring-[var(--pink)] placeholder-white/40"
                    disabled={bootstrapping}
                  />
                  <button
                    type="submit"
                    disabled={bootstrapping || !bootstrapKey.trim()}
                    className="px-5 py-2.5 rounded-xl font-bold text-sm bg-[var(--green)] text-white hover:opacity-90 disabled:opacity-50"
                  >
                    {bootstrapping ? "Adding..." : "Add as Admin"}
                  </button>
                </form>
              </>
            ) : (
              <>
                <p className="font-bold">{error}</p>
                {error !== "Sign in required." && (
                  <p className="text-sm mt-2 opacity-80">
                    Sign in first, then use the admin key to add yourself. Set ADMIN_SECRET in Firebase Console → Functions → Configuration.
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {data && !error && (
          <>
            <div className="flex flex-wrap gap-2 mb-6">
              {[
                { id: "users" as Tab, label: "Users", icon: Users, count: data.users.length },
                { id: "reports" as Tab, label: "Reports", icon: Flag, count: data.reports.length },
                { id: "blocked" as Tab, label: "Blocked IPs", icon: Ban, count: data.blockedIps.length },
                { id: "feedbacks" as Tab, label: "Recent Feedbacks", icon: MessageSquare, count: data.feedbacks.length },
              ].map(({ id, label, icon: Icon, count }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-colors ${
                    tab === id
                      ? "bg-[var(--pink)] text-white"
                      : "bg-white/5 text-[var(--text-muted)] hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                  <span className="text-xs opacity-80">({count})</span>
                </button>
              ))}
            </div>

            <div className="rounded-2xl border border-[var(--border)] overflow-hidden" style={{ background: "var(--bg-card)" }}>
              {tab === "users" && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border)]">
                        <th className="p-3 font-bold">User ID</th>
                        <th className="p-3 font-bold">@coolId</th>
                        <th className="p-3 font-bold">Email</th>
                        <th className="p-3 font-bold">Display Name</th>
                        <th className="p-3 font-bold">Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.users.map((u) => (
                        <tr key={u.id} className="border-b border-[var(--border)]">
                          <td className="p-3 font-mono text-xs break-all">{u.id}</td>
                          <td className="p-3">@{String(u.coolId || "—")}</td>
                          <td className="p-3">{(u.email as string) || "—"}</td>
                          <td className="p-3">{(u.displayName as string) || "—"}</td>
                          <td className="p-3 text-xs text-[var(--text-muted)]">{formatDate(u.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {tab === "reports" && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border)]">
                        <th className="p-3 font-bold">Date</th>
                        <th className="p-3 font-bold">Action</th>
                        <th className="p-3 font-bold">Reason</th>
                        <th className="p-3 font-bold">Feedback ID</th>
                        <th className="p-3 font-bold">Reporter IP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.reports.map((r) => (
                        <tr key={r.id} className="border-b border-[var(--border)]">
                          <td className="p-3 text-xs text-[var(--text-muted)]">{formatDate(r.createdAt)}</td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-bold ${
                                r.action === "block" ? "bg-amber-500/20 text-amber-400" : "bg-white/10"
                              }`}
                            >
                              {String(r.action || "report")}
                            </span>
                          </td>
                          <td className="p-3">{(r.reason as string) || "—"}</td>
                          <td className="p-3 font-mono text-xs">{(r.feedbackId as string) || "—"}</td>
                          <td className="p-3 font-mono text-xs">{(r.reporterIp as string) || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {tab === "blocked" && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border)]">
                        <th className="p-3 font-bold">IP</th>
                        <th className="p-3 font-bold">Reason</th>
                        <th className="p-3 font-bold">Feedback ID</th>
                        <th className="p-3 font-bold">Blocked At</th>
                        <th className="p-3 font-bold">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.blockedIps.map((b) => (
                        <tr key={b.id} className="border-b border-[var(--border)]">
                          <td className="p-3 font-mono text-xs">{(b.ip as string) || b.id}</td>
                          <td className="p-3">{(b.reason as string) || "—"}</td>
                          <td className="p-3 font-mono text-xs">{(b.feedbackId as string) || "—"}</td>
                          <td className="p-3 text-xs text-[var(--text-muted)]">{formatDate(b.createdAt)}</td>
                          <td className="p-3">
                            <button
                              type="button"
                              onClick={() => handleUnblock(b.id)}
                              disabled={unblocking === b.id}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold text-green-400 hover:bg-green-500/20 disabled:opacity-50"
                            >
                              <Unlock className="w-3.5 h-3.5" />
                              {unblocking === b.id ? "Unblocking..." : "Unblock"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {tab === "feedbacks" && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border)]">
                        <th className="p-3 font-bold">ID</th>
                        <th className="p-3 font-bold">Type</th>
                        <th className="p-3 font-bold">Image/Recipient</th>
                        <th className="p-3 font-bold">Deleted</th>
                        <th className="p-3 font-bold">Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.feedbacks.map((f) => (
                        <tr key={f.id} className="border-b border-[var(--border)]">
                          <td className="p-3 font-mono text-xs break-all">{f.id}</td>
                          <td className="p-3">{f.imageId ? "image" : "inbox"}</td>
                          <td className="p-3 font-mono text-xs">
                            {(f.imageId as string) || (f.recipientId as string) || "—"}
                          </td>
                          <td className="p-3">{f.deleted ? "Yes" : "No"}</td>
                          <td className="p-3 text-xs text-[var(--text-muted)]">{formatDate(f.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {loading && !data && !error && (
          <div className="py-16 text-center">
            <RefreshCw className="w-10 h-10 mx-auto animate-spin text-[var(--pink)]" />
            <p className="mt-4 font-bold text-[var(--text-muted)]">Loading admin data...</p>
          </div>
        )}
      </main>
    </div>
  );
}
