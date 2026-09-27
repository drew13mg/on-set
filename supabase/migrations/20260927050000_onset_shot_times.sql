-- Scheduled time of day for each shot (minutes after midnight), shown on the tile and the schedule graph.
alter table public.shots add column time_min smallint check (time_min between 0 and 1439);
comment on column public.shots.time_min is 'Scheduled time of day, minutes after midnight';
