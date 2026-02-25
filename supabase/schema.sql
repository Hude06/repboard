-- RepBoard web schema

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  preferred_rep_type text not null default 'pushup' check (preferred_rep_type in ('pushup', 'pullup')),
  pushup_total integer not null default 0 check (pushup_total >= 0),
  pullup_total integer not null default 0 check (pullup_total >= 0),
  daily_pushups jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

drop policy if exists "profiles public read" on public.profiles;
create policy "profiles public read"
on public.profiles
for select
to anon, authenticated
using (true);

drop policy if exists "profiles self insert" on public.profiles;
create policy "profiles self insert"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "profiles self update" on public.profiles;
create policy "profiles self update"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);
