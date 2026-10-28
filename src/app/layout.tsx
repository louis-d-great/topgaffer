import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
});

// BoardUI's type scale is built on Inter.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TopGaffer",
  description: "The FPL assistant that remembers every decision you make, and stops you repeating the bad ones.",
};

export const viewport: Viewport = {
  themeColor: "#121212",
};

// Applies the saved theme before first paint, so light mode never flashes dark. Dark is the default.
const THEME_SCRIPT = `try{if(JSON.parse(localStorage.getItem("tg.theme"))==="light")document.documentElement.classList.remove("dark")}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`dark ${bricolage.variable} ${inter.variable} h-full`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="pitch-bg min-h-full">{children}</body>
    </html>
  );
}
