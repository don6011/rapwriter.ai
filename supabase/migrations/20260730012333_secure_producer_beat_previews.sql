comment on column public.producer_beats.metadata is
  'Editorial metadata plus protected preview_path, preview_duration_seconds, and preview_version fields.';

create or replace function public.require_producer_beat_store_preview()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  preview_path text;
  preview_duration integer;
begin
  if new.status not in ('submitted', 'approved') then
    return new;
  end if;

  preview_path := nullif(btrim(coalesce(new.metadata ->> 'preview_path', '')), '');
  begin
    preview_duration := (new.metadata ->> 'preview_duration_seconds')::integer;
  exception when others then
    preview_duration := null;
  end;

  if preview_path is null
    or preview_path = new.audio_path
    or preview_path not like new.owner_id::text || '/previews/%'
    or preview_path like '%..%'
    or preview_duration is null
    or preview_duration < 1
    or preview_duration > 30
  then
    raise exception 'A separate secure Store preview no longer than 30 seconds is required'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists producer_beats_require_store_preview on public.producer_beats;
create trigger producer_beats_require_store_preview
  before insert or update of status, audio_path, metadata on public.producer_beats
  for each row execute function public.require_producer_beat_store_preview();
