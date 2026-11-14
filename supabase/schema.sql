-- MoonBase Colony — cloud saves
-- Run this once in your Supabase project: Dashboard → SQL Editor → New query → paste → Run.
--
-- One row per player. Row Level Security makes sure a signed-in player can
-- only ever read or write their own row (the public anon key cannot see
-- anyone else's save).

create table if not exists public.saves (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  colony      jsonb,                 -- current colony (game state)
  checkpoint  jsonb,                 -- last sunrise checkpoint (for "Retry")
  profile     jsonb,                 -- achievements, career stats, options
  difficulty  text,
  version     integer not null default 3,
  updated_at  timestamptz not null default now()
);

alter table public.saves enable row level security;

drop policy if exists "Players read their own save" on public.saves;
create policy "Players read their own save"
  on public.saves for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Players create their own save" on public.saves;
create policy "Players create their own save"
  on public.saves for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Players update their own save" on public.saves;
create policy "Players update their own save"
  on public.saves for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Players delete their own save" on public.saves;
create policy "Players delete their own save"
  on public.saves for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- Keep updated_at honest even if a client sends an old timestamp.
create or replace function public.touch_saves_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists saves_touch_updated_at on public.saves;
create trigger saves_touch_updated_at
  before insert or update on public.saves
  for each row execute function public.touch_saves_updated_at();
