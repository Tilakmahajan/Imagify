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
  ArchiveX,
  Trash2,
  FolderOpen,
  Plus,
  Copy,
  Upload,
  ImagePlus,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useToast } from "@/lib/toast-context";

type Tab = "users" | "reports" | "blocked" | "feedbacks" | "categories" | "browseImages";

interface Category {
  id: string;
  name: string;
  order?: number;
  createdAt?: string;
}

interface BrowseImage {
  id: string;
  imageUrl: string;
  name?: string;
  source?: "admin" | "shared";
  feedbackId?: string;
  categoryIds?: string[];
  createdAt?: string;
}

interface AdminData {
  users: Array<Record<string, unknown> & { id: string }>;
  reports: Array<Record<string, unknown> & { id: string }>;
  blockedIps: Array<Record<string, unknown> & { id: string }>;
  feedbacks: Array<Record<string, unknown> & { id: string }>;
  categories?: Category[];
  browseImages?: BrowseImage[];
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
  const [searchQuery, setSearchQuery] = useState("");
  const [unblocking, setUnblocking] = useState<string | null>(null);
  const [bootstrapKey, setBootstrapKey] = useState("");
  const [bootstrapping, setBootstrapping] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [newImageName, setNewImageName] = useState("");
  const [newImageCategoryIds, setNewImageCategoryIds] = useState<string[]>([]);
  const [addingImage, setAddingImage] = useState(false);
  const [addingFromFeedbackId, setAddingFromFeedbackId] = useState<string | null>(null);
  const [addFromFeedbackId, setAddFromFeedbackId] = useState<string | null>(null);
  const [addFromFeedbackCategoryIds, setAddFromFeedbackCategoryIds] = useState<string[]>([]);
  const [editingImageId, setEditingImageId] = useState<string | null>(null);
  const [editCategoryIds, setEditCategoryIds] = useState<string[]>([]);
  const [deletingImageId, setDeletingImageId] = useState<string | null>(null);

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

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newCategoryName.trim();
    if (!name) {
      toast.error("Enter category name");
      return;
    }
    setAddingCategory(true);
    try {
      const { httpsCallable } = await import("firebase/functions");
      const { getAppFunctions } = await import("@/lib/functions");
      const functions = getAppFunctions();
      if (!functions) throw new Error("Firebase not configured");
      const fn = httpsCallable<{ name: string }, { success: boolean }>(functions, "adminAddCategory");
      await fn({ name });
      toast.success("Category added");
      setNewCategoryName("");
      fetchData();
    } catch (err) {
      toast.error("Failed to add category");
    } finally {
      setAddingCategory(false);
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    setDeletingCategoryId(categoryId);
    try {
      const { httpsCallable } = await import("firebase/functions");
      const { getAppFunctions } = await import("@/lib/functions");
      const functions = getAppFunctions();
      if (!functions) throw new Error("Firebase not configured");
      const fn = httpsCallable<{ categoryId: string }, { success: boolean }>(functions, "adminDeleteCategory");
      await fn({ categoryId });
      toast.success("Category deleted");
      fetchData();
    } catch (err) {
      toast.error("Failed to delete category");
    } finally {
      setDeletingCategoryId(null);
    }
  };

