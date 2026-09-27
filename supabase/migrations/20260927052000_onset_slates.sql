-- ============ Clapboard (slate) ============
-- One per project (its id is the project id), shared with everyone on the project.
create table public.slates (
  id uuid primary key,
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null default '' check (char_length(title) <= 40),
  roll text not null default '' check (char_length(roll) <= 8),
  scene text not null default '' check (char_length(scene) <= 8),
  take text not null default '' check (char_length(take) <= 8),
  -- Empty means "today" on each device.
  slate_date text not null default '' check (char_length(slate_date) <= 20),
  producer text not null default '' check (char_length(producer) <= 30),
  director text not null default '' check (char_length(director) <= 30),
  updated_ms bigint not null,
  deleted boolean not null default false,
  created_by uuid default auth.uid(),
  server_updated_at timestamptz not null default now(),
  constraint slates_one_per_project check (id = project_id)
);

create index on public.slates (project_id, server_updated_at);

create trigger slates_keep_newest before update on public.slates
  for each row execute function public.keep_newest();

alter table public.slates enable row level security;
create policy "slates: members" on public.slates for all to authenticated
  using (private.can_access_project(project_id)) with check (private.can_access_project(project_id));

alter publication supabase_realtime add table public.slates;
