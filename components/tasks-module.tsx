"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { BusinessTaskRecord, BusinessTaskStatus } from "@/lib/task-types";
import { TASK_LABELS, TASK_PRIORITY_OPTIONS, TASK_STATUS_OPTIONS } from "@/lib/task-ui";

type Props = {
  businessId: string;
  initialTasks: BusinessTaskRecord[];
};

type SaveState = {
  status: "idle" | "saving" | "success" | "error";
  message: string;
};

type TaskFormState = {
  title: string;
  description: string;
  reservationId: string;
  customerName: string;
  dueDate: string;
  dueTime: string;
  priority: string;
  status: string;
};

type TaskFilter = "all" | "today" | "overdue" | "upcoming" | "completed";

function emptyTaskForm(): TaskFormState {
  return {
    title: "",
    description: "",
    reservationId: "",
    customerName: "",
    dueDate: "",
    dueTime: "",
    priority: "Normal",
    status: "Bekliyor",
  };
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function normalizeText(value: string | null | undefined) {
  return String(value ?? "").trim();
}

export function TasksModule({ businessId, initialTasks }: Props) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initialTasks);
  const [form, setForm] = useState<TaskFormState>(emptyTaskForm());
  const [state, setState] = useState<SaveState>({ status: "idle", message: "" });
  const [filter, setFilter] = useState<TaskFilter>("today");
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  const todayKey = toDateKey(new Date());
  const upcomingEndKey = toDateKey(addDays(new Date(), 7));

  const sortedTasks = useMemo(() => {
    return [...tasks].sort((left, right) => {
      const leftDate = `${left.dueDate ?? ""} ${left.dueTime ?? ""}`;
      const rightDate = `${right.dueDate ?? ""} ${right.dueTime ?? ""}`;
      return leftDate.localeCompare(rightDate) || right.createdAt.localeCompare(left.createdAt);
    });
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    return sortedTasks.filter((task) => {
      const dueDate = normalizeText(task.dueDate);
      const isCompleted = task.status === "Tamamlandı";

      if (filter === "completed") return isCompleted;
      if (filter === "today") return dueDate === todayKey && !isCompleted;
      if (filter === "overdue") return dueDate ? dueDate < todayKey && !isCompleted : false;
      if (filter === "upcoming") return dueDate >= todayKey && dueDate <= upcomingEndKey && !isCompleted;
      return true;
    });
  }, [sortedTasks, filter, todayKey, upcomingEndKey]);

  async function refreshTasks() {
    const response = await fetch("/api/business/tasks", { method: "GET" });
    const body = (await response.json().catch(() => null)) as
      | { tasks?: BusinessTaskRecord[]; message?: string; code?: string }
      | null;

    if (!response.ok) {
      throw new Error(body?.message || body?.code || "Görevler alınamadı.");
    }

    setTasks(body?.tasks ?? []);
  }

  function startEdit(task: BusinessTaskRecord) {
    setEditingTaskId(task.id);
    setForm({
      title: task.title,
      description: task.description ?? "",
      reservationId: task.reservationId ?? "",
      customerName: task.customerName ?? "",
      dueDate: task.dueDate ?? "",
      dueTime: task.dueTime ?? "",
      priority: task.priority,
      status: task.status,
    });
    setState({ status: "idle", message: "" });
  }

  function cancelEdit() {
    setEditingTaskId(null);
    setForm(emptyTaskForm());
    setState({ status: "idle", message: "" });
  }

  async function submitTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ status: "saving", message: "Kaydediliyor..." });

    try {
      const response = await fetch(
        editingTaskId ? `/api/business/tasks/${editingTaskId}` : "/api/business/tasks",
        {
          method: editingTaskId ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            action: editingTaskId ? "update" : "create",
            title: form.title,
            description: form.description,
            reservationId: form.reservationId,
            customerName: form.customerName,
            dueDate: form.dueDate,
            dueTime: form.dueTime,
            priority: form.priority,
            status: form.status,
          }),
        },
      );

      const body = (await response.json().catch(() => null)) as
        | { message?: string; code?: string }
        | string
        | null;

      if (!response.ok) {
        throw new Error(
          typeof body === "string" ? body : body?.message || body?.code || "Görev kaydedilemedi.",
        );
      }

      await refreshTasks();
      setForm(emptyTaskForm());
      setEditingTaskId(null);
      setState({
        status: "success",
        message: editingTaskId ? "Görev güncellendi." : "Görev oluşturuldu.",
      });
      router.refresh();
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "Görev kaydedilemedi.",
      });
    }
  }

  async function quickStatusUpdate(taskId: string, status: BusinessTaskStatus) {
    const response = await fetch(`/api/business/tasks/${taskId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ status }),
    });

    if (!response.ok) {
      return;
    }

    await refreshTasks();
  }

  async function removeTask(taskId: string) {
    const ok = window.confirm("Bu görevi silmek istiyor musunuz?");

    if (!ok) {
      return;
    }

    const response = await fetch(`/api/business/tasks/${taskId}`, {
      method: "DELETE",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as
        | { message?: string; code?: string }
        | string
        | null;
      setState({
        status: "error",
        message:
          typeof body === "string" ? body : body?.message || body?.code || "Görev silinemedi.",
      });
      return;
    }

    await refreshTasks();
    if (editingTaskId === taskId) {
      cancelEdit();
    }
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <div className="grid gap-4 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-1">
          <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Görevler</div>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
            {editingTaskId ? TASK_LABELS.update : TASK_LABELS.create}
          </h2>
          <p className="text-sm text-slate-600">{TASK_LABELS.pageDescription}</p>
          <p className="text-xs text-slate-500">Business ID: {businessId}</p>
        </div>

        {state.message ? (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm ${
              state.status === "error"
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : state.status === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 bg-slate-50 text-slate-700"
            }`}
          >
            {state.message}
          </div>
        ) : null}

        <form className="grid gap-4" onSubmit={submitTask}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field
              label={TASK_LABELS.title}
              value={form.title}
              onChange={(value) => setForm((current) => ({ ...current, title: value }))}
            />
            <Field
              label={TASK_LABELS.customer}
              value={form.customerName}
              onChange={(value) => setForm((current) => ({ ...current, customerName: value }))}
            />
            <Field
              label={TASK_LABELS.reservation}
              value={form.reservationId}
              onChange={(value) => setForm((current) => ({ ...current, reservationId: value }))}
            />
            <Field
              label={TASK_LABELS.dueDate}
              type="date"
              value={form.dueDate}
              onChange={(value) => setForm((current) => ({ ...current, dueDate: value }))}
            />
            <Field
              label={TASK_LABELS.dueTime}
              type="time"
              value={form.dueTime}
              onChange={(value) => setForm((current) => ({ ...current, dueTime: value }))}
            />
            <SelectField
              label={TASK_LABELS.priority}
              value={form.priority}
              options={TASK_PRIORITY_OPTIONS}
              onChange={(value) => setForm((current) => ({ ...current, priority: value }))}
            />
            <SelectField
              label={TASK_LABELS.status}
              value={form.status}
              options={TASK_STATUS_OPTIONS}
              onChange={(value) => setForm((current) => ({ ...current, status: value }))}
            />
          </div>
          <TextArea
            label={TASK_LABELS.description}
            value={form.description}
            onChange={(value) => setForm((current) => ({ ...current, description: value }))}
          />
          <div className="flex flex-wrap gap-2">
            <button
              className="inline-flex h-11 items-center justify-center rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
              disabled={state.status === "saving"}
              type="submit"
            >
              {editingTaskId ? TASK_LABELS.update : TASK_LABELS.create}
            </button>
            {editingTaskId ? (
              <button
                className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                type="button"
                onClick={cancelEdit}
              >
                İptal
              </button>
            ) : null}
          </div>
        </form>
      </div>

      <div className="grid gap-4">
        <div className="flex flex-wrap gap-2">
          <ChipButton active={filter === "today"} onClick={() => setFilter("today")}>
            {TASK_LABELS.today}
          </ChipButton>
          <ChipButton active={filter === "overdue"} onClick={() => setFilter("overdue")}>
            {TASK_LABELS.overdue}
          </ChipButton>
          <ChipButton active={filter === "upcoming"} onClick={() => setFilter("upcoming")}>
            {TASK_LABELS.upcoming}
          </ChipButton>
          <ChipButton active={filter === "completed"} onClick={() => setFilter("completed")}>
            {TASK_LABELS.completed}
          </ChipButton>
          <ChipButton active={filter === "all"} onClick={() => setFilter("all")}>
            {TASK_LABELS.all}
          </ChipButton>
        </div>

        <div className="grid gap-3">
          {filteredTasks.length ? (
            filteredTasks.map((task) => (
              <article
                key={task.id}
                className="grid gap-3 rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="grid gap-1">
                    <div className="text-lg font-semibold text-slate-950">{task.title}</div>
                    <div className="text-sm text-slate-600">{task.customerName || "-"}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge>{task.priority}</Badge>
                    <Badge>{task.status}</Badge>
                  </div>
                </div>
                <div className="grid gap-2 text-sm text-slate-700 sm:grid-cols-2 xl:grid-cols-3">
                  <Info label={TASK_LABELS.reservation} value={task.reservationId || "-"} />
                  <Info label={TASK_LABELS.dueDate} value={task.dueDate || "-"} />
                  <Info label={TASK_LABELS.dueTime} value={task.dueTime || "-"} />
                  <Info label={TASK_LABELS.description} value={task.description || "-"} />
                </div>
                <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                  <SelectField
                    label={TASK_LABELS.status}
                    value={task.status}
                    options={TASK_STATUS_OPTIONS}
                    onChange={(value) => void quickStatusUpdate(task.id, value as BusinessTaskStatus)}
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                      onClick={() => startEdit(task)}
                    >
                      Düzenle
                    </button>
                    <button
                      type="button"
                      className="inline-flex h-11 items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 px-4 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100"
                      onClick={() => void removeTask(task.id)}
                    >
                      Sil
                    </button>
                  </div>
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-[28px] border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">
              {TASK_LABELS.empty}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      <input
        className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-950 outline-none transition focus:border-slate-400"
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      <select
        className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-950 outline-none transition focus:border-slate-400"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      <textarea
        className="min-h-28 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function ChipButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      className={`inline-flex h-10 items-center justify-center rounded-2xl px-4 text-sm font-semibold transition ${
        active
          ? "border border-slate-900 bg-slate-900 text-white"
          : "border border-slate-200 bg-white text-slate-700 hover:border-slate-300"
      }`}
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function Badge({ children }: { children: string }) {
  return (
    <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
      {children}
    </span>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 rounded-[22px] border border-slate-200 bg-white p-4">
      <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">{label}</div>
      <div className="text-sm font-medium text-slate-950">{value}</div>
    </div>
  );
}
