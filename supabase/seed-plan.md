# Supabase Seed Plan

Bu proje için ilk super admin seed işlemi manuel ve tek seferlik hazırlanacaktır.

Plan:
1. `SESSION_SECRET` ve Supabase bağlantı değişkenleri gerçek ortamda tanımlanır.
2. İlk `SUPER_ADMIN` için email belirlenir.
3. Şifre uygulama koduna gömülmez.
4. Şifre bir kez güvenli ortamda üretilir ve hash olarak seed işlemine verilir.
5. Seed sonrası `users` tablosunda `role = 'SUPER_ADMIN'` ve `business_id = null` olacak kayıt oluşturulur.
6. Oluşturulan kayıt doğrulanır ve seed mekanizması tekrar çalıştırılmaz.

Not:
- Parola kod içinde hardcode edilmez.
- Seed yalnızca başlangıç içindir, çalışma zamanında otomatik tekrarlanmaz.
