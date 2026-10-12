import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { ServiceWorkerRegistration } from "@/components/chrome";
import { AuthProvider } from "@/features/auth/auth-provider";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Instox",
  description: "Manually published market tips for India.",
  applicationName: "Instox",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Instox",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
  openGraph: {
    title: "inStox",
    description: "Instant Trading Ideas",
    images: [{ url: "/brand/og.png", width: 1200, height: 630, alt: "inStox, Instant Trading Ideas" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#FFFFFF",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
      <body className={`${inter.variable} font-sans antialiased`}>
        <a href="#content" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-white focus:px-3 focus:py-2">
          Skip to content
        </a>
        <AuthProvider>
          <div id="content">{children}</div>
          <ServiceWorkerRegistration />
        </AuthProvider>
      </body>
    </html>
  );
}
