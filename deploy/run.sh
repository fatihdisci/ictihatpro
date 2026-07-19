#!/bin/bash
# Next.js üretim sunucusunu başlatır. launchd bunu çağırır.
# Proje kökünü otomatik bulur.
cd "$(dirname "$0")/.." || exit 1

# Homebrew node yolunu PATH'e ekle (launchd minimal ortamla başlar)
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

export PORT="${PORT:-3000}"
# .env.local Next.js tarafından otomatik yüklenir (API anahtarı, APP_PASSWORD)

exec npm run start
