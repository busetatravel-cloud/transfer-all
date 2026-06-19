import type { BusinessTaskPriority, BusinessTaskStatus } from "@/lib/task-types";

export const TASK_LABELS = {
  title: "Başlık",
  description: "Açıklama",
  reservation: "İlgili rezervasyon",
  customer: "Müşteri",
  dueDate: "Tarih",
  dueTime: "Saat",
  priority: "Öncelik",
  status: "Durum",
  create: "Görev oluştur",
  update: "Görevi güncelle",
  empty: "Henüz görev yok.",
  pageTitle: "Görevler",
  pageDescription: "Görevleri ve hatırlatmaları business içinde takip et.",
  today: "Bugün",
  overdue: "Geciken",
  upcoming: "Yaklaşan",
  completed: "Tamamlanan",
  all: "Tüm görevler",
  createFromReservation: "Rezervasyondan görev oluştur",
  reservationTask: "Rezervasyon görevi",
} as const;

export const TASK_STATUS_OPTIONS: BusinessTaskStatus[] = [
  "Bekliyor",
  "Devam Ediyor",
  "Tamamlandı",
  "İptal",
];

export const TASK_PRIORITY_OPTIONS: BusinessTaskPriority[] = [
  "Düşük",
  "Normal",
  "Yüksek",
  "Acil",
];

