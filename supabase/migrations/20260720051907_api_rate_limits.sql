create table public.api_rate_limits (
  scope text not null check (char_length(scope) between 1 and 80),
  identity_hash text not null check (char_length(identity_hash) = 64),
  bucket_start timestamptz not null,
  request_count integer not null default 1 check (request_count > 0),
  updated_at timestamptz not null default now(),
  primary key (scope, identity_hash, bucket_start)
);

create index api_rate_limits_updated_idx
  on public.api_rate_limits (updated_at);

alter table public.api_rate_limits enable row level security;

revoke all on table public.api_rate_limits from public, anon, authenticated;
grant all on table public.api_rate_limits to service_role;

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
  current_time timestamptz := clock_timestamp();
  current_bucket timestamptz;
  next_count integer;
begin
  if p_scope is null
    or char_length(p_scope) not between 1 and 80
    or p_identity_hash !~ '^[0-9a-f]{64}$'
    or p_limit not between 1 and 10000
    or p_window_seconds not between 1 and 86400
  then
    raise exception 'Invalid rate limit configuration' using errcode = '22023';
  end if;

  current_bucket := to_timestamp(
    floor(extract(epoch from current_time) / p_window_seconds) * p_window_seconds
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
    current_bucket,
    1,
    current_time
  )
  on conflict (scope, identity_hash, bucket_start)
  do update set
    request_count = public.api_rate_limits.request_count + 1,
    updated_at = excluded.updated_at
  returning request_count into next_count;

  delete from public.api_rate_limits
  where scope = p_scope
    and identity_hash = p_identity_hash
    and bucket_start < current_time - interval '2 days';

  return query
  select
    next_count <= p_limit,
    greatest(p_limit - next_count, 0),
    current_bucket + make_interval(secs => p_window_seconds);
end;
$$;

revoke all on function public.consume_api_rate_limit(text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_api_rate_limit(text, text, integer, integer)
  to service_role;
