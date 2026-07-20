alter table public.producer_profiles
  add column if not exists studio_name text,
  add column if not exists state text,
  add column if not exists country text not null default 'United States',
  add column if not exists years_producing integer check (years_producing is null or years_producing between 0 and 80),
  add column if not exists website_url text,
  add column if not exists instagram_url text,
  add column if not exists youtube_url text,
  add column if not exists beatstars_url text,
  add column if not exists specialties text[] not null default '{}';

create table if not exists public.producer_business_settings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  producer_profile_id uuid not null references public.producer_profiles(id) on delete cascade,
  business_email text,
  contact_preference text not null default 'platform'
    check (contact_preference in ('platform', 'email', 'website', 'social', 'hidden')),
  license_settings jsonb not null default '{"lease":49,"premium":149,"unlimited":299,"exclusive":899}'::jsonb,
  default_license_terms text,
  automatic_delivery boolean not null default true,
  onboarding_step integer not null default 1 check (onboarding_step between 1 and 5),
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id),
  unique(producer_profile_id)
);

create table if not exists public.producer_billing_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  producer_profile_id uuid not null references public.producer_profiles(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'studio_pro', 'elite')),
  stripe_account_id text,
  stripe_status text not null default 'not_connected'
    check (stripe_status in ('not_connected', 'pending', 'restricted', 'active')),
  charges_enabled boolean not null default false,
  payouts_enabled boolean not null default false,
  verification jsonb not null default '{"email":false,"phone":false,"social":false,"portfolio":false}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id),
  unique(producer_profile_id),
  unique(stripe_account_id)
);

