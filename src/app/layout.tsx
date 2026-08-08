import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { PrototypeBanner } from "@/components/PrototypeBanner";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Open-Source Think Tank (Demonstration)",
  description:
    "Phase 1 browser demonstration of a proposed open-source think tank using synthetic data only. Not accepting members and not a live membership platform.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <PrototypeBanner />
        {children}
      </body>
    </html>
  );
}
