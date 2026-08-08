drop policy if exists "user_notifications_delete_own" on public.user_notifications;
revoke delete on public.user_notifications from authenticated;

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
