insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'collaboration-files',
  'collaboration-files',
  false,
  262144000,
  array[
    'audio/mpeg',
    'audio/mp4',
    'audio/wav',
    'audio/x-wav',
    'audio/wave',
    'audio/vnd.wave',
    'audio/x-m4a',
    'audio/ogg',
    'audio/webm',
    'application/zip',
    'application/x-zip-compressed'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

alter table public.producer_collaboration_requests
  add column if not exists handoff_status text not null default 'not_started';

alter table public.producer_collaboration_requests
  drop constraint if exists producer_collaboration_handoff_status_check;

alter table public.producer_collaboration_requests
  add constraint producer_collaboration_handoff_status_check
  check (handoff_status in ('not_started', 'delivered', 'revision_requested', 'approved'));

create table if not exists public.producer_collaboration_deliverables (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.producer_collaboration_requests(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  version_number integer not null default 1 check (version_number > 0),
  title text not null check (char_length(title) between 2 and 100),
  note text not null default '' check (char_length(note) <= 1500),
  storage_bucket text not null default 'collaboration-files' check (storage_bucket = 'collaboration-files'),
  storage_path text not null unique check (char_length(storage_path) between 12 and 500),
  file_name text not null check (char_length(file_name) between 1 and 180),
  mime_type text not null check (char_length(mime_type) between 3 and 100),
  byte_size bigint not null check (byte_size between 1 and 262144000),
  status text not null default 'delivered' check (status in ('delivered', 'revision_requested', 'approved')),
  artist_feedback text check (artist_feedback is null or char_length(artist_feedback) between 3 and 1500),
  delivered_at timestamptz not null default now(),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (request_id, version_number)
);

create index if not exists producer_collaboration_deliverables_request_idx
  on public.producer_collaboration_deliverables(request_id, version_number desc);

create index if not exists producer_collaboration_deliverables_sender_idx
  on public.producer_collaboration_deliverables(sender_id, created_at desc);

drop trigger if exists producer_collaboration_deliverables_set_updated_at on public.producer_collaboration_deliverables;
create trigger producer_collaboration_deliverables_set_updated_at
  before update on public.producer_collaboration_deliverables
  for each row execute function public.set_updated_at();

alter table public.producer_collaboration_deliverables enable row level security;

drop policy if exists "producer_collaboration_deliverables_select_participant" on public.producer_collaboration_deliverables;
create policy "producer_collaboration_deliverables_select_participant"
  on public.producer_collaboration_deliverables for select to authenticated
  using (
    exists (
      select 1
      from public.producer_collaboration_requests request
      where request.id = request_id
        and (select auth.uid()) in (request.artist_id, request.producer_id)
    )
  );

drop policy if exists "producer_collaboration_deliverables_insert_producer" on public.producer_collaboration_deliverables;
create policy "producer_collaboration_deliverables_insert_producer"
  on public.producer_collaboration_deliverables for insert to authenticated
  with check (
    (select auth.uid()) = sender_id
    and status = 'delivered'
    and storage_bucket = 'collaboration-files'
    and exists (
      select 1
      from public.producer_collaboration_requests request
      where request.id = request_id
        and request.producer_id = (select auth.uid())
        and request.status = 'accepted'
        and request.handoff_status in ('not_started', 'revision_requested')
    )
  );

revoke all on table public.producer_collaboration_deliverables from anon;
revoke update, delete on table public.producer_collaboration_deliverables from authenticated;
grant select, insert on table public.producer_collaboration_deliverables to authenticated;
grant all on table public.producer_collaboration_deliverables to service_role;

create or replace function private.assign_collaboration_deliverable_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.request_id::text, 0));
  select coalesce(max(version_number), 0) + 1
    into new.version_number
  from public.producer_collaboration_deliverables
  where request_id = new.request_id;
  return new;
end;
$$;

drop trigger if exists assign_collaboration_deliverable_version on public.producer_collaboration_deliverables;
create trigger assign_collaboration_deliverable_version
  before insert on public.producer_collaboration_deliverables
  for each row execute function private.assign_collaboration_deliverable_version();

create or replace function private.sync_collaboration_handoff()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or old.status is distinct from new.status then
    update public.producer_collaboration_requests
    set handoff_status = case new.status
          when 'revision_requested' then 'revision_requested'
          when 'approved' then 'approved'
          else 'delivered'
        end,
        status = case when new.status = 'approved' then 'completed' else status end,
        completed_at = case when new.status = 'approved' then now() else completed_at end
    where id = new.request_id;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_collaboration_handoff on public.producer_collaboration_deliverables;
create trigger sync_collaboration_handoff
  after insert or update of status on public.producer_collaboration_deliverables
  for each row execute function private.sync_collaboration_handoff();

create or replace function private.notify_collaboration_deliverable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.producer_collaboration_requests%rowtype;
  v_owner_id uuid;
  v_title text;
  v_body text;
  v_action_url text;
begin
  if tg_op = 'UPDATE' and old.status is not distinct from new.status then
    return new;
  end if;

  select * into v_request
  from public.producer_collaboration_requests
  where id = new.request_id;
  if not found then return new; end if;

  if tg_op = 'INSERT' then
    v_owner_id := v_request.artist_id;
    v_title := 'New delivery ready';
    v_body := new.title || ' is ready to review.';
    v_action_url := '/collaborations?request=' || new.request_id::text;
  elsif new.status = 'revision_requested' then
    v_owner_id := v_request.producer_id;
    v_title := 'Revision requested';
    v_body := coalesce(new.artist_feedback, 'The artist left revision notes.');
    v_action_url := '/collaborations?from=producer-hq&request=' || new.request_id::text;
  else
    -- The request-status trigger sends the single completion alert after approval.
    return new;
  end if;

  insert into public.user_notifications (
    owner_id, type, title, body, action_url, actor_id, entity_type, entity_id,
    metadata
  ) values (
    v_owner_id,
    case when tg_op = 'INSERT' then 'collaboration_delivery_ready' else 'collaboration_delivery_' || new.status end,
    v_title,
    left(v_body, 180),
    v_action_url,
    case when tg_op = 'INSERT' then v_request.producer_id else v_request.artist_id end,
    'collaboration_deliverable',
    new.id,
    jsonb_build_object('request_id', new.request_id, 'status', new.status, 'version', new.version_number)
  );
  return new;
end;
$$;

drop trigger if exists producer_collaboration_deliverable_notification on public.producer_collaboration_deliverables;
create trigger producer_collaboration_deliverable_notification
  after insert or update of status on public.producer_collaboration_deliverables
  for each row execute function private.notify_collaboration_deliverable();

revoke execute on function private.assign_collaboration_deliverable_version() from public, anon, authenticated;
revoke execute on function private.sync_collaboration_handoff() from public, anon, authenticated;
revoke execute on function private.notify_collaboration_deliverable() from public, anon, authenticated;
grant execute on function private.assign_collaboration_deliverable_version() to service_role;
grant execute on function private.sync_collaboration_handoff() to service_role;
grant execute on function private.notify_collaboration_deliverable() to service_role;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'producer_collaboration_deliverables'
  ) then
    alter publication supabase_realtime add table public.producer_collaboration_deliverables;
  end if;
end
$$;
