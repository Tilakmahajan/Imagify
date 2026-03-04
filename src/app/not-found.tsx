import Link from "next/link";

export default function NotFound() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 bg-[var(--bg-primary)] text-[var(--text-primary)]"
      style={{ fontFamily: "var(--font-nunito), 'Nunito', sans-serif" }}
    >
      <h1 className="text-6xl font-black text-[var(--pink)]">404</h1>
      <p className="mt-4 text-lg font-semibold text-[var(--text-muted)]">Page not found</p>
      <Link
        href="/"
        className="mt-8 px-6 py-3 rounded-xl font-bold text-white"
        style={{
          background: "linear-gradient(135deg, var(--pink), var(--purple))",
          boxShadow: "0 4px 20px rgba(255,61,127,0.3)",
        }}
      >
        Back to home
      </Link>
    </div>
  );
}
