"use client";

import { MotionConfig } from "motion/react";

/**
 * Uygulama genelinde hareket politikası. `reducedMotion="user"` ile Motion,
 * kullanıcının işletim sistemi "hareketi azalt" tercihini otomatik uygular:
 * konum/ölçek gibi dönüşümler atlanır, yalnızca opaklık geçişleri kalır.
 * globals.css'teki reduced-motion kuralı CSS animasyonlarını kapatır; bu da
 * JS tabanlı Motion animasyonlarını kapsar.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
