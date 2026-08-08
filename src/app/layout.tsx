import type { Metadata, Viewport } from "next";
import { Source_Sans_3, Source_Serif_4, JetBrains_Mono } from "next/font/google";

import { AppShell } from "@/components/layout/AppShell";

import "./globals.css";

const sourceSans = Source_Sans_3({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const sourceSerif = Source_Serif_4({
  variable: "--font-serif",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("http://localhost:3000"),
  title: {
    default: "Open-Source Think Tank (Demonstration)",
    template: "%s · Open-Source Think Tank Demo",
  },
  description:
    "Phase 1 browser demonstration of a proposed open-source think tank using synthetic data only. Not accepting members and not a live membership platform.",
  applicationName: "Open-Source Think Tank Demonstration",
  appleWebApp: {
    title: "OSTT Demo",
    capable: false,
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#2f6f73",
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${sourceSans.variable} ${sourceSerif.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
