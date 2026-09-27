-- When a shot's status (done / active / none) last changed, for the live tracker.
alter table public.shots add column status_ms bigint;
comment on column public.shots.status_ms is 'Client time (ms) the status last changed';
