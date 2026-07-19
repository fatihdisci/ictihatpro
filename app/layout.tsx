import "./globals.css";
import Script from "next/script";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "İçtihat Asistanı",
  description: "Kişisel Türk hukuk araştırma aracı.",
  robots: { index: false, follow: false, nocache: true },
};

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
