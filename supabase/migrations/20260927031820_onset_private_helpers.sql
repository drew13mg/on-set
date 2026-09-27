-- Move policy helpers out of the public API into a private schema, and define the
-- app functions in their final form. Applied as 20260927031820_onset_private_helpers.

create schema if not exists private;
grant usage on schema private to authenticated;

alter function public.can_access_project(uuid) set schema private;
alter function public.is_project_owner(uuid) set schema private;
alter function public.auth_email() set schema private;

revoke all on function private.can_access_project(uuid) from public, anon;
revoke all on function private.is_project_owner(uuid) from public, anon;
revoke all on function private.auth_email() from public, anon;
grant execute on function private.can_access_project(uuid) to authenticated;
grant execute on function private.is_project_owner(uuid) to authenticated;
grant execute on function private.auth_email() to authenticated;

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.guard_project_update() from public, anon, authenticated;
revoke all on function public.touch_server_updated_at() from public, anon, authenticated;

create or replace function private.can_access_project(p uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select
    exists (select 1 from public.projects pr where pr.id = p and pr.owner_id = auth.uid())
    or (
      private.auth_email() <> '' and (
        exists (select 1 from public.project_members m
                where m.project_id = p and m.email = private.auth_email())
        or exists (select 1 from public.project_groups pg
                   join public.user_groups g on g.id = pg.group_id and not g.deleted
                   join public.group_members gm on gm.group_id = pg.group_id
                   where pg.project_id = p and gm.email = private.auth_email())
      )
    )
$$;

-- A short code anyone on the project can pass along; whoever redeems it joins.
-- Works even when someone signs in with Apple's "Hide my email".
create or replace function public.create_invite(p uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  existing text;
  new_code text;
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i int;
begin
  if not private.can_access_project(p) then
    raise exception 'Not allowed';
  end if;
  select code into existing from public.project_invites where project_id = p order by created_at desc limit 1;
  if existing is not null then
    return existing;
  end if;
  loop
    new_code := '';
    for i in 1..8 loop
      new_code := new_code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    begin
      insert into public.project_invites (code, project_id) values (new_code, p);
      return new_code;
    exception when unique_violation then
    end;
  end loop;
end $$;

create or replace function public.join_project(invite_code text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  pid uuid;
  me text := private.auth_email();
begin
  if auth.uid() is null or me = '' then
    raise exception 'Sign in first';
  end if;
  select project_id into pid from public.project_invites
    where code = upper(replace(trim(invite_code), '-', ''));
  if pid is null then
    raise exception 'That code isn''t valid';
  end if;
  insert into public.project_members (project_id, email, added_by)
    values (pid, me, auth.uid())
    on conflict do nothing;
  return pid;
end $$;

-- Everyone who can open a project, and how they got access.
create or replace function public.project_people(p uuid)
returns table (email text, display_name text, via text, group_name text, is_owner boolean, is_me boolean)
language sql stable security definer set search_path = '' as $$
  with people as (
    select pr.email, pr.display_name, 'owner'::text as via, null::text as group_name, true as is_owner
      from public.projects p0 join public.profiles pr on pr.id = p0.owner_id
      where p0.id = p
    union all
    select m.email, prof.display_name, 'direct', null, false
      from public.project_members m left join public.profiles prof on prof.email = m.email
      where m.project_id = p
    union all
    select gm.email, prof.display_name, 'group', g.name, false
      from public.project_groups pg
      join public.user_groups g on g.id = pg.group_id and not g.deleted
      join public.group_members gm on gm.group_id = g.id
      left join public.profiles prof on prof.email = gm.email
      where pg.project_id = p
  )
  select distinct on (people.email) people.email, people.display_name, people.via, people.group_name,
         people.is_owner, people.email = private.auth_email()
  from people
  where private.can_access_project(p)
  order by people.email, people.is_owner desc, (people.via = 'direct') desc;
$$;

-- Groups linked to a project, with names (visible to everyone on the project).
create or replace function public.project_group_names(p uuid)
returns table (group_id uuid, name text, member_count int, is_mine boolean)
language sql stable security definer set search_path = '' as $$
  select g.id, g.name, (select count(*)::int from public.group_members gm where gm.group_id = g.id),
         g.owner_id = auth.uid()
  from public.project_groups pg join public.user_groups g on g.id = pg.group_id and not g.deleted
  where pg.project_id = p and private.can_access_project(p)
  order by g.name;
$$;

revoke all on function public.create_invite(uuid) from public, anon;
revoke all on function public.join_project(text) from public, anon;
revoke all on function public.project_people(uuid) from public, anon;
revoke all on function public.project_group_names(uuid) from public, anon;
grant execute on function public.create_invite(uuid) to authenticated;
grant execute on function public.join_project(text) to authenticated;
grant execute on function public.project_people(uuid) to authenticated;
grant execute on function public.project_group_names(uuid) to authenticated;
