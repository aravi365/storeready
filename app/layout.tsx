import type { Metadata, Viewport } from "next";
import { Google_Sans, Google_Sans_Code } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { KEYWORDS, SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL } from "@/lib/site";
import "./globals.css";

// Google's own typefaces, self-hosted at build time by next/font (no runtime request to Google).
// Thai is included so Thai file names and text render in the same family.
const googleSans = Google_Sans({ variable: "--font-google-sans", subsets: ["latin", "latin-ext", "thai"], display: "swap" });
const googleSansCode = Google_Sans_Code({ variable: "--font-google-sans-code", subsets: ["latin", "latin-ext"], display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(`${SITE_URL}/`),
  title: { default: `${SITE_TITLE} | ${SITE_NAME}`, template: `%s | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  keywords: KEYWORDS,
  applicationName: SITE_NAME,
  category: "developer tools",
  authors: [{ name: "aravi365", url: "https://github.com/aravi365" }],
  creator: "aravi365",
  alternates: { canonical: "./" },
  openGraph: {
    type: "website",
    url: "./",
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    locale: "en_US",
    images: [{ url: "og.png", width: 1200, height: 630, alt: `${SITE_NAME}: App Store & Google Play screenshot resizer and app icon generator` }],
  },
  twitter: { card: "summary_large_image", title: SITE_TITLE, description: SITE_DESCRIPTION, images: ["og.png"] },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large" } },
  // Paste your Google Search Console token here (or set NEXT_PUBLIC_GSC_VERIFICATION) to verify ownership.
  verification: process.env.NEXT_PUBLIC_GSC_VERIFICATION ? { google: process.env.NEXT_PUBLIC_GSC_VERIFICATION } : undefined,
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f7fb" },
    { media: "(prefers-color-scheme: dark)", color: "#14141c" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${googleSans.variable} ${googleSansCode.variable} h-full antialiased`}>
      <body className="min-h-full">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
          <Toaster richColors position="bottom-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
