create or replace function public.get_or_create_producer_referral_code()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid := auth.uid();
  v_code text;
begin
  if v_owner_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;
  if not exists (
    select 1
    from public.user_roles
    where user_id = v_owner_id
      and role in ('producer', 'admin')
  ) then
    raise exception using errcode = '42501', message = 'Producer account required';
  end if;

  select code
  into v_code
  from public.producer_referral_codes
  where owner_id = v_owner_id
    and is_active = true;

  if v_code is not null then
    return v_code;
  end if;

  loop
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
    begin
      insert into public.producer_referral_codes(owner_id, code)
      values (v_owner_id, v_code);
      return v_code;
    exception when unique_violation then
      select code
      into v_code
      from public.producer_referral_codes
      where owner_id = v_owner_id;

      if v_code is not null then
        return v_code;
      end if;
    end;
  end loop;

  return v_code;
end;
$$;

revoke all on function public.get_or_create_producer_referral_code() from public, anon;
grant execute on function public.get_or_create_producer_referral_code() to authenticated;
