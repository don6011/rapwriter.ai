create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (char_length(type) between 2 and 80),
  title text not null check (char_length(title) between 2 and 120),
  body text not null default '' check (char_length(body) <= 500),
  action_url text check (action_url is null or char_length(action_url) <= 500),
  actor_id uuid references auth.users(id) on delete set null,
  entity_type text check (entity_type is null or char_length(entity_type) <= 80),
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists user_notifications_owner_created_idx
  on public.user_notifications(owner_id, created_at desc);
create index if not exists user_notifications_owner_unread_idx
  on public.user_notifications(owner_id, created_at desc)
  where read_at is null;

alter table public.user_notifications enable row level security;

drop policy if exists "user_notifications_select_own" on public.user_notifications;
create policy "user_notifications_select_own"
  on public.user_notifications for select to authenticated
  using ((select auth.uid()) = owner_id);

drop policy if exists "user_notifications_delete_own" on public.user_notifications;
create policy "user_notifications_delete_own"
  on public.user_notifications for delete to authenticated
  using ((select auth.uid()) = owner_id);

revoke all on public.user_notifications from anon;
revoke insert, update, truncate, references, trigger on public.user_notifications from authenticated;
grant select, delete on public.user_notifications to authenticated;
grant all on public.user_notifications to service_role;

create or replace function public.mark_user_notifications_read(p_notification_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;
  update public.user_notifications
  set read_at = now()
  where owner_id = (select auth.uid())
    and read_at is null
    and (p_notification_id is null or id = p_notification_id);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.mark_user_notifications_read(uuid) from public, anon;
grant execute on function public.mark_user_notifications_read(uuid) to authenticated, service_role;

create or replace function private.notify_collaboration_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid;
  v_title text;
  v_body text;
begin
  if tg_op = 'INSERT' then
    v_owner_id := new.producer_id;
    v_title := 'New collaboration request';
    v_body := new.title;
  elsif new.status is distinct from old.status then
    if new.status in ('accepted', 'countered', 'declined', 'completed') then
      v_owner_id := new.artist_id;
    elsif new.status = 'canceled' then
      v_owner_id := new.producer_id;
    else
      return new;
    end if;
    v_title := case new.status
      when 'accepted' then 'Collaboration accepted'
      when 'countered' then 'Producer sent a counter'
      when 'declined' then 'Collaboration update'
      when 'completed' then 'Session marked complete'
      when 'canceled' then 'Collaboration canceled'
      else 'Collaboration update'
    end;
    v_body := new.title;
  else
    return new;
  end if;

  insert into public.user_notifications (
    owner_id, type, title, body, action_url, actor_id, entity_type, entity_id,
    metadata
  ) values (
    v_owner_id,
    'collaboration_' || new.status,
    v_title,
    v_body,
    '/collaborations',
    case when v_owner_id = new.artist_id then new.producer_id else new.artist_id end,
    'collaboration',
    new.id,
    jsonb_build_object('status', new.status)
  );
  return new;
end;
$$;

create or replace function private.notify_collaboration_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.producer_collaboration_requests%rowtype;
  v_owner_id uuid;
begin
  select * into v_request
  from public.producer_collaboration_requests
  where id = new.request_id;
  if not found then return new; end if;

  v_owner_id := case
    when new.sender_id = v_request.artist_id then v_request.producer_id
    else v_request.artist_id
  end;
  insert into public.user_notifications (
    owner_id, type, title, body, action_url, actor_id, entity_type, entity_id
  ) values (
    v_owner_id,
    'collaboration_message',
    'New private message',
    left(new.body, 180),
    '/collaborations',
    new.sender_id,
    'collaboration',
    new.request_id
  );
  return new;
end;
$$;

create or replace function private.notify_producer_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_notifications (
    owner_id, type, title, body, action_url, actor_id, entity_type, entity_id,
    metadata
  ) values (
    new.producer_owner_id,
    'producer_review_' || new.to_status,
    case
      when new.to_status = 'approved' then initcap(new.target_type) || ' approved'
      when new.to_status = 'rejected' then initcap(new.target_type) || ' needs attention'
      else initcap(new.target_type) || ' review updated'
    end,
    coalesce(nullif(new.notes, ''), 'Open Producer HQ for the latest review details.'),
    '/producer',
    new.reviewer_id,
    'producer_' || new.target_type,
    new.target_id,
    jsonb_build_object('status', new.to_status, 'blockers', new.blockers)
  );
  return new;
end;
$$;

create or replace function private.notify_admin_account_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_notifications (
    owner_id, type, title, body, action_url, actor_id, entity_type, entity_id,
    metadata
  ) values (
    new.subject_id,
    new.action,
    case new.action
      when 'premium_granted' then 'Membership access granted'
      when 'premium_revoked' then 'Membership access updated'
      when 'moderator_granted' then 'Moderator access granted'
      when 'moderator_revoked' then 'Moderator access removed'
      when 'account_suspended' then 'Account access suspended'
      when 'account_blocked' then 'Account access blocked'
      when 'account_restored' then 'Account access restored'
      else 'Account updated'
    end,
    new.reason,
    case when new.action like 'premium_%' then '/?view=profile' else null end,
    new.actor_id,
    'account',
    new.subject_id,
    new.details
  );
  return new;
end;
$$;

drop trigger if exists producer_collaboration_notification on public.producer_collaboration_requests;
create trigger producer_collaboration_notification
  after insert or update on public.producer_collaboration_requests
  for each row execute function private.notify_collaboration_change();

drop trigger if exists producer_collaboration_message_notification on public.producer_collaboration_messages;
create trigger producer_collaboration_message_notification
  after insert on public.producer_collaboration_messages
  for each row execute function private.notify_collaboration_message();

drop trigger if exists producer_release_review_notification on public.producer_release_reviews;
create trigger producer_release_review_notification
  after insert on public.producer_release_reviews
  for each row execute function private.notify_producer_review();

drop trigger if exists admin_account_event_notification on public.admin_account_events;
create trigger admin_account_event_notification
  after insert on public.admin_account_events
  for each row execute function private.notify_admin_account_event();

revoke execute on function private.notify_collaboration_change() from public, anon, authenticated;
revoke execute on function private.notify_collaboration_message() from public, anon, authenticated;
revoke execute on function private.notify_producer_review() from public, anon, authenticated;
revoke execute on function private.notify_admin_account_event() from public, anon, authenticated;
grant execute on function private.notify_collaboration_change() to service_role;
grant execute on function private.notify_collaboration_message() to service_role;
grant execute on function private.notify_producer_review() to service_role;
grant execute on function private.notify_admin_account_event() to service_role;
