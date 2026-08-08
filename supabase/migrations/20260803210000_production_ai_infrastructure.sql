create table if not exists public.ai_feature_configs (
  feature_code text primary key check (feature_code in (
    'ghostwriter','hook_doctor','rewrite','commercial_pass','pocket_adjustment',
    'studio_coach','booth_ready','studio_dna','performance_analysis','producer_intelligence'
  )),
  display_name text not null,
  enabled boolean not null default true,
  required_entitlement text,
  model_tier text not null default 'balanced' check (model_tier in ('fast','balanced','advanced')),
  timeout_ms integer not null default 20000 check (timeout_ms between 3000 and 60000),
  max_output_tokens integer not null default 1200 check (max_output_tokens between 100 and 8000),
  daily_limits jsonb not null default '{}'::jsonb check (jsonb_typeof(daily_limits) = 'object'),
  supports_streaming boolean not null default false,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_prompt_versions (
  id uuid primary key default gen_random_uuid(),
  feature_code text not null references public.ai_feature_configs(feature_code) on delete cascade,
  version integer not null check (version > 0),
  system_prompt text not null check (char_length(system_prompt) between 40 and 12000),
  output_schema jsonb not null default '{}'::jsonb check (jsonb_typeof(output_schema) = 'object'),
  active boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(feature_code, version)
);
create unique index if not exists ai_prompt_versions_one_active_idx
  on public.ai_prompt_versions(feature_code) where active;

create table if not exists public.ai_usage_ledger (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  feature_code text not null references public.ai_feature_configs(feature_code),
  prompt_version_id uuid references public.ai_prompt_versions(id) on delete set null,
  membership_plan_id text,
  provider text not null default 'openai',
  model text,
  provider_request_id text,
  status text not null default 'running' check (status in ('running','succeeded','failed')),
  input_tokens integer not null default 0 check (input_tokens >= 0),
  cached_input_tokens integer not null default 0 check (cached_input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  estimated_cost_micros bigint not null default 0 check (estimated_cost_micros >= 0),
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  error_code text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(owner_id, request_id)
);
create index if not exists ai_usage_ledger_feature_created_idx on public.ai_usage_ledger(feature_code, created_at desc);
create index if not exists ai_usage_ledger_owner_created_idx on public.ai_usage_ledger(owner_id, created_at desc);

create table if not exists public.ai_request_results (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  feature_code text not null references public.ai_feature_configs(feature_code),
  response_payload jsonb not null check (jsonb_typeof(response_payload) = 'object'),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now(),
  unique(owner_id, request_id)
);

create table if not exists public.ai_studio_dna_profiles (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  traits jsonb not null default '{}'::jsonb check (jsonb_typeof(traits) = 'object' and pg_column_size(traits) <= 32768),
  source_session_count integer not null default 0 check (source_session_count >= 0),
  model text,
  prompt_version_id uuid references public.ai_prompt_versions(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists ai_feature_configs_set_updated_at on public.ai_feature_configs;
create trigger ai_feature_configs_set_updated_at before update on public.ai_feature_configs
  for each row execute function public.set_updated_at();
drop trigger if exists ai_prompt_versions_set_updated_at on public.ai_prompt_versions;
create trigger ai_prompt_versions_set_updated_at before update on public.ai_prompt_versions
  for each row execute function public.set_updated_at();
drop trigger if exists ai_studio_dna_profiles_set_updated_at on public.ai_studio_dna_profiles;
create trigger ai_studio_dna_profiles_set_updated_at before update on public.ai_studio_dna_profiles
  for each row execute function public.set_updated_at();

alter table public.ai_feature_configs enable row level security;
alter table public.ai_prompt_versions enable row level security;
alter table public.ai_usage_ledger enable row level security;
alter table public.ai_request_results enable row level security;
alter table public.ai_studio_dna_profiles enable row level security;

create policy "ai_feature_configs_staff_read" on public.ai_feature_configs for select to authenticated
  using (exists (select 1 from public.user_roles ur where ur.user_id = (select auth.uid()) and ur.role in ('moderator','admin')));
create policy "ai_prompt_versions_staff_read" on public.ai_prompt_versions for select to authenticated
  using (exists (select 1 from public.user_roles ur where ur.user_id = (select auth.uid()) and ur.role in ('moderator','admin')));
create policy "ai_usage_ledger_owner_read" on public.ai_usage_ledger for select to authenticated
  using (owner_id = (select auth.uid()));
create policy "ai_usage_ledger_staff_read" on public.ai_usage_ledger for select to authenticated
  using (exists (select 1 from public.user_roles ur where ur.user_id = (select auth.uid()) and ur.role in ('moderator','admin')));
create policy "ai_request_results_owner_read" on public.ai_request_results for select to authenticated
  using (owner_id = (select auth.uid()) and expires_at > now());
create policy "ai_studio_dna_owner_read" on public.ai_studio_dna_profiles for select to authenticated
  using (owner_id = (select auth.uid()));
create policy "ai_studio_dna_staff_read" on public.ai_studio_dna_profiles for select to authenticated
  using (exists (select 1 from public.user_roles ur where ur.user_id = (select auth.uid()) and ur.role in ('moderator','admin')));

revoke all on public.ai_feature_configs, public.ai_prompt_versions, public.ai_usage_ledger, public.ai_request_results, public.ai_studio_dna_profiles from anon;
revoke insert, update, delete on public.ai_feature_configs, public.ai_prompt_versions, public.ai_usage_ledger, public.ai_request_results, public.ai_studio_dna_profiles from authenticated;
grant select on public.ai_feature_configs, public.ai_prompt_versions, public.ai_usage_ledger, public.ai_request_results, public.ai_studio_dna_profiles to authenticated;
grant all on public.ai_feature_configs, public.ai_prompt_versions, public.ai_usage_ledger, public.ai_request_results, public.ai_studio_dna_profiles to service_role;

alter table public.producer_actions add column if not exists request_id uuid;
alter table public.producer_actions add column if not exists ai_usage_id uuid references public.ai_usage_ledger(id) on delete set null;
create unique index if not exists producer_actions_owner_request_idx on public.producer_actions(owner_id, request_id) where request_id is not null;

insert into public.ai_feature_configs(feature_code, display_name, required_entitlement, model_tier, timeout_ms, max_output_tokens, daily_limits)
values
  ('ghostwriter','Ghostwriter','ghostwriter','balanced',22000,1400,'{"artist_free":3,"artist_pro":20,"artist_studio":50}'),
  ('hook_doctor','Hook Doctor','hook_doctor','balanced',22000,1200,'{"artist_pro":20,"artist_studio":50}'),
  ('rewrite','Producer Rewrite','rewrite','balanced',22000,1400,'{"artist_pro":20,"artist_studio":50}'),
  ('commercial_pass','Commercial Pass','commercial_pass','advanced',26000,1400,'{"artist_pro":12,"artist_studio":40}'),
  ('pocket_adjustment','Pocket Adjustment','ghostwriter','fast',18000,1000,'{"artist_free":3,"artist_pro":20,"artist_studio":50}'),
  ('studio_coach','Studio Coach','producer_notes','fast',18000,900,'{"artist_pro":30,"artist_studio":80}'),
  ('booth_ready','Advanced Booth Ready','advanced_booth_ready','advanced',26000,1400,'{"artist_pro":10,"artist_studio":30}'),
  ('studio_dna','Studio DNA','studio_dna_full','fast',18000,900,'{"artist_pro":10,"artist_studio":30}'),
  ('performance_analysis','Performance Coach','performance_coach','advanced',30000,1600,'{"artist_studio":20}'),
  ('producer_intelligence','Producer Intelligence','producer_intelligence','balanced',22000,1200,'{"producer_pro":30}')
on conflict (feature_code) do nothing;

insert into public.ai_prompt_versions(feature_code, version, system_prompt, output_schema, active)
select config.feature_code, 1,
  'You are RapWriter, an in-session record-development partner. Revise only the supplied section. Preserve the artist point of view, core nouns, images, slang, explicitness, and emotional intent. Never imitate a named living artist, reproduce copyrighted lyrics, promise commercial success, or replace the artist voice. Make the smallest useful change for the requested pass. Return only the required structured result.',
  '{"type":"object","additionalProperties":false,"required":["proposedContent","rationale","changes"],"properties":{"proposedContent":{"type":"string"},"rationale":{"type":"string"},"changes":{"type":"array","items":{"type":"string"},"minItems":1,"maxItems":4}}}',
  true
from public.ai_feature_configs config
where config.feature_code in ('ghostwriter','hook_doctor','rewrite','commercial_pass','pocket_adjustment')
on conflict (feature_code, version) do nothing;

alter table public.growth_events drop constraint if exists growth_events_event_name_check;
alter table public.growth_events add constraint growth_events_event_name_check check (event_name in (
  'campaign_viewed','campaign_claim_attempted','campaign_claimed','campaign_full','promo_started','promo_expired','promo_converted_to_paid',
  'referral_created','referral_registered','referral_qualified','referral_rewarded','membership_upgraded','membership_downgraded',
  'support_opened','help_article_viewed','ticket_started','ticket_submitted','ticket_replied','ticket_resolved',
  'ai_feature_started','ai_feature_completed','ai_feature_failed','ai_limit_reached'
));
