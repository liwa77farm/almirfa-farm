-- Run this once in your Supabase SQL Editor for Al Mirfa Farm.
create extension if not exists pgcrypto;

create table if not exists public.almirfa_records (
  id uuid primary key default gen_random_uuid(),
  farm_id text not null default 'almirfa',
  record_type text not null,
  data jsonb not null default '{}'::jsonb,
  worker_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists almirfa_records_type_idx on public.almirfa_records(record_type);
create index if not exists almirfa_records_created_idx on public.almirfa_records(created_at desc);

alter table public.almirfa_records enable row level security;

drop policy if exists "almirfa read" on public.almirfa_records;
drop policy if exists "almirfa insert" on public.almirfa_records;
drop policy if exists "almirfa update" on public.almirfa_records;
drop policy if exists "almirfa delete" on public.almirfa_records;

create policy "almirfa read" on public.almirfa_records
for select to anon, authenticated using (farm_id = 'almirfa');
create policy "almirfa insert" on public.almirfa_records
for insert to anon, authenticated with check (farm_id = 'almirfa');
create policy "almirfa update" on public.almirfa_records
for update to anon, authenticated using (farm_id = 'almirfa') with check (farm_id = 'almirfa');
create policy "almirfa delete" on public.almirfa_records
for delete to anon, authenticated using (farm_id = 'almirfa');

do $$
begin
  alter publication supabase_realtime add table public.almirfa_records;
exception when duplicate_object then null;
end $$;
