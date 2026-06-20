# Production deploy seçenekleri

Bu proje için tek doğru public alan adı mantığı `business.hostname` üzerinden kurulur.
`PUBLIC_DOMAIN_TARGET` yalnızca altyapı/DNS yönlendirme hedefidir; public site linki değildir.

Repo durumu:

- Yerel kopyada Git remote tanımlı görünmüyor.
- Manuel GitHub/Vercel akışı olmadan da Docker VPS veya platform deploy ile çalışacak şekilde hazırlanmıştır.

## Ortak gereksinimler

- Node 20+
- `npm ci`
- `npm run build`
- Supabase env’leri
- `SESSION_SECRET`
- Production’da doğru `business.hostname`

## 1) Vercel

Gerekli hesap:

- Vercel hesabı
- Supabase hesabı

Gerekli env:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SESSION_SECRET`
- `PUBLIC_DOMAIN_TARGET` yalnızca DNS rehberi için
- AI kullanılıyorsa:
  - `OPENAI_API_KEY`
  - `OPENAI_TRANSLATION_MODEL`
  - `OPENAI_BASE_URL`

Build command:

- `npm run build`

Start command:

- Vercel tarafında ayrı start komutu gerekmez.

Domain bağlama yöntemi:

- Business domain için `hostname` kaydı kullanılır.
- DNS tarafında root için `A 76.76.21.21`, www/subdomain için `CNAME`.
- `PUBLIC_DOMAIN_TARGET` varsa sadece DNS rehberinde gösterilir.

## 2) Netlify

Gerekli hesap:

- Netlify hesabı
- Supabase hesabı

Gerekli env:

- Vercel bölümündeki tüm temel env’ler
- `PUBLIC_DOMAIN_TARGET` yalnızca DNS rehberi için

Build command:

- `npm run build`

Start command:

- Netlify’de uygulama serverless/edge runtime ile yayınlanır; ayrı klasik start komutu kullanılmaz.

Domain bağlama yöntemi:

- Custom domain eklenir.
- DNS, business hostname üzerinden çözümlenir.
- Public link yine `https://${business.hostname}` mantığıyla çalışır.

## 3) Render

Gerekli hesap:

- Render hesabı
- Supabase hesabı

Gerekli env:

- Temel Supabase env’leri
- `SESSION_SECRET`
- `PUBLIC_DOMAIN_TARGET` yalnızca DNS rehberi için
- AI env’leri opsiyonel

Build command:

- `npm ci && npm run build`

Start command:

- `npm run start`

Domain bağlama yöntemi:

- Render custom domain eklenir.
- DNS CNAME/A kayıtları business hostname için yönlendirilir.
- `PUBLIC_DOMAIN_TARGET` deploy hedefi olarak kullanılır, public link olarak kullanılmaz.

## 4) Docker VPS

Gerekli hesap:

- VPS sağlayıcısı
- Domain registrar/DNS paneli
- Supabase hesabı

Gerekli env:

- `.env.production` içindeki tüm zorunlu env’ler
- `PUBLIC_DOMAIN_TARGET` varsa yalnızca DNS rehberi için

Build command:

- `docker compose -f docker-compose.production.yml up --build -d`

Start command:

- Container içinde `node server.js`

Domain bağlama yöntemi:

- VPS IP’sine DNS A kaydı verilir.
- Uygulama dışarıya 3000 portundan veya reverse proxy arkasından açılır.
- Business public domain yine `business.hostname` ile eşleşir.

## Tavsiye edilen akış

1. Önce Supabase env’lerini ve `SESSION_SECRET`’ı ayarla.
2. Sonra production deploy hedefini belirle.
3. Ardından business hostname’i DNS ile public siteye bağla.
4. En son `domain_status` ve `ssl_status` akışını doğrula.

## Not

Bu projede public sitenin gerçek adresi:

- `https://${business.hostname}`

`PUBLIC_DOMAIN_TARGET` bu adresin yerine geçmez; yalnızca altyapı tarafında DNS hedefi olarak kullanılabilir.
