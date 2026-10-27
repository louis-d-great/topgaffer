import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TopGaffer",
  description: "The FPL assistant that remembers every decision you make, and stops you repeating the bad ones.",
};

export const viewport: Viewport = {
  themeColor: "#06080a",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${bricolage.variable} ${geistSans.variable} ${geistMono.variable} h-full`}>
      <body className="pitch-bg min-h-full">{children}</body>
    </html>
  );
}
