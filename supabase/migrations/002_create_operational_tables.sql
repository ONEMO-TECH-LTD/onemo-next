-- ONE-103: SQL migration: reports, identity_map, event_log, job_queue, webhook_receipts
create extension if not exists pgcrypto;

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  design_id uuid not null references public.designs(id),
  reporter_user_id uuid not null references auth.users(id),
  reason text not null,
  details text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  constraint reports_status_check check (status in ('pending', 'reviewed', 'actioned'))
);

alter table if exists public.reports enable row level security;

drop policy if exists reports_insert_authenticated on public.reports;
create policy reports_insert_authenticated
  on public.reports
  for insert
  to authenticated
  with check (auth.uid() = reporter_user_id);

create table if not exists public.customer_identity_map (
  supabase_user_id uuid primary key references auth.users(id),
  shopify_customer_id text unique not null,
  created_at timestamptz not null default now()
);

create table if not exists public.event_log (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  shop_domain text,
  customer_id uuid,
  design_id uuid,
  ts timestamptz not null default now(),
  metadata jsonb
);

create table if not exists public.job_queue (
  id uuid primary key default gen_random_uuid(),
  job_type text not null,
  payload jsonb not null default '{}'::jsonb,
  idempotency_key text unique not null,
  status text not null default 'queued',
  attempts integer not null default 0,
  run_after timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint job_queue_status_check check (
    status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')
  )
);

create index if not exists idx_job_queue_status_run_after
  on public.job_queue (status, run_after);

create table if not exists public.webhook_receipts (
  webhook_id text unique not null,
  topic text not null,
  shop_domain text not null,
  received_at timestamptz not null default now()
);

alter table if exists public.customer_identity_map enable row level security;
alter table if exists public.event_log enable row level security;
alter table if exists public.job_queue enable row level security;
alter table if exists public.webhook_receipts enable row level security;
