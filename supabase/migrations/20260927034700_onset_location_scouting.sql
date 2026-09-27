-- ============ Location Scouting ============
create table public.locations (
  id uuid primary key,
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  created_ms bigint not null,
  updated_ms bigint not null,
  deleted boolean not null default false,
  created_by uuid default auth.uid(),
  server_updated_at timestamptz not null default now()
);

create table public.location_notes (
  id uuid primary key,
  project_id uuid not null references public.projects(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  text text not null,
  created_ms bigint not null,
  updated_ms bigint not null,
  deleted boolean not null default false,
  created_by uuid default auth.uid(),
  server_updated_at timestamptz not null default now()
);

create table public.location_photos (
  id uuid primary key,
  project_id uuid not null references public.projects(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  storage_path text not null,
  note text not null default '',
  position double precision not null default 0,
  width int,
  height int,
  uploaded boolean not null default false,
  created_ms bigint not null,
  updated_ms bigint not null,
  deleted boolean not null default false,
  created_by uuid default auth.uid(),
  server_updated_at timestamptz not null default now()
);

create index on public.locations (project_id, server_updated_at);
create index on public.location_notes (project_id, server_updated_at);
create index on public.location_notes (location_id);
create index on public.location_photos (project_id, server_updated_at);
create index on public.location_photos (location_id);

create trigger locations_keep_newest before update on public.locations
  for each row execute function public.keep_newest();
create trigger location_notes_keep_newest before update on public.location_notes
  for each row execute function public.keep_newest();
create trigger location_photos_keep_newest before update on public.location_photos
  for each row execute function public.keep_newest();

alter table public.locations enable row level security;
alter table public.location_notes enable row level security;
alter table public.location_photos enable row level security;

create policy "locations: members" on public.locations for all to authenticated
  using (private.can_access_project(project_id)) with check (private.can_access_project(project_id));
create policy "location notes: members" on public.location_notes for all to authenticated
  using (private.can_access_project(project_id)) with check (private.can_access_project(project_id));
create policy "location photos: members" on public.location_photos for all to authenticated
  using (private.can_access_project(project_id)) with check (private.can_access_project(project_id));

-- At most 10 photos per location (enforced here as well as in the app).
create or replace function private.limit_location_photos() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not new.deleted and (
    select count(*) from public.location_photos
    where location_id = new.location_id and not deleted and id <> new.id
  ) >= 10 then
    raise exception 'A location can have up to 10 photos';
  end if;
  return new;
end $$;
revoke all on function private.limit_location_photos() from public, anon, authenticated;
create trigger location_photos_limit before insert or update of deleted on public.location_photos
  for each row execute function private.limit_location_photos();

alter publication supabase_realtime add table public.locations, public.location_notes, public.location_photos;

-- ============ photo files ============
-- Private bucket; files live at <project_id>/<location_id>/<photo_id>.jpg
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('location-photos', 'location-photos', false, 15728640, array['image/jpeg', 'image/png', 'image/heic', 'image/webp'])
on conflict (id) do nothing;

create or replace function private.storage_project_id(object_name text) returns uuid
language sql immutable set search_path = '' as $$
  select case
    when split_part(object_name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then split_part(object_name, '/', 1)::uuid
    else null
  end
$$;
revoke all on function private.storage_project_id(text) from public, anon;
grant execute on function private.storage_project_id(text) to authenticated;

create policy "location photos: read" on storage.objects for select to authenticated
  using (bucket_id = 'location-photos' and private.can_access_project(private.storage_project_id(name)));
create policy "location photos: add" on storage.objects for insert to authenticated
  with check (bucket_id = 'location-photos' and private.can_access_project(private.storage_project_id(name)));
create policy "location photos: replace" on storage.objects for update to authenticated
  using (bucket_id = 'location-photos' and private.can_access_project(private.storage_project_id(name)))
  with check (bucket_id = 'location-photos' and private.can_access_project(private.storage_project_id(name)));
create policy "location photos: remove" on storage.objects for delete to authenticated
  using (bucket_id = 'location-photos' and private.can_access_project(private.storage_project_id(name)));
