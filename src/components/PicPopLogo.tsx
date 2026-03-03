/** Reusable PicPop logo — matches navbar branding (picpop + pink dot) */
export function PicPopLogo({ className = "", size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  const sizeClasses = { sm: "text-lg", md: "text-xl sm:text-2xl", lg: "text-3xl" };
  return (
    <span
      className={`font-black tracking-tight inline-block ${sizeClasses[size]} ${className}`}
      style={{ letterSpacing: "-0.04em" }}
    >
      picpop<span className="text-[var(--pink)]">.</span>
    </span>
  );
}

/** PicPop icon image (for use when img src needed) */
export function PicPopIcon({ className = "" }: { className?: string }) {
  return (
    <img
      src="/icon.svg"
      alt="PicPop"
      className={className}
    />
  );
}
