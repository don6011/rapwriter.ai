create table if not exists public.producer_services (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  producer_profile_id uuid not null references public.producer_profiles(id) on delete cascade,
  service_type text not null check (service_type in ('custom_beat', 'co_production', 'song_feedback', 'writing_session')),
  title text not null check (char_length(title) between 2 and 80),
  description text not null default '' check (char_length(description) <= 600),
  starting_price_cents integer check (starting_price_cents is null or starting_price_cents between 0 and 10000000),
  turnaround_days integer check (turnaround_days is null or turnaround_days between 1 and 180),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.producer_collaboration_requests (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references auth.users(id) on delete cascade,
  producer_id uuid not null references auth.users(id) on delete cascade,
  producer_profile_id uuid not null references public.producer_profiles(id) on delete cascade,
  producer_service_id uuid references public.producer_services(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  song_id uuid references public.songs(id) on delete set null,
  beat_id uuid references public.producer_beats(id) on delete set null,
  title text not null check (char_length(title) between 2 and 120),
  brief text not null check (char_length(brief) between 20 and 3000),
  budget_cents integer check (budget_cents is null or budget_cents between 0 and 10000000),
  requested_deadline date,
  status text not null default 'submitted' check (status in ('submitted', 'countered', 'accepted', 'declined', 'canceled', 'completed')),
  response_note text check (response_note is null or char_length(response_note) <= 1500),
  counter_price_cents integer check (counter_price_cents is null or counter_price_cents between 0 and 10000000),
  responded_at timestamptz,
  accepted_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (artist_id <> producer_id)
);

create table if not exists public.producer_collaboration_messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.producer_collaboration_requests(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 3000),
  created_at timestamptz not null default now()
);

create index if not exists producer_services_owner_idx on public.producer_services(owner_id, is_active, created_at desc);
create index if not exists producer_services_profile_idx on public.producer_services(producer_profile_id, is_active, created_at desc);
create index if not exists producer_collaboration_artist_idx on public.producer_collaboration_requests(artist_id, updated_at desc);
create index if not exists producer_collaboration_producer_idx on public.producer_collaboration_requests(producer_id, updated_at desc);
create index if not exists producer_collaboration_messages_request_idx on public.producer_collaboration_messages(request_id, created_at);

drop trigger if exists producer_services_set_updated_at on public.producer_services;
create trigger producer_services_set_updated_at
  before update on public.producer_services
  for each row execute function public.set_updated_at();

drop trigger if exists producer_collaboration_requests_set_updated_at on public.producer_collaboration_requests;
create trigger producer_collaboration_requests_set_updated_at
  before update on public.producer_collaboration_requests
  for each row execute function public.set_updated_at();

alter table public.producer_services enable row level security;
alter table public.producer_collaboration_requests enable row level security;
alter table public.producer_collaboration_messages enable row level security;

create policy "producer_services_select_owner"
  on public.producer_services for select to authenticated
  using ((select auth.uid()) = owner_id);

create policy "producer_services_select_public"
  on public.producer_services for select to anon, authenticated
  using (
    is_active = true and exists (
      select 1 from public.producer_profiles profile
      where profile.id = producer_profile_id
        and profile.status = 'approved'
        and profile.is_public = true
    )
  );

create policy "producer_services_insert_owner"
  on public.producer_services for insert to authenticated
  with check (
    (select auth.uid()) = owner_id and exists (
      select 1 from public.producer_profiles profile
      where profile.id = producer_profile_id and profile.owner_id = (select auth.uid())
    )
  );

create policy "producer_services_update_owner"
  on public.producer_services for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check (
    (select auth.uid()) = owner_id and exists (
      select 1 from public.producer_profiles profile
      where profile.id = producer_profile_id and profile.owner_id = (select auth.uid())
    )
  );

create policy "producer_services_delete_owner"
  on public.producer_services for delete to authenticated
  using ((select auth.uid()) = owner_id);

create policy "producer_collaboration_select_participant"
  on public.producer_collaboration_requests for select to authenticated
  using ((select auth.uid()) in (artist_id, producer_id));

create policy "producer_collaboration_insert_artist"
  on public.producer_collaboration_requests for insert to authenticated
  with check (
    (select auth.uid()) = artist_id
    and artist_id <> producer_id
    and status = 'submitted'
    and exists (
      select 1 from public.producer_profiles profile
      where profile.id = producer_profile_id
        and profile.owner_id = producer_id
        and profile.status = 'approved'
        and profile.is_public = true
    )
  );

create policy "producer_collaboration_messages_select_participant"
  on public.producer_collaboration_messages for select to authenticated
  using (
    exists (
      select 1 from public.producer_collaboration_requests request
      where request.id = request_id
        and (select auth.uid()) in (request.artist_id, request.producer_id)
    )
  );

create policy "producer_collaboration_messages_insert_accepted_participant"
  on public.producer_collaboration_messages for insert to authenticated
  with check (
    (select auth.uid()) = sender_id and exists (
      select 1 from public.producer_collaboration_requests request
      where request.id = request_id
        and request.status = 'accepted'
        and (select auth.uid()) in (request.artist_id, request.producer_id)
    )
  );

update public.subscription_plans
set entitlements = jsonb_set(entitlements, '{producer_collaboration}', 'false'::jsonb, true)
where id in ('artist_free', 'artist_pro');

update public.subscription_plans
set entitlements = jsonb_set(entitlements, '{producer_collaboration}', 'true'::jsonb, true),
    limits = jsonb_set(limits, '{active_collaborations}', '5'::jsonb, true)
where id = 'artist_studio';
