insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'starter-beats',
  'starter-beats',
  false,
  209715200,
  array[
    'audio/mpeg',
    'audio/mp4',
    'audio/wav',
    'audio/ogg',
    'audio/webm'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.starter_beats (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 1 and 160),
  producer_name text not null check (char_length(producer_name) between 1 and 160),
  producer_profile_id uuid references public.producer_profiles(id) on delete set null,
  source_type text not null check (source_type in ('suno_licensed', 'producer_donated')),
  rights_holder text not null check (char_length(rights_holder) between 1 and 200),
  license_scope text not null default 'rapwriter_starter_nonexclusive'
    check (license_scope in ('rapwriter_starter_nonexclusive')),
  audio_bucket text not null default 'starter-beats',
  audio_path text not null,
  artwork_path text,
  duration_seconds integer not null check (duration_seconds > 0 and duration_seconds <= 1800),
  bpm integer check (bpm is null or (bpm >= 40 and bpm <= 220)),
  musical_key text,
  genre text,
  mood text,
  tags text[] not null default '{}',
  attribution text not null,
  metadata jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists starter_beats_active_order_idx
  on public.starter_beats(is_active, sort_order, created_at);

create index if not exists starter_beats_producer_profile_idx
  on public.starter_beats(producer_profile_id)
  where producer_profile_id is not null;

drop trigger if exists starter_beats_set_updated_at on public.starter_beats;
create trigger starter_beats_set_updated_at
  before update on public.starter_beats
  for each row execute function public.set_updated_at();

alter table public.starter_beats enable row level security;

drop policy if exists "starter_beats_select_active" on public.starter_beats;
create policy "starter_beats_select_active"
  on public.starter_beats
  for select
  to anon, authenticated
  using (is_active = true);

grant select on public.starter_beats to anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on public.starter_beats from anon, authenticated;
