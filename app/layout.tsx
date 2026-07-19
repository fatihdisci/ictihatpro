import "./globals.css";
import Script from "next/script";
import { Inter, JetBrains_Mono, Newsreader } from "next/font/google";
import type { Metadata, Viewport } from "next";
import { Providers } from "./_components/Providers";

// Arayüz metinleri (etiket, düğme, künye) sans; okunacak hukukî metin serif.
// next/font derleme sırasında dosyaları kendi sunucumuzdan servis eder;
// bu sayede CSP'deki `default-src 'self'` kuralı gevşetilmeden font yüklenir.
const sans = Inter({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-sans",
});

const serif = Newsreader({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-serif",
  axes: ["opsz"],
});

const mono = JetBrains_Mono({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  weight: ["400", "500"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "İçtihat Asistanı",
  description: "Kişisel Türk hukuk araştırma aracı.",
  robots: { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Mobilde klavye açıldığında düzen küçülsün ki sabit composer klavyenin
  // altında kalmasın.
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f3ee" },
    { media: "(prefers-color-scheme: dark)", color: "#0e100f" },
  ],
};

// İlk boyamadan önce çalışır (beforeInteractive) ki kayıtlı/tercih edilen tema
// hidrasyondan önce uygulansın ve açık→koyu geçiş yanıp sönmesi oluşmasın.
const THEME_INIT = `(function(){try{var t=localStorage.getItem("ictihat-theme");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}document.documentElement.setAttribute("data-theme",t);}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className={`${sans.variable} ${serif.variable} ${mono.variable}`} suppressHydrationWarning>
      <body>
        <Script id="theme-init" strategy="beforeInteractive">{THEME_INIT}</Script>
        <a href="#main-content" className="skip-link">İçeriğe atla</a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