  const handleUploadBrowseImage = async (e: React.FormEvent) => {
    e.preventDefault();
    const files = selectedFiles.filter((f) => f.type.startsWith("image/"));
    if (files.length === 0) {
      toast.error("Select at least one image");
      return;
    }
    const oversized = files.filter((f) => f.size > 10 * 1024 * 1024);
    if (oversized.length > 0) {
      toast.error(`${oversized.length} image(s) exceed 10MB limit`);
      return;
    }
    setAddingImage(true);
    const { httpsCallable } = await import("firebase/functions");
    const { getAppFunctions } = await import("@/lib/functions");
    const functions = getAppFunctions();
    if (!functions) {
      toast.error("Firebase not configured");
      setAddingImage(false);
      return;
    }
    const fn = httpsCallable<
      { data: string; mimeType: string; name?: string; categoryIds?: string[] },
      { success: boolean }
    >(functions, "adminUploadBrowseImage");
    let successCount = 0;
    let failCount = 0;
    for (let i = 0; i < files.length; i++) {
      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(files[i]);
        });
        await fn({
          data: base64,
          mimeType: files[i].type,
          name: newImageName.trim() || files[i].name.replace(/\.[^.]+$/, "") || undefined,
          categoryIds: newImageCategoryIds,
        });
        successCount++;
      } catch {
        failCount++;
      }
    }
    setAddingImage(false);
    setSelectedFiles([]);
    setNewImageName("");
    setNewImageCategoryIds([]);
    if (successCount > 0) fetchData();
    if (failCount > 0) toast.error(`${successCount} uploaded, ${failCount} failed`);
    else if (successCount > 0) toast.success(`${successCount} image(s) uploaded`);
  };

  const handleUpdateImageCategories = async (imageId: string) => {
    try {
      const { httpsCallable } = await import("firebase/functions");
      const { getAppFunctions } = await import("@/lib/functions");
      const functions = getAppFunctions();
      if (!functions) throw new Error("Firebase not configured");
      const fn = httpsCallable<
        { imageId: string; categoryIds: string[] },
        { success: boolean }
      >(functions, "adminUpdateImageCategories");
      await fn({ imageId, categoryIds: editCategoryIds });
      toast.success("Categories updated");
      setEditingImageId(null);
      fetchData();
    } catch (err) {
      toast.error("Failed to update");
    }
  };

  const handleAddImageFromFeedback = async (feedbackId: string, categoryIds: string[]) => {
    setAddingFromFeedbackId(feedbackId);
    setAddFromFeedbackId(null);
    try {
      const { httpsCallable } = await import("firebase/functions");
      const { getAppFunctions } = await import("@/lib/functions");
      const functions = getAppFunctions();
      if (!functions) throw new Error("Firebase not configured");
      const fn = httpsCallable<
        { feedbackId: string; categoryIds?: string[] },
        { success: boolean }
      >(functions, "adminAddImageFromFeedback");
      await fn({ feedbackId, categoryIds });
      toast.success("Added to browse");
      fetchData();
    } catch (err: unknown) {
      const e = err as { code?: string; details?: { message?: string } };
      if (e?.code === "already-exists") {
        toast.error("This feedback image is already in the browse section.");
      } else {
        toast.error(e?.details?.message || "Failed to add to browse");
      }
    } finally {
      setAddingFromFeedbackId(null);
    }
  };

  const handleDeleteBrowseImage = async (imageId: string) => {
    setDeletingImageId(imageId);
    try {
      const { httpsCallable } = await import("firebase/functions");
      const { getAppFunctions } = await import("@/lib/functions");
      const functions = getAppFunctions();
      if (!functions) throw new Error("Firebase not configured");
      const fn = httpsCallable<{ imageId: string }, { success: boolean }>(functions, "adminDeleteBrowseImage");
      await fn({ imageId });
      toast.success("Image removed");
      fetchData();
    } catch (err) {
      toast.error("Failed to remove");
    } finally {
      setDeletingImageId(null);
    }
  };

  const categories = data?.categories ?? [];
  const browseImages = data?.browseImages ?? [];

  const searchFilter = (item: any) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return Object.values(item).some(val => 
      val && String(val).toLowerCase().includes(q)
    );
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
                { id: "categories" as Tab, label: "Categories", icon: FolderOpen, count: categories.length },
                { id: "browseImages" as Tab, label: "Browse Images", icon: ImagePlus, count: browseImages.length },
              ].map(({ id, label, icon: Icon, count }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-colors ${tab === id
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

            <div className="mb-6 flex items-center gap-4">
              <div className="relative flex-1 max-w-sm">
                <input
                  type="text"
                  placeholder={`Search ${tab}...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl px-4 py-2.5 text-sm bg-white/5 border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--pink)] placeholder-white/40 shadow-sm"
                />
              </div>
              <button
                type="button"
                onClick={fetchData}
                disabled={loading}
                className="p-2.5 rounded-xl bg-white/5 border border-[var(--border)] hover:bg-white/10 transition-all text-[var(--text-muted)] hover:text-white"
                title="Refresh data"
              >
                <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
              </button>
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
                      {data.users.filter(searchFilter).map((u) => (
                        <tr key={u.id} className="border-b border-[var(--border)]">
                          <td className="p-3 font-mono text-xs truncate max-w-[100px]" title={u.id as string}>{u.id as string}</td>
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
                      </tr>
                    </thead>
                    <tbody>
                      {data.reports.filter(searchFilter).map((r) => (
                        <tr key={r.id} className="border-b border-[var(--border)]">
                          <td className="p-3 text-xs text-[var(--text-muted)]">{formatDate(r.createdAt)}</td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-bold ${r.action === "block" ? "bg-amber-500/20 text-amber-400" : "bg-white/10"
                                }`}
                            >
                              {String(r.action || "report")}
                            </span>
                          </td>
                          <td className="p-3">{(r.reason as string) || "—"}</td>
                          <td className="p-3 font-mono text-xs truncate max-w-[100px]" title={r.feedbackId as string}>{(r.feedbackId as string) || "—"}</td>
                          <td className="p-3 font-mono text-xs truncate max-w-[100px]" title={r.feedbackId as string}>{(r.feedbackId as string) || "—"}</td>
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
                        <th className="p-3 font-bold">Blocked ID</th>
                        <th className="p-3 font-bold">Reason</th>
                        <th className="p-3 font-bold">Feedback ID</th>
                        <th className="p-3 font-bold">Blocked At</th>
                        <th className="p-3 font-bold">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.blockedIps.filter(searchFilter).map((b) => (
                        <tr key={b.id} className="border-b border-[var(--border)]">
                          <td className="p-3 font-mono text-xs truncate max-w-[120px]" title={b.id}>ID: {b.id.slice(0, 8)}...</td>
                          <td className="p-3">{(b.reason as string) || "—"}</td>
                          <td className="p-3 font-mono text-xs truncate max-w-[100px]" title={b.feedbackId as string}>{(b.feedbackId as string) || "—"}</td>
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
                        <th className="p-3 font-bold">Feedback Image</th>
                        <th className="p-3 font-bold">Views</th>
                        <th className="p-3 font-bold">Shares</th>
                        <th className="p-3 font-bold text-center">Identity</th>
                        <th className="p-3 font-bold text-center">Deleted</th>
                        <th className="p-3 font-bold">Created</th>
                        <th className="p-3 font-bold">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.feedbacks.filter(searchFilter).map((f) => (
                        <tr key={f.id} className="border-b border-[var(--border)]">
                          <td className="p-3 font-mono text-xs truncate max-w-[100px]" title={f.id as string}>
                            {f.id as string}
                          </td>
                          <td className="p-3">{f.imageId ? "image" : "inbox"}</td>
                          <td className="p-3">
                            <div className="flex flex-col gap-0.5 max-w-[150px]">
                              <span className="font-mono text-xs truncate" title={(f.imageId as string) || (f.recipientId as string) || "—"}>
                                {(f.imageId as string) || (f.recipientId as string) || "—"}
                              </span>
                              {!f.imageId && typeof f.recipientId === "string" ? (() => {
                                const u = data.users.find((u) => u.id === f.recipientId);
                                const email = u && typeof u.email === "string" ? u.email : null;
                                return email ? (
                                  <span className="text-[10px] text-[var(--text-muted)] truncate" title={email}>
                                    {email}
                                  </span>
                                ) : null;
                              })() : null}
                            </div>
                          </td>
                          <td className="p-3">
                            {(f as { feedbackImageUrl?: string }).feedbackImageUrl ? (
                              <a href={(f as { feedbackImageUrl?: string }).feedbackImageUrl} target="_blank" rel="noopener noreferrer">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={(f as { feedbackImageUrl?: string }).feedbackImageUrl} alt="Feedback" className="w-10 h-10 object-cover rounded bg-white/10" loading="lazy" />
                              </a>
                            ) : "—"}
                          </td>
                          <td className="p-3">{Number(f.viewCount) || 0}</td>
                          <td className="p-3">{Number(f.reshareCount) || 0}</td>
                          <td className="p-3 text-center">
                            {f.submitterId ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black bg-blue-500/20 text-blue-400 border border-blue-500/30">VERIFIED</span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black bg-white/10 text-[var(--text-muted)] border border-white/10">ANON</span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            {f.deleted ? (
                              <span className="text-red-400 font-bold">Yes</span>
                            ) : (
                              <span className="opacity-40">No</span>
                            )}
                          </td>
                          <td className="p-3 text-xs text-[var(--text-muted)]">{formatDate(f.createdAt)}</td>
                          <td className="p-3">
                            {(f as { feedbackImageUrl?: string }).feedbackImageUrl && (
                              addFromFeedbackId === f.id ? (
                                <div className="flex flex-wrap gap-2 items-center">
                                  {categories.map((c) => (
                                    <label key={c.id} className="flex items-center gap-1 cursor-pointer text-xs">
                                      <input
                                        type="checkbox"
                                        checked={addFromFeedbackCategoryIds.includes(c.id)}
                                        onChange={(e) =>
                                          setAddFromFeedbackCategoryIds((prev) =>
                                            e.target.checked ? [...prev, c.id] : prev.filter((id) => id !== c.id)
                                          )
                                        }
                                        className="rounded"
                                      />
                                      {c.name}
                                    </label>
                                  ))}
                                  <button
                                    type="button"
                                    onClick={() => handleAddImageFromFeedback(f.id, addFromFeedbackCategoryIds)}
                                    disabled={addingFromFeedbackId === f.id}
                                    className="px-2 py-1 rounded text-xs font-bold bg-[var(--green)] text-white"
                                  >
                                    {addingFromFeedbackId === f.id ? "Adding..." : "Add"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setAddFromFeedbackId(null)}
                                    className="px-2 py-1 rounded text-xs font-bold bg-white/20"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAddFromFeedbackId(f.id);
                                    setAddFromFeedbackCategoryIds([]);
                                  }}
                                  disabled={addingFromFeedbackId === f.id}
                                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold text-[var(--green)] hover:bg-[var(--green)]/20 disabled:opacity-50"
                                >
                                  <ImagePlus className="w-3.5 h-3.5" />
                                  {addingFromFeedbackId === f.id ? "Adding..." : "Add to Browse"}
                                </button>
                              )
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {tab === "categories" && (
                <div className="p-4">
                  <form onSubmit={handleAddCategory} className="flex gap-2 mb-6">
                    <input
                      type="text"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      placeholder="Category name"
                      className="flex-1 rounded-xl px-4 py-2.5 text-sm bg-white/5 border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--pink)]"
                      disabled={addingCategory}
                    />
                    <button
                      type="submit"
                      disabled={addingCategory || !newCategoryName.trim()}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm bg-[var(--green)] text-white hover:opacity-90 disabled:opacity-50"
                    >
                      <Plus className="w-4 h-4" />
                      {addingCategory ? "Adding..." : "Add"}
                    </button>
                  </form>
                  <div className="space-y-2">
                    {categories.length === 0 ? (
                      <p className="text-[var(--text-muted)] text-sm py-4">No categories yet. Add one above.</p>
                    ) : (
                      categories.map((c) => (
                        <div
                          key={c.id}
                          className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-[var(--border)]"
                        >
                          <span className="font-bold">{c.name}</span>
                          <button
                            type="button"
                            onClick={() => handleDeleteCategory(c.id)}
                            disabled={deletingCategoryId === c.id}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold text-red-400 hover:bg-red-500/20 disabled:opacity-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            {deletingCategoryId === c.id ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {tab === "browseImages" && (
                <div className="p-4">
                  <form onSubmit={handleUploadBrowseImage} className="space-y-3 mb-6 p-4 rounded-xl bg-white/5 border border-[var(--border)]">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <label className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-[var(--border)] cursor-pointer hover:border-[var(--purple)] transition-colors">
                        <Upload className="w-5 h-5 text-[var(--text-muted)]" />
                        <span className="text-sm font-semibold">
                          {selectedFiles.length > 0
                            ? `${selectedFiles.length} image(s) selected`
                            : "Choose images (multiple allowed)"}
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={(e) => setSelectedFiles(Array.from(e.target.files ?? []))}
                          disabled={addingImage}
                        />
                      </label>
                      <input
                        type="text"
                        value={newImageName}
                        onChange={(e) => setNewImageName(e.target.value)}
                        placeholder="Name (optional)"
                        className="w-full sm:w-40 rounded-xl px-4 py-2.5 text-sm bg-white/5 border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--pink)]"
                        disabled={addingImage}
                      />
                    </div>
                    {categories.length > 0 && (
                      <div className="flex flex-wrap gap-2 items-center">
                        <span className="text-xs text-[var(--text-muted)]">Categories (select multiple):</span>
                        {categories.map((c) => (
                          <label key={c.id} className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={newImageCategoryIds.includes(c.id)}
                              onChange={(e) =>
                                setNewImageCategoryIds((prev) =>
                                  e.target.checked ? [...prev, c.id] : prev.filter((id) => id !== c.id)
                                )
                              }
                              className="rounded"
                            />
                            <span className="text-sm">{c.name}</span>
                          </label>
                        ))}
                      </div>
                    )}
                    {selectedFiles.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {selectedFiles.map((f, i) => (
                          <span
                            key={`${f.name}-${i}`}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white/10"
                          >
                            {f.name}
                            <button
                              type="button"
                              onClick={() => setSelectedFiles((prev) => prev.filter((_, idx) => idx !== i))}
                              className="text-red-400 hover:text-red-300"
                              aria-label="Remove"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    <button
                      type="submit"
                      disabled={addingImage || selectedFiles.length === 0}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm bg-[var(--green)] text-white hover:opacity-90 disabled:opacity-50"
                    >
                      <Upload className="w-4 h-4" />
                      {addingImage ? "Uploading..." : `Upload ${selectedFiles.length || ""} image(s)`}
                    </button>
                  </form>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {browseImages.length === 0 ? (
                      <p className="col-span-full text-[var(--text-muted)] text-sm py-4">
                        No browse images. Add from URL above or from Recent Feedbacks.
                      </p>
                    ) : (
                      browseImages.filter(searchFilter).map((img) => (
                        <div
                          key={img.id}
                          className="rounded-xl overflow-hidden border border-[var(--border)] bg-white/5"
                        >
                          <div className="aspect-square relative">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={img.imageUrl} alt={img.name || "Browse"} className="w-full h-full object-cover" loading="lazy" decoding="async" />
                            <div className="absolute top-2 right-2 flex gap-1">
                              <span className="px-2 py-0.5 rounded text-xs font-bold bg-black/60">
                                {img.source || "admin"}
                              </span>
                              {editingImageId === img.id ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateImageCategories(img.id)}
                                    className="px-2 py-0.5 rounded text-xs font-bold bg-[var(--green)] text-white"
                                  >
                                    Save
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingImageId(null)}
                                    className="px-2 py-0.5 rounded text-xs font-bold bg-white/20"
                                  >
                                    Cancel
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingImageId(img.id);
                                    setEditCategoryIds(img.categoryIds ?? []);
                                  }}
                                  className="px-2 py-0.5 rounded text-xs font-bold bg-[var(--purple)] text-white"
                                >
                                  Edit
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleDeleteBrowseImage(img.id)}
                                disabled={deletingImageId === img.id}
                                className="px-2 py-0.5 rounded text-xs font-bold bg-red-500/80 text-white disabled:opacity-50"
                              >
                                {deletingImageId === img.id ? "…" : "Delete"}
                              </button>
                            </div>
                          </div>
                          <div className="p-3">
                            {editingImageId === img.id ? (
                              <div className="flex flex-wrap gap-2">
                                {categories.map((c) => (
                                  <label key={c.id} className="flex items-center gap-1.5 cursor-pointer text-sm">
                                    <input
                                      type="checkbox"
                                      checked={editCategoryIds.includes(c.id)}
                                      onChange={(e) =>
                                        setEditCategoryIds((prev) =>
                                          e.target.checked ? [...prev, c.id] : prev.filter((id) => id !== c.id)
                                        )
                                      }
                                      className="rounded"
                                    />
                                    {c.name}
                                  </label>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-[var(--text-muted)]">
                                {(img.name || img.feedbackId || "—").toString().slice(0, 40)}
                                {img.categoryIds?.length ? ` · ${img.categoryIds.length} categories` : ""}
                              </p>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
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
