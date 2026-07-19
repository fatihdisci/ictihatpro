import type { Transition } from "motion/react";

/**
 * Ortak yay (spring) ayarları.
 *
 * Süre tabanlı easing yerine yay kullanılır: kesilen/üst üste binen
 * etkileşimlerde hareket kırılmadan yeni hedefe yönelir. Üç ayar tüm arayüzü
 * kapsar; bileşenler kendi sayılarını uydurmaz ki hareket dili tutarlı kalsın.
 */
export const spring = {
  /** Dokunma geri bildirimi: düğme, çip, ikon. Kısa ve kesin. */
  snap: { type: "spring", stiffness: 520, damping: 34, mass: 0.7 } satisfies Transition,
  /** İçerik girişi: kart, bölüm, panel. Ağırlığı hissedilir. */
  glide: { type: "spring", stiffness: 260, damping: 30, mass: 0.9 } satisfies Transition,
  /** Düzen değişimi: açılıp kapanan yükseklik, yeniden akan ızgara. */
  soft: { type: "spring", stiffness: 190, damping: 26, mass: 1 } satisfies Transition,
} as const;

/**
 * Açık gecikmeli yükselme.
 *
 * Ebeveyn→çocuk variant yayılımına (staggerChildren) güvenmek yerine her öğe
 * kendi initial/animate'ini taşır. Yayılım, Next dev HMR yeniden derlemeleri
 * ve React 19 ile güvenilmez biçimde "hidden"da takılabildiği için tüm sıralı
 * girişlerde bu açık yöntem kullanılır.
 */
export const fadeUp = (delay = 0, y = 16) => ({
  initial: { opacity: 0, y },
  animate: { opacity: 1, y: 0 },
  transition: { ...spring.glide, delay },
});

/**
 * Alt kenardan yaylanarak giren/çıkan yüzer panel (durum kartı).
 * Variant etiketi yerine doğrudan prop nesnesi: initial/animate yayılımı
 * bu ortamda güvenilmez olduğundan tüm bileşenler açık prop kullanır.
 */
export const dockProps = {
  initial: { opacity: 0, y: 24, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 16, scale: 0.98 },
  transition: spring.glide,
} as const;

/** Durum metni şeridi: eski satır yukarı çıkar, yenisi alttan gelir. */
export const tickerProps = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: spring.snap,
} as const;

/**
 * Tema geçişi: tıklanan noktadan büyüyen dairesel açılış.
 *
 * View Transitions destekliyse yeni tema, eski tema görüntüsünün üstünü
 * daire büyüterek örter. Desteklemeyen tarayıcıda ya da kullanıcı hareketi
 * azaltmayı seçtiyse geçiş anında uygulanır.
 */
export function circularThemeSwap(origin: { x: number; y: number }, apply: () => void, reduced: boolean) {
  const doc = document as Document & {
    startViewTransition?: (callback: () => void) => { ready: Promise<void> };
  };

  if (reduced || typeof doc.startViewTransition !== "function") {
    apply();
    return;
  }

  const { x, y } = origin;
  const radius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y),
  );

  doc.startViewTransition(apply).ready.then(() => {
    document.documentElement.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
      {
        duration: 520,
        easing: "cubic-bezier(0.4, 0, 0.2, 1)",
        pseudoElement: "::view-transition-new(root)",
      },
    );
  }).catch(() => {
    // Geçiş iptal edilirse tema zaten uygulanmış olur; ek işlem gerekmez.
  });
}
