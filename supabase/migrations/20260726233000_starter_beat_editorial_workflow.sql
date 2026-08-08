-- Launch Beat Content Pass: reversible editorial controls for RapWriter stock beats.

alter table public.starter_beats
  add column if not exists status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  add column if not exists is_featured boolean not null default false,
  add column if not exists preview_seconds integer not null default 30
    check (preview_seconds between 15 and 60),
  add column if not exists published_at timestamptz,
  add column if not exists archived_at timestamptz;

update public.starter_beats
set status = case when is_active then 'published' else 'draft' end,
    published_at = case when is_active then coalesce(published_at, created_at) else published_at end
where status = 'draft';

create index if not exists starter_beats_editorial_idx
  on public.starter_beats(status, is_featured desc, sort_order, created_at)
  where is_active = true;

drop policy if exists "starter_beats_select_active" on public.starter_beats;
create policy "starter_beats_select_published"
  on public.starter_beats
  for select
  to anon, authenticated
  using (status = 'published' and is_active = true);

create or replace function public.sync_starter_beat_editorial_state()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.is_active := new.status = 'published';
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    new.published_at := now();
    new.archived_at := null;
  elsif new.status = 'archived' and (tg_op = 'INSERT' or old.status is distinct from 'archived') then
    new.archived_at := now();
  elsif new.status = 'draft' then
    new.archived_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists starter_beats_sync_editorial_state on public.starter_beats;
create trigger starter_beats_sync_editorial_state
  before insert or update of status on public.starter_beats
  for each row execute function public.sync_starter_beat_editorial_state();
