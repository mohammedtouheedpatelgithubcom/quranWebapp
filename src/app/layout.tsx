import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://mohammedtouheedpatelgithubcom.github.io/quranWebapp/"),
  title: {
    default: "Noor Quran Companion | Read the Quran Online",
    template: "%s | Noor Quran Companion",
  },
  description:
    "Read the Quran online with Arabic text, English translations, verse audio, bookmarks, and gentle reading progress tracking.",
  applicationName: "Noor Quran Companion",
  keywords: [
    "Quran online",
    "read Quran",
    "Quran with English translation",
    "Quran audio",
    "Arabic Quran",
    "surah reader",
  ],
  alternates: {
    canonical: "/",
  },
  verification: {
    google: "jVX97u12An-cETaDKEVU31RgTQ_mLQjA_xiachWclI8",
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Noor Quran Companion",
    title: "Noor Quran Companion | Read the Quran Online",
    description:
      "Read the Quran online with Arabic text, English translations, verse audio, bookmarks, and reading progress tracking.",
    locale: "en_US",
  },
  twitter: {
    card: "summary",
    title: "Noor Quran Companion | Read the Quran Online",
    description:
      "Read the Quran online with Arabic text, English translations, verse audio, and bookmarks.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Noor Quran Companion",
  url: "https://mohammedtouheedpatelgithubcom.github.io/quranWebapp/",
  description:
    "Read the Quran online with Arabic text, English translations, verse audio, bookmarks, and reading progress tracking.",
  applicationCategory: "EducationalApplication",
  operatingSystem: "Any",
  inLanguage: ["en", "ar"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        {children}
      </body>
    </html>
  );
}
