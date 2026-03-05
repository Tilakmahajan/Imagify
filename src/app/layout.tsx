import type { Metadata } from "next";
import Script from "next/script";
import { Nunito, Geist_Mono } from "next/font/google";
import { CursorGlow } from "@/components/CursorGlow";
import { AuthProvider } from "@/lib/auth-context";
import { LoadingProvider } from "@/lib/loading-context";
import { AuthRedirect } from "@/components/AuthRedirect";
import { ToastProvider } from "@/lib/toast-context";
import { GlobalLoader } from "@/components/GlobalLoader";
import { NotificationTitleUpdater } from "@/components/NotificationTitleUpdater";
import { AddToHomeScreenPrompt } from "@/components/AddToHomeScreenPrompt";
import { ThemeProvider } from "@/lib/theme-context";
import "./globals.css";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800", "900"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PicPop - Anonymous Image-Based Feedback",
  description: "Share honest feedback anonymously with images. No sign-up, no tracking. Just upload and send.",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head />
      <body
        className={`${nunito.variable} ${geistMono.variable} antialiased bg-[var(--bg-primary)] text-[var(--text-primary)]`}
        suppressHydrationWarning
      >
        <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <LoadingProvider>
              <NotificationTitleUpdater />
              <AuthRedirect />
              {children}
              <CursorGlow />
              <GlobalLoader />
              <AddToHomeScreenPrompt />
            </LoadingProvider>
          </ToastProvider>
        </AuthProvider>
        </ThemeProvider>
        <Script
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${process.env.NEXT_PUBLIC_ADSENSE_CLIENT || "ca-pub-9913239924968431"}`}
          strategy="beforeInteractive"
          crossOrigin="anonymous"
        />
      </body>
    </html>
  );
}
