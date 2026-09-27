-- Ignore an update carrying an older change than what's stored (a phone that was
-- offline for a while must not overwrite a teammate's newer edit).
-- Applied as 20260927032222_onset_newest_change_wins.
create or replace function public.keep_newest() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.updated_ms < old.updated_ms then
    return null;
  end if;
  new.server_updated_at := now();
  return new;
end $$;
revoke all on function public.keep_newest() from public, anon, authenticated;

drop trigger transcriptions_touch on public.transcriptions;
drop trigger transcript_lines_touch on public.transcript_lines;
drop trigger clips_touch on public.clips;
drop trigger equipment_items_touch on public.equipment_items;
drop trigger equipment_library_touch on public.equipment_library;

create trigger transcriptions_keep_newest before update on public.transcriptions
  for each row execute function public.keep_newest();
create trigger transcript_lines_keep_newest before update on public.transcript_lines
  for each row execute function public.keep_newest();
create trigger clips_keep_newest before update on public.clips
  for each row execute function public.keep_newest();
create trigger equipment_items_keep_newest before update on public.equipment_items
  for each row execute function public.keep_newest();
create trigger equipment_library_keep_newest before update on public.equipment_library
  for each row execute function public.keep_newest();

create or replace function public.guard_project_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.owner_id <> old.owner_id then
    raise exception 'Only the owner can transfer a project';
  end if;
  if new.updated_ms < old.updated_ms then
    return null;
  end if;
  if new.deleted and not old.deleted and old.owner_id <> auth.uid() then
    raise exception 'Only the owner can delete a project';
  end if;
  new.server_updated_at := now();
  return new;
end $$;
