-- ON SET access rules (row level security), app functions and live updates.
-- Applied as 20260927031443_onset_access_rules.

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.user_groups enable row level security;
alter table public.group_members enable row level security;
alter table public.project_groups enable row level security;
alter table public.project_invites enable row level security;
alter table public.transcriptions enable row level security;
alter table public.transcript_lines enable row level security;
alter table public.clips enable row level security;
alter table public.equipment_items enable row level security;
alter table public.equipment_library enable row level security;

-- profiles: see yourself (names of collaborators come through project_people()).
create policy "profiles: read own" on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy "profiles: update own" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- projects
create policy "projects: members read" on public.projects for select to authenticated
  using (public.can_access_project(id));
create policy "projects: create own" on public.projects for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy "projects: members edit" on public.projects for update to authenticated
  using (public.can_access_project(id)) with check (public.can_access_project(id));
create policy "projects: owner deletes" on public.projects for delete to authenticated
  using (owner_id = (select auth.uid()));

-- project_members: anyone on the project can see and add people; the owner can
-- remove anyone, and people can remove themselves (leave).
create policy "members: read" on public.project_members for select to authenticated
  using (public.can_access_project(project_id));
create policy "members: add" on public.project_members for insert to authenticated
  with check (public.can_access_project(project_id));
create policy "members: remove" on public.project_members for delete to authenticated
  using (public.is_project_owner(project_id) or email = public.auth_email());

-- saved user groups belong to the person who made them
create policy "groups: owner all" on public.user_groups for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "group members: owner all" on public.group_members for all to authenticated
  using (exists (select 1 from public.user_groups g where g.id = group_id and g.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.user_groups g where g.id = group_id and g.owner_id = (select auth.uid())));

-- project_groups: link your own group to a project you can open
create policy "project groups: read" on public.project_groups for select to authenticated
  using (public.can_access_project(project_id));
create policy "project groups: link own group" on public.project_groups for insert to authenticated
  with check (
    public.can_access_project(project_id)
    and exists (select 1 from public.user_groups g where g.id = group_id and g.owner_id = (select auth.uid()))
  );
create policy "project groups: unlink" on public.project_groups for delete to authenticated
  using (
    public.is_project_owner(project_id)
    or exists (select 1 from public.user_groups g where g.id = group_id and g.owner_id = (select auth.uid()))
  );

-- invites are created and redeemed through functions below
create policy "invites: read" on public.project_invites for select to authenticated
  using (public.can_access_project(project_id));

-- project data: anyone who can open the project can read and change it
create policy "transcriptions: members" on public.transcriptions for all to authenticated
  using (public.can_access_project(project_id)) with check (public.can_access_project(project_id));
create policy "lines: members" on public.transcript_lines for all to authenticated
  using (public.can_access_project(project_id)) with check (public.can_access_project(project_id));
create policy "clips: members" on public.clips for all to authenticated
  using (public.can_access_project(project_id)) with check (public.can_access_project(project_id));
create policy "equipment: members" on public.equipment_items for all to authenticated
  using (public.can_access_project(project_id)) with check (public.can_access_project(project_id));

create policy "library: own" on public.equipment_library for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- App functions (create_invite, join_project, project_people, project_group_names)
-- are defined in their final form in 20260927031820_onset_private_helpers.sql.

-- ============ live updates ============
alter publication supabase_realtime add table
  public.projects, public.project_members, public.project_groups,
  public.user_groups, public.group_members,
  public.transcriptions, public.transcript_lines, public.clips,
  public.equipment_items, public.equipment_library;
