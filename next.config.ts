import type { NextConfig } from "next";

// `next dev`'in webpack modülleri "eval-source-map" ile sarmalaması
// `unsafe-eval` gerektirir; bu izin olmadan client bundle hiç
// çalışmaz ve uygulama hidrasyon öncesi yükleme ekranında sonsuza dek
// kalır. Üretim derlemesi eval kullanmadığı için orada bu gevşetmeye
// gerek yoktur.
const scriptSrc = process.env.NODE_ENV === "development" ? "'self' 'unsafe-inline' 'unsafe-eval'" : "'self' 'unsafe-inline'";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Content-Security-Policy",
            value:
              `default-src 'self'; script-src ${scriptSrc}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
