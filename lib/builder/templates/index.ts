// Template Registry'yi doldurmanın TEK yeri — her template dosyası kendi
// modülü yüklendiğinde (top-level) registerTemplate() çağırır. Yeni bir
// template eklemek için: (1) lib/builder/templates/<yeni-template>.ts
// dosyasını oluştur, (2) burada TEK bir side-effect import satırı ekle.
// Mevcut template dosyalarına dokunmak gerekmez.
import "@/lib/builder/templates/modern-transfer";
import "@/lib/builder/templates/luxury-vip";
import "@/lib/builder/templates/airport-shuttle";

export { modernTransferTemplate } from "@/lib/builder/templates/modern-transfer";
export { luxuryVipTemplate } from "@/lib/builder/templates/luxury-vip";
export { airportShuttleTemplate } from "@/lib/builder/templates/airport-shuttle";
