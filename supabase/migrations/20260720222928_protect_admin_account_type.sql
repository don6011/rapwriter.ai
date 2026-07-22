create or replace function private.enforce_profile_admin_role()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  has_admin_role boolean;
begin
  select exists (
    select 1
    from public.user_roles
    where user_id = new.id
      and role = 'admin'::public.app_role
  ) into has_admin_role;

  if new.account_type = 'admin' and not has_admin_role then
    raise exception 'Admin account type requires an admin role'
      using errcode = '42501';
  end if;

  if tg_op = 'UPDATE'
    and old.account_type = 'admin'
    and new.account_type <> 'admin'
    and has_admin_role then
    raise exception 'Remove the admin role before changing the admin account type'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke execute on function private.enforce_profile_admin_role() from public, anon, authenticated;
grant execute on function private.enforce_profile_admin_role() to service_role;

drop trigger if exists enforce_profile_admin_role on public.profiles;
create trigger enforce_profile_admin_role
  before insert or update of account_type on public.profiles
  for each row execute function private.enforce_profile_admin_role();
