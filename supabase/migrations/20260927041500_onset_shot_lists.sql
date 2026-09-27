-- ============ Shot List ============
create table public.shot_lists (
  id uuid primary key,
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  -- Set when the list is started (the project's active shot list); null otherwise.
  started_ms bigint,
  created_ms bigint not null,
  updated_ms bigint not null,
  deleted boolean not null default false,
  created_by uuid default auth.uid(),
  server_updated_at timestamptz not null default now()
);

create table public.shots (
  id uuid primary key,
  project_id uuid not null references public.projects(id) on delete cascade,
  list_id uuid not null references public.shot_lists(id) on delete cascade,
  number int not null check (number between 1 and 999),
  status text not null default 'none' check (status in ('none', 'active', 'done')),
  description text not null default '',
  created_ms bigint not null,
  updated_ms bigint not null,
  deleted boolean not null default false,
  created_by uuid default auth.uid(),
  server_updated_at timestamptz not null default now()
);

create index on public.shot_lists (project_id, server_updated_at);
create index on public.shots (project_id, server_updated_at);
create index on public.shots (list_id);

create trigger shot_lists_keep_newest before update on public.shot_lists
  for each row execute function public.keep_newest();
create trigger shots_keep_newest before update on public.shots
  for each row execute function public.keep_newest();

alter table public.shot_lists enable row level security;
alter table public.shots enable row level security;

create policy "shot lists: members" on public.shot_lists for all to authenticated
  using (private.can_access_project(project_id)) with check (private.can_access_project(project_id));
create policy "shots: members" on public.shots for all to authenticated
  using (private.can_access_project(project_id)) with check (private.can_access_project(project_id));

-- At most 120 shots per list (3 across × 40 down), enforced here as well as in the app.
create or replace function private.limit_shots() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not new.deleted and (
    select count(*) from public.shots where list_id = new.list_id and not deleted and id <> new.id
  ) >= 120 then
    raise exception 'A shot list can have up to 120 shots';
  end if;
  return new;
end $$;
revoke all on function private.limit_shots() from public, anon, authenticated;
create trigger shots_limit before insert or update of deleted on public.shots
  for each row execute function private.limit_shots();

alter publication supabase_realtime add table public.shot_lists, public.shots;
