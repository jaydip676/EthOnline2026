import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { NetworkBanner } from "@/components/network-banner";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Providers } from "./providers";
import "./globals.css";

const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-geist-mono",
});

const description =
  "Bounding SLAC on 1inch Aqua. Coverage stops underfunded rungs from quoting. Tokens stay in the wallet.";

export const metadata: Metadata = {
  title: {
    default: "Ladder",
    template: "%s · Ladder",
  },
  description,
  applicationName: "Ladder",
  keywords: ["1inch", "Aqua", "SwapVM", "SLAC", "coverage", "grid", "Base"],
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#F2F9FC",
  colorScheme: "light",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <body className={`${sans.className} flex min-h-svh flex-col`}>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <Providers>
          <SiteHeader />
          <main id="main" tabIndex={-1} className="app-shell relative z-10 flex-1 py-10 outline-none sm:py-14">
            <NetworkBanner />
            {children}
          </main>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
