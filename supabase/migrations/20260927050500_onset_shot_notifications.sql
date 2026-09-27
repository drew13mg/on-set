-- Push notifications when a shot is marked Done or Active.
-- Everyone on the project (except whoever made the change) gets one on each of their devices,
-- unless they've switched shot notifications off for that project in Project settings.
-- Sent through the Expo push service (https://docs.expo.dev/push-notifications/sending-notifications/).

create extension if not exists pg_net with schema extensions;

-- Each device's Expo push token and who's signed in on it. Only reachable through the functions below.
create table public.push_tokens (
  token text primary key check (token ~ '^Expo(nent)?PushToken\[.+\]$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  updated_at timestamptz not null default now()
);
create index on public.push_tokens (user_id);
alter table public.push_tokens enable row level security;

-- A device belongs to whoever signed in on it last.
create or replace function public.register_push_token(push_token text, device_platform text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in first';
  end if;
  insert into public.push_tokens (token, user_id, platform)
  values (push_token, auth.uid(), device_platform)
  on conflict (token) do update set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
end $$;

-- Called on sign-out so the device stops getting this person's notifications.
create or replace function public.unregister_push_token(push_token text) returns void
language sql security definer set search_path = '' as $$
  delete from public.push_tokens where token = push_token and user_id = auth.uid();
$$;

revoke all on function public.register_push_token(text, text) from public, anon;
revoke all on function public.unregister_push_token(text) from public, anon;
grant execute on function public.register_push_token(text, text) to authenticated;
grant execute on function public.unregister_push_token(text) to authenticated;

-- Projects someone has muted (Project settings → Shot notifications off).
create table public.notification_mutes (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, project_id)
);
alter table public.notification_mutes enable row level security;
create policy "mutes: own" on public.notification_mutes for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and private.can_access_project(project_id));

-- Everyone who can open a project: the owner, people added by email, and members of linked groups.
create or replace function private.project_user_ids(p uuid) returns setof uuid
language sql stable security definer set search_path = '' as $$
  select pr.owner_id from public.projects pr where pr.id = p
  union
  select pf.id from public.project_members m
    join public.profiles pf on pf.email = m.email
    where m.project_id = p
  union
  select pf.id from public.project_groups pg
    join public.user_groups g on g.id = pg.group_id and not g.deleted
    join public.group_members gm on gm.group_id = pg.group_id
    join public.profiles pf on pf.email = gm.email
    where pg.project_id = p
$$;
revoke all on function private.project_user_ids(uuid) from public, anon, authenticated;

create or replace function private.notify_shot_status() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  list_name text;
  project_name text;
  who text;
  label text;
  msgs jsonb;
  total int;
  i int := 0;
begin
  if new.deleted or new.status = 'none' then
    return null;
  end if;
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return null;
  end if;
  -- Skip marks made long ago that are only now arriving (a phone that was offline).
  if coalesce(new.status_ms, new.updated_ms) < (extract(epoch from now()) * 1000)::bigint - 10 * 60 * 1000 then
    return null;
  end if;

  select name into list_name from public.shot_lists where id = new.list_id and not deleted;
  select name into project_name from public.projects where id = new.project_id and not deleted;
  if list_name is null or project_name is null then
    return null;
  end if;

  select coalesce(nullif(split_part(trim(display_name), ' ', 1), ''), split_part(email, '@', 1))
    into who from public.profiles where id = actor;

  label := 'Shot ' || new.number
    || case when new.description <> '' then ' · ' || new.description else '' end
    || case when new.time_min is not null
         then ' (' || lpad((new.time_min / 60)::text, 2, '0') || ':' || lpad((new.time_min % 60)::text, 2, '0') || ')'
         else '' end;

  select jsonb_agg(jsonb_build_object(
           'to', t.token,
           'title', project_name || ' · ' || list_name,
           'body', case when new.status = 'done' then 'Done: ' else 'Active: ' end || label
                   || coalesce(' — ' || who, ''),
           'sound', 'default',
           'priority', 'high',
           'channelId', 'shots',
           'data', jsonb_build_object(
             'url', '/project/' || new.project_id || '/shot-list/' || new.list_id,
             'projectId', new.project_id,
             'listId', new.list_id)))
    into msgs
    from public.push_tokens t
    where t.user_id in (select private.project_user_ids(new.project_id))
      and t.user_id is distinct from actor
      and not exists (select 1 from public.notification_mutes mu
                      where mu.user_id = t.user_id and mu.project_id = new.project_id);
  if msgs is null then
    return null;
  end if;

  -- The Expo push service takes up to 100 messages per request.
  total := jsonb_array_length(msgs);
  while i < total loop
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      body := (select jsonb_agg(e) from jsonb_array_elements(msgs) with ordinality as x(e, n)
               where n > i and n <= i + 100),
      headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb
    );
    i := i + 100;
  end loop;
  return null;
end $$;
revoke all on function private.notify_shot_status() from public, anon, authenticated;

create trigger shots_notify after insert or update of status on public.shots
  for each row execute function private.notify_shot_status();
