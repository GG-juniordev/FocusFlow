-- FocusFlow cloud sync schema
-- ---------------------------------------------------------------------------
-- How to use:
--   1. Open your project at https://supabase.com/dashboard
--   2. SQL Editor -> New query -> paste this whole file -> Run
--   It is safe to run again: nothing is dropped and no data is touched.
--
-- Design notes
--   * Every row belongs to one user (user_id) and Row Level Security lets a
--     user see and change only their own rows.
--   * Row ids are created by the app. Most are UUIDs, but built-in items use
--     fixed ids ('cat-work', 'builtin-google'), so ids are text and the primary
--     key is (user_id, id). That is also what makes transfers duplicate-free:
--     uploading the same record twice updates it instead of adding a copy.
--   * updated_at is when the record was last changed on a device. A write that
--     carries an older updated_at than the stored row is ignored, so an out-of-
--     date device can never overwrite newer data.
--   * deleted_at marks a deletion instead of removing the row, so other devices
--     find out about it. synced_at is set by the server on every write and is
--     what devices use to ask "what changed since I last looked?".
-- ---------------------------------------------------------------------------

-- Shared trigger: stamp synced_at, and refuse stale overwrites.
create or replace function public.focusflow_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.updated_at < old.updated_at then
    return null; -- an older copy must not replace a newer one
  end if;
  new.synced_at := clock_timestamp();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------
create table if not exists public.categories (
  id          text        not null,
  user_id     uuid        not null references auth.users (id) on delete cascade,
  name        text        not null default '',
  color       text        not null default '#8a93a6',
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  synced_at   timestamptz not null default clock_timestamp(),
  primary key (user_id, id)
);

-- ---------------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------------
create table if not exists public.tasks (
  id                 text        not null,
  user_id            uuid        not null references auth.users (id) on delete cascade,
  title              text        not null,
  notes              text        not null default '',
  estimated_minutes  integer     not null default 25 check (estimated_minutes > 0),
  priority           text        not null default 'medium' check (priority in ('high', 'medium', 'low')),
  category_id        text,
  due_date           date,
  tools              jsonb       not null default '[]'::jsonb,
  subtasks           jsonb       not null default '[]'::jsonb,
  is_completed       boolean     not null default false,
  position           double precision not null default 0,
  spent_ms           bigint      not null default 0,
  created_at         timestamptz not null default now(),
  completed_at       timestamptz,
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz,
  synced_at          timestamptz not null default clock_timestamp(),
  primary key (user_id, id)
);

-- Upgrade for databases created before sub-tasks existed. Safe to run again.
-- subtasks holds the checklist: [{ "id", "title", "isCompleted", "position" }, ...]
alter table public.tasks add column if not exists subtasks jsonb not null default '[]'::jsonb;

-- ---------------------------------------------------------------------------
-- calendar_events
-- ---------------------------------------------------------------------------
create table if not exists public.calendar_events (
  id           text        not null,
  user_id      uuid        not null references auth.users (id) on delete cascade,
  title        text        not null,
  notes        text        not null default '',
  task_id      text,
  start_time   timestamptz not null,
  end_time     timestamptz not null,
  category_id  text,
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  synced_at    timestamptz not null default clock_timestamp(),
  primary key (user_id, id),
  check (end_time > start_time)
);

-- ---------------------------------------------------------------------------
-- custom_tools  (the tool library, including emoji and image icons)
-- icon_type: 'emoji' -> icon_value is the emoji
--            'image' -> icon_value is a small PNG data URL (64x64, a few KB)
--            null    -> the built-in icon for `preset`, if any
-- ---------------------------------------------------------------------------
create table if not exists public.custom_tools (
  id          text        not null,
  user_id     uuid        not null references auth.users (id) on delete cascade,
  name        text        not null,
  url         text,
  preset      text,
  icon_type   text        check (icon_type in ('emoji', 'image')),
  icon_value  text        check (icon_value is null or length(icon_value) <= 60000),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  synced_at   timestamptz not null default clock_timestamp(),
  primary key (user_id, id)
);

-- ---------------------------------------------------------------------------
-- user_settings  (one row per user; window and startup options stay per PC)
-- ---------------------------------------------------------------------------
create table if not exists public.user_settings (
  user_id         uuid        primary key references auth.users (id) on delete cascade,
  theme_mode      text        not null default 'dark' check (theme_mode in ('dark', 'light', 'system')),
  accent_color    text        not null default '#F0A63A',
  bg_color        text,
  surface_color   text,
  focus_duration  integer     not null default 25 check (focus_duration between 1 and 600),
  break_duration  integer     not null default 5 check (break_duration between 1 and 120),
  language        text        not null default 'en' check (language in ('en', 'it')),
  updated_at      timestamptz not null default now(),
  synced_at       timestamptz not null default clock_timestamp()
);

-- ---------------------------------------------------------------------------
-- Indexes for "what changed since my last sync?"
-- ---------------------------------------------------------------------------
create index if not exists categories_sync_idx      on public.categories      (user_id, synced_at);
create index if not exists tasks_sync_idx           on public.tasks           (user_id, synced_at);
create index if not exists calendar_events_sync_idx on public.calendar_events (user_id, synced_at);
create index if not exists custom_tools_sync_idx    on public.custom_tools    (user_id, synced_at);

-- ---------------------------------------------------------------------------
-- Triggers and Row Level Security, applied to every table
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['categories', 'tasks', 'calendar_events', 'custom_tools', 'user_settings']
  loop
    execute format('drop trigger if exists focusflow_before_write on public.%I', t);
    execute format(
      'create trigger focusflow_before_write before insert or update on public.%I
         for each row execute function public.focusflow_before_write()', t);

    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists "Users can read their own rows" on public.%I', t);
    execute format(
      'create policy "Users can read their own rows" on public.%I
         for select to authenticated using ((select auth.uid()) = user_id)', t);

    execute format('drop policy if exists "Users can add their own rows" on public.%I', t);
    execute format(
      'create policy "Users can add their own rows" on public.%I
         for insert to authenticated with check ((select auth.uid()) = user_id)', t);

    execute format('drop policy if exists "Users can change their own rows" on public.%I', t);
    execute format(
      'create policy "Users can change their own rows" on public.%I
         for update to authenticated
         using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);

    execute format('drop policy if exists "Users can delete their own rows" on public.%I', t);
    execute format(
      'create policy "Users can delete their own rows" on public.%I
         for delete to authenticated using ((select auth.uid()) = user_id)', t);

    -- Signed-in users only; RLS above narrows that to their own rows.
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end;
$$;
