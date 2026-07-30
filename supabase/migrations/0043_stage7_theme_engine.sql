create table if not exists public.business_theme_settings (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  template_key text not null default 'modern',
  primary_color text not null default '#0f172a',
  secondary_color text not null default '#f97316',
  background_color text not null default '#f8fafc',
  surface_color text not null default '#ffffff',
  text_color text not null default '#0f172a',
  border_radius text not null default 'lg',
  shadow text not null default 'soft',
  font_family text not null default 'Inter, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  color_mode text not null default 'light',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_business_theme_settings_updated_at on public.business_theme_settings;
create trigger trg_business_theme_settings_updated_at
before update on public.business_theme_settings
for each row execute function touch_updated_at();

-- template_key kasıtlı olarak kısıtlanmıyor: yeni bir tema eklemek yalnızca
-- lib/theme-registry.ts'e kayıt eklemekle olmalı, her yeni tema için ayrı bir
-- migration (constraint güncellemesi) gerektirmemeli. Geçersiz/bilinmeyen bir
-- template_key uygulama katmanında (lib/theme-settings.ts) her zaman registry'nin
-- varsayılan temasına düşürülür.
do $$
begin
  begin
    alter table public.business_theme_settings
      add constraint business_theme_settings_border_radius_check
      check (border_radius in ('none', 'sm', 'md', 'lg', 'full'));
  exception
    when duplicate_object then null;
  end;

  begin
    alter table public.business_theme_settings
      add constraint business_theme_settings_shadow_check
      check (shadow in ('none', 'soft', 'medium', 'strong'));
  exception
    when duplicate_object then null;
  end;

  begin
    alter table public.business_theme_settings
      add constraint business_theme_settings_color_mode_check
      check (color_mode in ('light', 'dark'));
  exception
    when duplicate_object then null;
  end;
end;
$$;

do $$
begin
  perform public.apply_uuid_tenant_rls('public.business_theme_settings'::regclass);
end;
$$;
