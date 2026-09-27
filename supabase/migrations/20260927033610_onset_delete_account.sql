-- In-app account deletion (App Store requirement). Removes the user, their projects
-- (for everyone), their saved groups, equipment library, and their memberships.
-- Applied as 20260927033610_onset_delete_account.
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  my_email text := private.auth_email();
begin
  if me is null then
    raise exception 'Sign in first';
  end if;
  delete from public.project_members where email = my_email;
  delete from public.group_members where email = my_email;
  delete from auth.users where id = me;
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
