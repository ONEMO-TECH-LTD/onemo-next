-- ONE-102: SQL migration: designs table + RLS policies
create extension if not exists pgcrypto;

create table if not exists public.designs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  session_id text,
  cloudinary_asset_id text,
  cloudinary_public_preview_url text,
  title text not null,
  description text,
  tags text[],
  crop_params jsonb,
  is_public boolean not null default false,
  public_slug text unique,
  moderation_state text not null default 'self_certified',
  remixed_from_id uuid references public.designs(id),
  creator_public_id text,
  creator_display_name text,
  purchase_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint designs_moderation_state_check check (
    moderation_state in (
      'self_certified',
      'approved',
      'rejected',
      'appeal_pending',
      'rejected_final'
    )
  )
);

create index if not exists idx_designs_user_id
  on public.designs (user_id);

create index if not exists idx_designs_public_state_created_at
  on public.designs (is_public, moderation_state, created_at desc);

alter table if exists public.designs enable row level security;

drop policy if exists designs_select_own on public.designs;
create policy designs_select_own
  on public.designs
  for select
  using (auth.uid() = user_id);

drop policy if exists designs_select_public on public.designs;
create policy designs_select_public
  on public.designs
  for select
  using (is_public = true and moderation_state = 'approved');

drop policy if exists designs_insert_own on public.designs;
create policy designs_insert_own
  on public.designs
  for insert
  with check (auth.uid() = user_id);

drop policy if exists designs_update_own on public.designs;
create policy designs_update_own
  on public.designs
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists designs_delete_own on public.designs;
create policy designs_delete_own
  on public.designs
  for delete
  using (auth.uid() = user_id);

create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_updated_at on public.designs;
create trigger set_updated_at
  before update on public.designs
  for each row
  execute function public.update_updated_at_column();
