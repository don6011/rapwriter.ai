do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'user_notifications'
  ) then
    alter publication supabase_realtime add table public.user_notifications;
  end if;
end;
$$;

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
  v_action_url text;
begin
  if tg_op = 'INSERT' then
    v_owner_id := new.producer_id;
    v_title := 'New collaboration request';
    v_body := new.title;
  elsif new.status is distinct from old.status then
    v_owner_id := case
      when new.status = 'accepted' and old.status = 'countered' then new.producer_id
      when new.status in ('accepted', 'countered', 'declined', 'completed') then new.artist_id
      when new.status = 'canceled' then new.producer_id
      else null
    end;
    if v_owner_id is null then return new; end if;
    v_title := case new.status
      when 'accepted' then 'Collaboration accepted'
      when 'countered' then 'Producer sent a counter'
      when 'declined' then 'Collaboration request declined'
      when 'completed' then 'Session marked complete'
      when 'canceled' then 'Collaboration request canceled'
      else 'Collaboration update'
    end;
    v_body := new.title;
  else
    return new;
  end if;

  v_action_url := case
    when v_owner_id = new.producer_id
      then '/collaborations?from=producer-hq&request=' || new.id::text
    else '/collaborations?request=' || new.id::text
  end;

  insert into public.user_notifications (
    owner_id, type, title, body, action_url, actor_id, entity_type, entity_id,
    metadata
  ) values (
    v_owner_id,
    'collaboration_' || new.status,
    v_title,
    v_body,
    v_action_url,
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
  v_action_url text;
begin
  select * into v_request
  from public.producer_collaboration_requests
  where id = new.request_id;
  if not found then return new; end if;

  v_owner_id := case
    when new.sender_id = v_request.artist_id then v_request.producer_id
    else v_request.artist_id
  end;
  v_action_url := case
    when v_owner_id = v_request.producer_id
      then '/collaborations?from=producer-hq&request=' || new.request_id::text
    else '/collaborations?request=' || new.request_id::text
  end;

  insert into public.user_notifications (
    owner_id, type, title, body, action_url, actor_id, entity_type, entity_id
  ) values (
    v_owner_id,
    'collaboration_message',
    'New private message',
    left(new.body, 180),
    v_action_url,
    new.sender_id,
    'collaboration',
    new.request_id
  );
  return new;
end;
$$;

revoke execute on function private.notify_collaboration_change() from public, anon, authenticated;
revoke execute on function private.notify_collaboration_message() from public, anon, authenticated;
grant execute on function private.notify_collaboration_change() to service_role;
grant execute on function private.notify_collaboration_message() to service_role;
