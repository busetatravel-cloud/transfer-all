"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import type { BusinessPanelData } from "@/lib/business-panel";

type Props = {
  panel: BusinessPanelData;
};

type SaveState = {
  status: "idle" | "saving" | "saved" | "error";
  message: string;
};

export function BusinessPanelEditor({ panel }: Props) {
  const router = useRouter();
  const [state, setState] = useState<SaveState>({
    status: "idle",
    message: "",
  });
  const [isPending, startTransition] = useTransition();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const body = Object.fromEntries(formData.entries());
    setState({ status: "saving", message: "Kaydediliyor..." });

    const response = await fetch("/api/business/panel", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      setState({
        status: "error",
        message: payload?.error ?? "Kaydetme basarisiz.",
      });
      return;
    }

    setState({
      status: "saved",
      message: "Kaydedildi.",
    });
    form.reset();

    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <section className="grid gap-6">
      <Notice state={state} pending={isPending} />

      <Grid>
        <FormCard title="Firma bilgileri" description="Ad, e-posta, telefon ve WhatsApp bilgisini düzenle.">
          <form className="grid gap-3" onSubmit={submit}>
            <input type="hidden" name="section" value="business" />
            <Field name="name" label="Firma adi" defaultValue={panel.business?.name ?? ""} />
            <Field name="email" label="Firma email" defaultValue={panel.business?.email ?? ""} />
            <Field name="phone" label="Telefon" defaultValue={panel.business?.phone ?? ""} />
            <Field name="whatsapp" label="WhatsApp" defaultValue={panel.business?.whatsapp ?? ""} />
            <button className={buttonClass} type="submit">Kaydet</button>
          </form>
        </FormCard>

        <FormCard title="Logo URL" description="Sadece logo adresini güncelle.">
          <form className="grid gap-3" onSubmit={submit}>
            <input type="hidden" name="section" value="logo" />
            <Field
              name="logoUrl"
              label="Logo URL"
              defaultValue={panel.business?.logoUrl ?? ""}
              placeholder="https://..."
            />
            <button className={buttonClass} type="submit">Kaydet</button>
          </form>
        </FormCard>

        <FormCard title="Hero alanı" description="Ana sayfa başlığı, alt metin ve buton yazısı.">
          <form className="grid gap-3" onSubmit={submit}>
            <input type="hidden" name="section" value="hero" />
            <Field name="heroTitle" label="Hero baslik" defaultValue={panel.profile.heroTitle} />
            <Field name="heroSubtitle" label="Hero alt metin" defaultValue={panel.profile.heroSubtitle} />
            <Field name="heroButtonText" label="Buton yazisi" defaultValue={panel.profile.heroButtonText} />
            <button className={buttonClass} type="submit">Kaydet</button>
          </form>
        </FormCard>

        <FormCard title="SEO" description="Temel meta başlık ve açıklama.">
          <form className="grid gap-3" onSubmit={submit}>
            <input type="hidden" name="section" value="seo" />
            <Field name="metaTitle" label="Meta baslik" defaultValue={panel.seo.metaTitle} />
            <Field
              name="metaDescription"
              label="Meta aciklama"
              defaultValue={panel.seo.metaDescription}
            />
            <button className={buttonClass} type="submit">Kaydet</button>
          </form>
        </FormCard>

        <FormCard title="Dil kaydi" description="Temel dil yapısını oluştur.">
          <form className="grid gap-3" onSubmit={submit}>
            <input type="hidden" name="section" value="locale" />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field name="code" label="Kod" placeholder="tr" />
              <Field name="name" label="Dil adi" placeholder="Turkce" />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Check name="active" label="Aktif" />
              <Check name="published" label="Yayinda" />
              <Check name="translationComplete" label="Ceviri tamam" />
            </div>
            <button className={buttonClass} type="submit">Kaydet</button>
          </form>
        </FormCard>
      </Grid>

      <Grid>
        <CollectionCard
          title="Hizmetler"
          description="Kısa hizmet kayıtları."
          section="service"
          items={panel.services}
          submit={submit}
          fields={
            <>
              <Field name="title" label="Hizmet adi" placeholder="Airport Transfer" />
              <Field name="description" label="Aciklama" placeholder="..." />
            </>
          }
        />

        <CollectionCard
          title="Araçlar"
          description="Araç kategorileri."
          section="vehicle"
          items={panel.vehicles}
          submit={submit}
          fields={
            <>
              <Field name="title" label="Araç adi" placeholder="VIP Van" />
              <Field name="description" label="Aciklama" placeholder="..." />
            </>
          }
        />

        <CollectionCard
          title="Rotalar"
          description="Popüler transfer rotaları."
          section="route"
          items={panel.routes}
          submit={submit}
          fields={
            <>
              <Field name="title" label="Rota adi" placeholder="Airport - City" />
              <Field name="description" label="Aciklama" placeholder="..." />
            </>
          }
        />

        <CollectionCard
          title="Blog"
          description="Basit yazı kaydı."
          section="blog"
          items={panel.blogs}
          submit={submit}
          fields={
            <>
              <Field name="title" label="Yazi basligi" placeholder="Transfer ipuclari" />
              <Field name="slug" label="Slug" placeholder="transfer-ipuclari" />
              <Field name="excerpt" label="Kisa ozet" placeholder="..." />
              <Field name="content" label="Icerik" placeholder="..." />
            </>
          }
        />
      </Grid>
    </section>
  );
}

function CollectionCard({
  title,
  description,
  section,
  items,
  submit,
  fields,
}: {
  title: string;
  description: string;
  section: "service" | "vehicle" | "route" | "blog";
  items: Array<{
    id: string;
    title: string;
    description?: string;
    excerpt?: string;
  }>;
  submit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  fields: ReactNode;
}) {
  return (
    <FormCard title={title} description={description}>
      <form className="grid gap-3" onSubmit={submit}>
        <input type="hidden" name="section" value={section} />
        {fields}
        <button className={buttonClass} type="submit">Ekle</button>
      </form>
      <div className="mt-4 grid gap-2">
        {items.length ? (
          items.map((item) => (
            <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="font-medium text-slate-900">{item.title}</div>
              <div className="text-sm text-slate-600">
                {item.description ?? item.excerpt ?? ""}
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-500">Henüz kayıt yok.</p>
        )}
      </div>
    </FormCard>
  );
}

function FormCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <article className="rounded-[24px] border border-slate-200 bg-white p-5">
      <div className="mb-4">
        <h3 className="text-xl font-semibold text-slate-900">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
      </div>
      {children}
    </article>
  );
}

function Grid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 lg:grid-cols-2">{children}</div>;
}

function Field({
  name,
  label,
  defaultValue,
  placeholder,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  placeholder?: string;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
      />
    </label>
  );
}

function Check({ name, label }: { name: string; label: string }) {
  return (
    <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
      <input name={name} type="checkbox" value="true" className="h-4 w-4" />
      <span>{label}</span>
    </label>
  );
}

function Notice({ state, pending }: { state: SaveState; pending: boolean }) {
  const hidden = state.status === "idle" && !pending;
  if (hidden) return null;

  const tone =
    state.status === "error"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : state.status === "saved"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : "border-slate-200 bg-white text-slate-700";

  return (
    <div className={`rounded-[24px] border px-5 py-4 text-sm ${tone}`}>
      {state.message}
    </div>
  );
}

const buttonClass =
  "inline-flex h-11 items-center justify-center rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800";
