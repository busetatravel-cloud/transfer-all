import "server-only";

import { getBusinessPanelData } from "@/lib/business-panel";
import { listTasks } from "@/lib/tasks";

export type SearchResultType =
  | "Rezervasyon"
  | "Müşteri"
  | "Görev"
  | "Hizmet"
  | "Araç"
  | "Rota"
  | "Blog";

export type SearchResult = {
  type: SearchResultType;
  title: string;
  description: string;
  href: string;
};

function normalizeText(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

function matchesQuery(values: Array<string | null | undefined>, query: string) {
  if (!query) {
    return false;
  }

  return values.some((value) => normalizeText(value).includes(query));
}

export async function searchBusinessContent(businessId: string, rawQuery: string) {
  const query = normalizeText(rawQuery);

  if (!query) {
    return [] as SearchResult[];
  }

  const panel = await getBusinessPanelData(businessId);
  const tasks = await listTasks(businessId);
  const results: SearchResult[] = [];

  for (const reservation of panel.requests) {
    if (
      matchesQuery(
        [
          reservation.customerName,
          reservation.phone,
          reservation.origin,
          reservation.destination,
          reservation.flightCode,
          reservation.bookingStatus,
          reservation.paymentStatus,
          reservation.message,
        ],
        query,
      )
    ) {
      results.push({
        type: "Rezervasyon",
        title: reservation.customerName,
        description: [
          reservation.origin,
          reservation.destination,
          reservation.travelDate,
          reservation.travelTime,
          reservation.bookingStatus,
        ]
          .filter(Boolean)
          .join(" • "),
        href: "/app/reservations",
      });
    }
  }

  for (const customer of panel.customers) {
    if (matchesQuery([customer.fullName, customer.phone, customer.email, customer.country, customer.notes], query)) {
      results.push({
        type: "Müşteri",
        title: customer.fullName,
        description: [customer.phone, customer.email, customer.country].filter(Boolean).join(" • "),
        href: "/app/customers",
      });
    }
  }

  for (const task of tasks) {
    if (matchesQuery([task.title, task.description, task.customerName, task.reservationId, task.status], query)) {
      results.push({
        type: "Görev",
        title: task.title,
        description: [task.customerName, task.dueDate, task.dueTime, task.status].filter(Boolean).join(" • "),
        href: "/app/tasks",
      });
    }
  }

  for (const service of panel.services) {
    if (matchesQuery([service.title, service.description, service.slug], query)) {
      results.push({
        type: "Hizmet",
        title: service.title,
        description: service.description,
        href: "/app/services",
      });
    }
  }

  for (const vehicle of panel.vehicles) {
    if (matchesQuery([vehicle.title, vehicle.description, vehicle.slug], query)) {
      results.push({
        type: "Araç",
        title: vehicle.title,
        description: vehicle.description,
        href: "/app/vehicles",
      });
    }
  }

  for (const route of panel.routes) {
    if (matchesQuery([route.title, route.description, route.slug], query)) {
      results.push({
        type: "Rota",
        title: route.title,
        description: route.description,
        href: "/app/routes",
      });
    }
  }

  for (const post of panel.blogs) {
    if (matchesQuery([post.title, post.excerpt, post.content, post.slug], query)) {
      results.push({
        type: "Blog",
        title: post.title,
        description: post.excerpt || post.content,
        href: "/app/blog",
      });
    }
  }

  return results;
}
