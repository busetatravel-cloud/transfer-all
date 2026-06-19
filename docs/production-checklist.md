# Production / Canlıya Hazırlık Checklist

## Supabase Env
- [ ] `NEXT_PUBLIC_SUPABASE_URL` tanımlı.
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` tanımlı.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` tanımlı.
- [ ] Gerekirse `SUPABASE_URL` alias olarak tanımlı.
- [ ] Veritabanı bağlantısı prod ortamda doğrulandı.

## Supabase Migrations
- [ ] Tüm migrationlar prod ortamda çalıştırıldı.
- [ ] Rezervasyon şema migrationları uygulandı.
- [ ] Voucher, notification, analytics, domain, media ve deploy migrationları uygulandı.
- [ ] `business-media` storage ve ilgili tablo/migrationlar hazır.
- [ ] Geriye dönük uyumluluk kontrol edildi.

## Supabase Storage Bucket
- [ ] `business-media` bucket oluşturuldu.
- [ ] Public erişim ihtiyacı doğrulandı.
- [ ] Upload path yapısı `businessId/slot/fileName` şeklinde.
- [ ] Placeholder medya fallback akışı test edildi.

## SESSION_SECRET
- [ ] `SESSION_SECRET` güçlü bir değer ile tanımlı.
- [ ] Geliştirme varsayılanı prod ortamda kullanılmıyor.
- [ ] Oturum imza doğrulaması test edildi.

## Vercel Env
- [ ] Vercel proje env değişkenleri tanımlı.
- [ ] Preview ve production env değerleri ayrıldı.
- [ ] Domain bazlı yönlendirme prod host ile test edildi.

## Domain Bağlantısı
- [ ] Business domain kaydı doğrulandı.
- [ ] `pending`, `dns_detected`, `verified`, `active`, `failed` akışı kontrol edildi.
- [ ] Public site yalnızca active domain ile açılıyor.
- [ ] Preview route domain bağımsız çalışıyor.

## Mail Env
- [ ] `MAIL_FROM_EMAIL` tanımlı.
- [ ] `RESEND_API_KEY` tanımlıysa Resend gönderimi deneniyor.
- [ ] `RESEND_FROM_EMAIL` gerekiyorsa tanımlı.
- [ ] `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_SECURE` tanımlıysa SMTP deneniyor.
- [ ] `SMTP_FROM_EMAIL` gerekiyorsa tanımlı.
- [ ] Env eksikse placeholder gönderim bozmadan çalışıyor.

## WhatsApp Env
- [ ] `WHATSAPP_META_TOKEN` tanımlıysa Meta adapter aktif.
- [ ] `WHATSAPP_META_PHONE_NUMBER_ID` tanımlıysa Meta adapter aktif.
- [ ] `WHATSAPP_META_FROM` veya `WHATSAPP_FROM` gerekiyorsa tanımlı.
- [ ] `TWILIO_ACCOUNT_SID` tanımlıysa Twilio adapter aktif.
- [ ] `TWILIO_AUTH_TOKEN` tanımlıysa Twilio adapter aktif.
- [ ] `TWILIO_WHATSAPP_FROM` veya `WHATSAPP_FROM` gerekiyorsa tanımlı.
- [ ] Env eksikse placeholder gönderim bozmadan çalışıyor.

## Admin Seed
- [ ] Super admin seed bilgileri tanımlı.
- [ ] Gerekirse demo seed env'leri ayarlı:
- [ ] `DEMO_SUPER_ADMIN_EMAIL`
- [ ] `DEMO_SUPER_ADMIN_PASSWORD`
- [ ] `DEMO_BUSINESS_ADMIN_EMAIL`
- [ ] `DEMO_BUSINESS_ADMIN_PASSWORD`

## Build Kontrol
- [ ] `npm run lint` temiz.
- [ ] `npm run build` temiz.
- [ ] Production build sırasında type error yok.

## Güvenlik Kontrol
- [ ] Business admin endpointleri yalnızca kendi `businessId` verisini görüyor.
- [ ] Super admin endpointleri yalnızca `SUPER_ADMIN` rolü ile erişiliyor.
- [ ] Public booking ve voucher akışlarında business izolasyonu korunuyor.
- [ ] `SESSION_SECRET` ve servis anahtarları source control içinde değil.
- [ ] Hassas veri loglanmıyor.

## Backup / Rollback
- [ ] Migration rollback planı mevcut.
- [ ] Supabase snapshot / backup düzeni doğrulandı.
- [ ] Kritik tablolar için geri dönüş sırası not edildi.
- [ ] Yeni deploy öncesi son çalışan build etiketlendi.

## Fallback Davranışı
- Supabase env eksikse demo/veri katmanı placeholder ile çalışır.
- Mail env eksikse `sent_placeholder` ile kayıt oluşturulur.
- WhatsApp env eksikse `sent_placeholder` ile kayıt oluşturulur.
- Storage env veya bucket erişimi yoksa medya placeholder akışı korunur.
- Session secret dev varsayılanı sadece geliştirme için kullanılmalıdır.

## Gerekli Env Değişkenleri
### Zorunlu
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SESSION_SECRET`

### Önerilen
- `SUPABASE_URL`
- `BUSINESS_MEDIA_BUCKET`
- `MAIL_FROM_EMAIL`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASSWORD`
- `SMTP_SECURE`
- `SMTP_FROM_EMAIL`
- `WHATSAPP_META_TOKEN`
- `WHATSAPP_META_PHONE_NUMBER_ID`
- `WHATSAPP_META_FROM`
- `WHATSAPP_FROM`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_WHATSAPP_FROM`

### Demo Seed
- `DEMO_SUPER_ADMIN_EMAIL`
- `DEMO_SUPER_ADMIN_PASSWORD`
- `DEMO_BUSINESS_ADMIN_EMAIL`
- `DEMO_BUSINESS_ADMIN_PASSWORD`

