-- شغّل هذا الملف بعد supabase-admin.sql

create table if not exists public.property_videos (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  video_url text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists property_videos_property_id_idx on public.property_videos(property_id);

alter table public.property_videos enable row level security;

drop policy if exists "public can read videos for available properties" on public.property_videos;
create policy "public can read videos for available properties"
on public.property_videos for select
to anon, authenticated
using (
  exists (
    select 1 from public.properties p
    where p.id = property_id
    and (p.status = 'available' or public.is_admin())
  )
);

drop policy if exists "admins can insert property videos" on public.property_videos;
create policy "admins can insert property videos"
on public.property_videos for insert
to authenticated
with check (public.is_admin());

drop policy if exists "admins can update property videos" on public.property_videos;
create policy "admins can update property videos"
on public.property_videos for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admins can delete property videos" on public.property_videos;
create policy "admins can delete property videos"
on public.property_videos for delete
to authenticated
using (public.is_admin());

insert into storage.buckets (id, name, public)
values ('property-videos', 'property-videos', true)
on conflict (id) do nothing;

drop policy if exists "public can view property videos" on storage.objects;
create policy "public can view property videos"
on storage.objects for select
to public
using (bucket_id = 'property-videos');

drop policy if exists "admins can upload property videos" on storage.objects;
create policy "admins can upload property videos"
on storage.objects for insert
to authenticated
with check (bucket_id = 'property-videos' and public.is_admin());

drop policy if exists "admins can update property videos" on storage.objects;
create policy "admins can update property videos"
on storage.objects for update
to authenticated
using (bucket_id = 'property-videos' and public.is_admin())
with check (bucket_id = 'property-videos' and public.is_admin());

drop policy if exists "admins can delete property videos" on storage.objects;
create policy "admins can delete property videos"
on storage.objects for delete
to authenticated
using (bucket_id = 'property-videos' and public.is_admin());
