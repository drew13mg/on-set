-- Shot tiles get a title of up to 30 characters (stored in shots.description).
alter table public.shots add constraint shots_title_length check (char_length(description) <= 30);
comment on column public.shots.description is 'Shot title shown on the tile, max 30 characters';
