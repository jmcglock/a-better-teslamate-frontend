import type { Metadata } from "next";
import { Inter, Inter_Tight, JetBrains_Mono } from "next/font/google";
import Nav from "@/components/Nav";
import "./globals.css";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans" });
const cond = Inter_Tight({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-cond" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "A Better TeslaMate Dashboard",
  description: "Tesla-inspired companion dashboard for TeslaMate — live status, drives, charges, stats, timeline, places, and updates.",
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${cond.variable} ${mono.variable}`}>
      <body>
        <Nav />
        <main className="mx-auto max-w-7xl px-4 pb-20 pt-6 sm:px-6 lg:px-8">{children}</main>
      </body>
    </html>
  );
}
