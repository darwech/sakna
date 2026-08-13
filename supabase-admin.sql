-- نفّذ هذا الملف كاملًا في Supabase SQL Editor.
-- ثم أنشئ حساب Admin من Authentication > Users، وبعدها أضف User ID إلى admin_users.

create extension if not exists pgcrypto;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  university text not null,
  area text not null,
  price integer not null check (price >= 0),
  rooms integer not null default 1 check (rooms > 0),
  beds integer not null default 1 check (beds > 0),
  available_beds integer not null default 1 check (available_beds >= 0 and available_beds <= beds),
  description text not null default '',
  amenities text[] not null default '{}',
  status text not null default 'available' check (status in ('available','full','hidden')),
  location_text text,
  created_at timestamptz not null default now()
);

create table if not exists public.property_images (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  image_url text not null,
  is_primary boolean not null default false,
  sort_order integer not null default 0
);

create index if not exists properties_status_idx on public.properties(status);
create index if not exists properties_area_idx on public.properties(area);
create index if not exists properties_university_idx on public.properties(university);

alter table public.admin_users enable row level security;
alter table public.properties enable row level security;
alter table public.property_images enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users
    where user_id = auth.uid()
  );
$$;

drop policy if exists "admin can read own admin row" on public.admin_users;
create policy "admin can read own admin row"
on public.admin_users for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "public can read available properties" on public.properties;
create policy "public can read available properties"
on public.properties for select
to anon, authenticated
using (status = 'available' or public.is_admin());

drop policy if exists "admins can insert properties" on public.properties;
create policy "admins can insert properties"
on public.properties for insert
to authenticated
with check (public.is_admin());

drop policy if exists "admins can update properties" on public.properties;
create policy "admins can update properties"
on public.properties for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admins can delete properties" on public.properties;
create policy "admins can delete properties"
on public.properties for delete
to authenticated
using (public.is_admin());

drop policy if exists "public can read images for available properties" on public.property_images;
create policy "public can read images for available properties"
on public.property_images for select
to anon, authenticated
using (
  exists (
    select 1 from public.properties p
    where p.id = property_id
    and (p.status = 'available' or public.is_admin())
  )
);

drop policy if exists "admins can insert images" on public.property_images;
create policy "admins can insert images"
on public.property_images for insert
to authenticated
with check (public.is_admin());

drop policy if exists "admins can update images" on public.property_images;
create policy "admins can update images"
on public.property_images for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admins can delete images" on public.property_images;
create policy "admins can delete images"
on public.property_images for delete
to authenticated
using (public.is_admin());

-- أنشئ Bucket للصور:
insert into storage.buckets (id, name, public)
values ('property-images', 'property-images', true)
on conflict (id) do nothing;

drop policy if exists "public can view property images" on storage.objects;
create policy "public can view property images"
on storage.objects for select
to public
using (bucket_id = 'property-images');

drop policy if exists "admins can upload property images" on storage.objects;
create policy "admins can upload property images"
on storage.objects for insert
to authenticated
with check (bucket_id = 'property-images' and public.is_admin());

drop policy if exists "admins can update property images" on storage.objects;
create policy "admins can update property images"
on storage.objects for update
to authenticated
using (bucket_id = 'property-images' and public.is_admin())
with check (bucket_id = 'property-images' and public.is_admin());

drop policy if exists "admins can delete property images" on storage.objects;
create policy "admins can delete property images"
on storage.objects for delete
to authenticated
using (bucket_id = 'property-images' and public.is_admin());

-- بعد إنشاء حساب الأدمن من Authentication > Users:
-- INSERT INTO public.admin_users (user_id) VALUES ('ضع-هنا-User-ID');
