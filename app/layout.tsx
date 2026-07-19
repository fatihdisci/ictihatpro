import "./globals.css";
import Script from "next/script";
import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const metadataBase = new URL(`${protocol}://${host}`);
  const title = "İçtihat Asistanı";
  const description = "Kaynak doğrulamalı, editoryal Türk hukuk araştırma alanı.";

  return {
    metadataBase,
    title,
    description,
    robots: { index: false, follow: false, nocache: true },
    openGraph: {
      title,
      description,
      type: "website",
      locale: "tr_TR",
      images: [{ url: "/og.png", width: 1200, height: 630, alt: "İçtihat Asistanı — Kararı değil, dayanağını bulun." }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/og.png"],
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f0e8" },
    { media: "(prefers-color-scheme: dark)", color: "#101714" },
  ],
};

// İlk boyamadan önce çalışır (beforeInteractive) ki kayıtlı/tercih edilen tema
// hidrasyondan önce uygulansın ve açık→koyu geçiş yanıp sönmesi oluşmasın.
const THEME_INIT = `(function(){try{var t=localStorage.getItem("ictihat-theme");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}document.documentElement.setAttribute("data-theme",t);}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <body>
        <Script id="theme-init" strategy="beforeInteractive">{THEME_INIT}</Script>
        <a href="#main-content" className="skip-link">İçeriğe atla</a>
        {children}
      </body>
    </html>
  );
}