create table if not exists public.producer_metrics (
  producer_profile_id uuid primary key references public.producer_profiles(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  profile_views bigint not null default 0 check (profile_views >= 0),
  beat_plays bigint not null default 0 check (beat_plays >= 0),
  favorites bigint not null default 0 check (favorites >= 0),
  beat_adds bigint not null default 0 check (beat_adds >= 0),
  followers bigint not null default 0 check (followers >= 0),
  sales bigint not null default 0 check (sales >= 0),
  repeat_customers bigint not null default 0 check (repeat_customers >= 0),
  revenue_cents bigint not null default 0 check (revenue_cents >= 0),
  revenue_month_cents bigint not null default 0 check (revenue_month_cents >= 0),
  revenue_year_cents bigint not null default 0 check (revenue_year_cents >= 0),
  average_listen_seconds integer not null default 0 check (average_listen_seconds >= 0),
  top_city text,
  top_state text,
  updated_at timestamptz not null default now(),
  unique(owner_id)
);

create index if not exists producer_profiles_specialties_idx on public.producer_profiles using gin(specialties);
create index if not exists producer_business_settings_owner_idx on public.producer_business_settings(owner_id);
create index if not exists producer_billing_accounts_owner_idx on public.producer_billing_accounts(owner_id);
create index if not exists producer_metrics_owner_idx on public.producer_metrics(owner_id);

create or replace function public.protect_producer_profile_review_fields()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if current_user = 'authenticated' then
    if tg_op = 'INSERT' then
      new.status := 'draft';
      new.verified := false;
      new.is_public := false;
    else
      new.status := old.status;
      new.verified := old.verified;
      new.is_public := old.is_public;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists producer_profiles_protect_review_fields on public.producer_profiles;
create trigger producer_profiles_protect_review_fields
  before insert or update on public.producer_profiles
  for each row execute function public.protect_producer_profile_review_fields();

create or replace function public.protect_producer_beat_review_fields()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if current_user = 'authenticated' then
    if new.status not in ('draft', 'submitted') then
      new.status := case when tg_op = 'UPDATE' then old.status else 'draft' end;
    end if;
    if tg_op = 'UPDATE' then
      new.admin_notes := old.admin_notes;
      new.metadata := (coalesce(new.metadata, '{}'::jsonb) - 'featured' - 'reviewed_by' - 'reviewed_at')
        || jsonb_strip_nulls(jsonb_build_object(
          'featured', old.metadata -> 'featured',
          'reviewed_by', old.metadata -> 'reviewed_by',
          'reviewed_at', old.metadata -> 'reviewed_at'
        ));
    else
      new.admin_notes := null;
      new.metadata := coalesce(new.metadata, '{}'::jsonb) - 'featured' - 'reviewed_by' - 'reviewed_at';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists producer_beats_protect_review_fields on public.producer_beats;
create trigger producer_beats_protect_review_fields
  before insert or update on public.producer_beats
  for each row execute function public.protect_producer_beat_review_fields();

drop trigger if exists producer_business_settings_set_updated_at on public.producer_business_settings;
create trigger producer_business_settings_set_updated_at
  before update on public.producer_business_settings
  for each row execute function public.set_updated_at();

drop trigger if exists producer_billing_accounts_set_updated_at on public.producer_billing_accounts;
create trigger producer_billing_accounts_set_updated_at
  before update on public.producer_billing_accounts
  for each row execute function public.set_updated_at();

drop trigger if exists producer_metrics_set_updated_at on public.producer_metrics;
create trigger producer_metrics_set_updated_at
  before update on public.producer_metrics
  for each row execute function public.set_updated_at();

alter table public.producer_business_settings enable row level security;
alter table public.producer_billing_accounts enable row level security;
alter table public.producer_metrics enable row level security;

drop policy if exists "producer_business_settings_select_own" on public.producer_business_settings;
drop policy if exists "producer_business_settings_insert_own" on public.producer_business_settings;
drop policy if exists "producer_business_settings_update_own" on public.producer_business_settings;
drop policy if exists "producer_business_settings_delete_own" on public.producer_business_settings;

create policy "producer_business_settings_select_own"
  on public.producer_business_settings for select to authenticated
  using ((select auth.uid()) = owner_id);

create policy "producer_business_settings_insert_own"
  on public.producer_business_settings for insert to authenticated
  with check ((select auth.uid()) = owner_id);

create policy "producer_business_settings_update_own"
  on public.producer_business_settings for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "producer_business_settings_delete_own"
  on public.producer_business_settings for delete to authenticated
  using ((select auth.uid()) = owner_id);

drop policy if exists "producer_billing_accounts_select_own" on public.producer_billing_accounts;
create policy "producer_billing_accounts_select_own"
  on public.producer_billing_accounts for select to authenticated
  using ((select auth.uid()) = owner_id);

drop policy if exists "producer_metrics_select_own" on public.producer_metrics;
create policy "producer_metrics_select_own"
  on public.producer_metrics for select to authenticated
  using ((select auth.uid()) = owner_id);

drop policy if exists "producer_playlists_select_public" on public.producer_playlists;
create policy "producer_playlists_select_public"
  on public.producer_playlists for select to anon, authenticated
  using (
    status = 'published'
    and exists (
      select 1 from public.producer_profiles profiles
      where profiles.id = public.producer_playlists.producer_profile_id
        and profiles.status = 'approved'
        and profiles.is_public = true
    )
  );

drop policy if exists "producer_playlist_items_select_public" on public.producer_playlist_items;
create policy "producer_playlist_items_select_public"
  on public.producer_playlist_items for select to anon, authenticated
  using (
    exists (
      select 1 from public.producer_playlists playlists
      where playlists.id = public.producer_playlist_items.playlist_id
        and playlists.status = 'published'
    )
    and exists (
      select 1 from public.producer_beats beats
      where beats.id = public.producer_playlist_items.beat_id
        and beats.status = 'approved'
    )
  );

grant select, insert, update, delete on public.producer_business_settings to authenticated;
grant select on public.producer_billing_accounts to authenticated;
grant select on public.producer_metrics to authenticated;
grant all on public.producer_business_settings, public.producer_billing_accounts, public.producer_metrics to service_role;
