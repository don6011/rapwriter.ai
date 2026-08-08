do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'producer_collaboration_requests'
  ) then
    alter publication supabase_realtime add table public.producer_collaboration_requests;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'producer_collaboration_messages'
  ) then
    alter publication supabase_realtime add table public.producer_collaboration_messages;
  end if;
end
$$;

grant select on table public.producer_collaboration_requests to authenticated;
grant select on table public.producer_collaboration_messages to authenticated;
