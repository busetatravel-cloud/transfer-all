export type BusinessTaskStatus = "Bekliyor" | "Devam Ediyor" | "Tamamlandı" | "İptal";

export type BusinessTaskPriority = "Düşük" | "Normal" | "Yüksek" | "Acil";

export type BusinessTaskRecord = {
  id: string;
  businessId: string;
  title: string;
  description: string | null;
  reservationId: string | null;
  customerName: string | null;
  dueDate: string | null;
  dueTime: string | null;
  priority: BusinessTaskPriority;
  status: BusinessTaskStatus;
  createdAt: string;
  updatedAt: string;
};

export type BusinessTaskCreateInput = {
  title: string;
  description?: string;
  reservationId?: string;
  customerName?: string;
  dueDate?: string;
  dueTime?: string;
  priority?: BusinessTaskPriority;
  status?: BusinessTaskStatus;
};

export type BusinessTaskUpdateInput = Partial<BusinessTaskCreateInput> & {
  recordId: string;
};
