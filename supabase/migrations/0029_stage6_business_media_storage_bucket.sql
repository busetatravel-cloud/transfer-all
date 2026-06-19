insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
select
  'business-media',
  'business-media',
  true,
  52428800,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml']::text[]
where not exists (
  select 1
  from storage.buckets
  where id = 'business-media'
);

update storage.buckets
set public = true,
    file_size_limit = coalesce(file_size_limit, 52428800)
where id = 'business-media';
