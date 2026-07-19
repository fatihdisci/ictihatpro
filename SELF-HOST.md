# Mac mini üzerinde çalıştırma

## 1. Kurulum

```bash
cd /projenin/tam/yolu/ictihat-asistani
npm install
cp .env.example .env.local
openssl rand -hex 32
```

Üretilen rastgele değeri `.env.local` içindeki `SESSION_SECRET` alanına yazın. DeepSeek anahtarı, model ve uygulama parolasını da doldurun.

```bash
npm run build
npm run start
```

`http://localhost:3000` açılıyorsa kurulum tamamdır.

## 2. Otomatik başlatma

`deploy/com.chillandbuild.ictihat.plist` içindeki iki örnek proje yolunu gerçek tam yolunuzla değiştirin. Ardından:

```bash
chmod +x deploy/run.sh
cp deploy/com.chillandbuild.ictihat.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.chillandbuild.ictihat.plist
```

Güncellemeden sonra:

```bash
npm install
npm run build
launchctl kickstart -k gui/$(id -u)/com.chillandbuild.ictihat
```

## 3. Dışarıdan erişim

Sadece kendi cihazlarınız kullanacaksa Tailscale en kapalı seçenektir. HTTP üzerinden Tailscale IP'si kullanacaksanız `.env.local` içine şunu ekleyin:

```dotenv
COOKIE_SECURE=false
```

Cloudflare Tunnel ve HTTPS kullanacaksanız varsayılan `COOKIE_SECURE=auto` yeterlidir. Uygulamayı doğrudan modem port yönlendirmesiyle internete açmayın.

## 4. Önbellek

Kararlar varsayılan olarak `~/.ictihat-asistani/cache/` altında, yalnızca kullanıcı hesabının okuyabileceği izinlerle saklanır. Başka bir konum için `CACHE_DIR` tanımlayın.
