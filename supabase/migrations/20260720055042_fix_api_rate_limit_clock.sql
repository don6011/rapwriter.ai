create or replace function public.consume_api_rate_limit(
  p_scope text,
  p_identity_hash text,
  p_limit integer,
  p_window_seconds integer
)
returns table (
  allowed boolean,
  remaining integer,
  reset_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_bucket timestamptz;
  v_count integer;
begin
  if p_scope is null
    or char_length(p_scope) not between 1 and 80
    or p_identity_hash !~ '^[0-9a-f]{64}$'
    or p_limit not between 1 and 10000
    or p_window_seconds not between 1 and 86400
  then
    raise exception 'Invalid rate limit configuration' using errcode = '22023';
  end if;

  v_bucket := to_timestamp(
    floor(extract(epoch from v_now) / p_window_seconds) * p_window_seconds
  );

  insert into public.api_rate_limits (
    scope,
    identity_hash,
    bucket_start,
    request_count,
    updated_at
  )
  values (
    p_scope,
    p_identity_hash,
    v_bucket,
    1,
    v_now
  )
  on conflict (scope, identity_hash, bucket_start)
  do update set
    request_count = public.api_rate_limits.request_count + 1,
    updated_at = excluded.updated_at
  returning request_count into v_count;

  delete from public.api_rate_limits
  where scope = p_scope
    and identity_hash = p_identity_hash
    and bucket_start < v_now - interval '2 days';

  return query
  select
    v_count <= p_limit,
    greatest(p_limit - v_count, 0),
    v_bucket + make_interval(secs => p_window_seconds);
end;
$$;

revoke all on function public.consume_api_rate_limit(text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_api_rate_limit(text, text, integer, integer)
  to service_role;
