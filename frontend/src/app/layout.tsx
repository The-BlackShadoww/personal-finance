import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { headers } from "next/headers";
import type { ReactNode } from "react";

import { Providers } from "./providers";
import "./globals.css";

// next/font downloads these at build time and serves them from this origin,
// so visitors never contact Google (no third-party IP logging, no
// render-blocking cross-origin stylesheet) and the CSP stays 'self'-only.
// Each exposes a CSS variable consumed by the --font-* tokens in globals.css.
const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-geist-mono",
  display: "swap",
});

// Nothing uses the serif token yet: skip preloading so pages do not download
// it up front. The browser still fetches it on demand if a component uses it.
const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: "Personal Finance",
  description: "A personal finance dashboard for budgets, transactions, and reports.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#171717" },
  ],
};

type RootLayoutProps = {
  children: ReactNode;
};

export default async function RootLayout({ children }: RootLayoutProps) {
  // Set per request by middleware. Reading it opts every route into dynamic
  // rendering, which the nonce-based Content-Security-Policy requires.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html
      lang="en"
      className={`${geist.variable} ${geistMono.variable} ${instrumentSerif.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script
          nonce={nonce}
          // Browsers hide the nonce attribute after load, which React would
          // otherwise report as a hydration mismatch.
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `(() => { try { const saved = localStorage.getItem("theme"); const theme = saved === "dark" || saved === "light" ? saved : (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"); document.documentElement.classList.toggle("dark", theme === "dark"); } catch {} })();`,
          }}
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
