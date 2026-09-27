-- ON SET core schema: people, projects & sharing, project data.
-- Applied to Supabase project "on-set" (ref upjtapmgidpmtudjhtpv) as 20260927031406_onset_core_schema.

-- ============ helpers ============
create or replace function public.auth_email() returns text
language sql stable set search_path = '' as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''))
$$;

create or replace function public.touch_server_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.server_updated_at := now();
  return new;
end $$;

-- ============ people ============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    lower(new.email),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  )
  on conflict (id) do update set email = excluded.email,
    display_name = coalesce(excluded.display_name, public.profiles.display_name);
  return new;
end $$;

create trigger on_auth_user_created
  after insert or update of email, raw_user_meta_data on auth.users
  for each row execute function public.handle_new_user();

-- ============ projects & sharing ============
create table public.projects (
  id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  created_ms bigint not null,
  updated_ms bigint not null,
  deleted boolean not null default false,
  equipment_saved_ms bigint,
  sun_place jsonb,
  server_updated_at timestamptz not null default now()
);

create table public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  email text not null check (email = lower(email) and position('@' in email) > 1),
  added_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (project_id, email)
);

create table public.user_groups (
  id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  updated_ms bigint not null,
  deleted boolean not null default false,
  server_updated_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.user_groups(id) on delete cascade,
  email text not null check (email = lower(email) and position('@' in email) > 1),
  created_at timestamptz not null default now(),
  primary key (group_id, email)
);

create table public.project_groups (
  project_id uuid not null references public.projects(id) on delete cascade,
  group_id uuid not null references public.user_groups(id) on delete cascade,
  added_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (project_id, group_id)
);

create table public.project_invites (
  code text primary key,
  project_id uuid not null references public.projects(id) on delete cascade,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

-- Who can open a project: its owner, anyone added by email, or anyone in a
-- saved group linked to it (groups stay linked, so editing a group changes access).
create or replace function public.can_access_project(p uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select
    exists (select 1 from public.projects pr where pr.id = p and pr.owner_id = auth.uid())
    or (
      public.auth_email() <> '' and (
        exists (select 1 from public.project_members m
                where m.project_id = p and m.email = public.auth_email())
        or exists (select 1 from public.project_groups pg
                   join public.user_groups g on g.id = pg.group_id and not g.deleted
                   join public.group_members gm on gm.group_id = pg.group_id
                   where pg.project_id = p and gm.email = public.auth_email())
      )
    )
$$;

create or replace function public.is_project_owner(p uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.projects pr where pr.id = p and pr.owner_id = auth.uid())
$$;

-- Only the owner can change ownership or delete a project for everyone.
create or replace function public.guard_project_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.owner_id <> old.owner_id then
    raise exception 'Only the owner can transfer a project';
  end if;
  if new.deleted and not old.deleted and old.owner_id <> auth.uid() then
    raise exception 'Only the owner can delete a project';
  end if;
  new.server_updated_at := now();
  return new;
end $$;

create trigger projects_guard before update on public.projects
  for each row execute function public.guard_project_update();
create trigger user_groups_touch before update on public.user_groups
  for each row execute function public.touch_server_updated_at();

-- ============ project data ============
create table public.transcriptions (
  id uuid primary key,
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  created_ms bigint not null,
  updated_ms bigint not null,
  deleted boolean not null default false,
  created_by uuid default auth.uid(),
  server_updated_at timestamptz not null default now()
);

create table public.transcript_lines (
  id uuid primary key,
  project_id uuid not null references public.projects(id) on delete cascade,
  transcription_id uuid not null references public.transcriptions(id) on delete cascade,
  text text not null,
  at_ms bigint not null,
  updated_ms bigint not null,
  deleted boolean not null default false,
  created_by uuid default auth.uid(),
  server_updated_at timestamptz not null default now()
);

create table public.clips (
  id uuid primary key,
  project_id uuid not null references public.projects(id) on delete cascade,
  transcription_id uuid references public.transcriptions(id) on delete cascade,
  name text not null,
  in_ms bigint not null,
  out_ms bigint not null,
  transcript text not null default '',
  created_ms bigint not null,
  updated_ms bigint not null,
  deleted boolean not null default false,
  created_by uuid default auth.uid(),
  server_updated_at timestamptz not null default now()
);

create table public.equipment_items (
  id uuid primary key,
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  library_id uuid,
  have boolean not null default false,
  position double precision not null default 0,
  updated_ms bigint not null,
  deleted boolean not null default false,
  created_by uuid default auth.uid(),
  server_updated_at timestamptz not null default now()
);

-- Personal "My equipment" (follows the user across devices, not shared).
create table public.equipment_library (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  updated_ms bigint not null,
  deleted boolean not null default false,
  server_updated_at timestamptz not null default now()
);

create trigger transcriptions_touch before update on public.transcriptions
  for each row execute function public.touch_server_updated_at();
create trigger transcript_lines_touch before update on public.transcript_lines
  for each row execute function public.touch_server_updated_at();
create trigger clips_touch before update on public.clips
  for each row execute function public.touch_server_updated_at();
create trigger equipment_items_touch before update on public.equipment_items
  for each row execute function public.touch_server_updated_at();
create trigger equipment_library_touch before update on public.equipment_library
  for each row execute function public.touch_server_updated_at();

create index on public.projects (owner_id);
create index on public.projects (server_updated_at);
create index on public.project_members (email);
create index on public.group_members (email);
create index on public.project_groups (group_id);
create index on public.user_groups (owner_id);
create index on public.project_invites (project_id);
create index on public.transcriptions (project_id, server_updated_at);
create index on public.transcript_lines (project_id, server_updated_at);
create index on public.transcript_lines (transcription_id);
create index on public.clips (project_id, server_updated_at);
create index on public.clips (transcription_id);
create index on public.equipment_items (project_id, server_updated_at);
create index on public.equipment_library (user_id, server_updated_at);
