/** Reusable PicPop logo — matches navbar branding (picpop + pink dot) */
export function PicPopLogo({ className = "", size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  const sizeClasses = { sm: "h-5", md: "h-6 sm:h-7", lg: "h-8 sm:h-10" };
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo.svg"
      alt="PicPop"
      className={`w-auto inline-block ${sizeClasses[size]} ${className}`}
    />
  );
}

/** PicPop icon image (for use when img src needed) */
export function PicPopIcon({ className = "" }: { className?: string }) {
  return (
    <img
      src="/logo.svg"
      alt="PicPop"
      className={className}
    />
  );
}
