create sequence if not exists public.support_ticket_number_seq start with 1048;

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number text not null unique default ('RW-' || nextval('public.support_ticket_number_seq')::text),
  owner_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('account_login','membership_billing','beat_purchase_license','producer_hq','marketplace_purchase','ai_ghostwriter','technical_problem','report_content_user','other')),
  subject text not null check (char_length(subject) between 4 and 140),
  description text not null check (char_length(description) between 20 and 6000),
  status text not null default 'open' check (status in ('open','in_progress','waiting_on_customer','resolved','closed')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  assigned_to uuid references auth.users(id) on delete set null,
  related_order_id uuid references public.commerce_orders(id) on delete set null,
  related_entitlement_id uuid references public.product_entitlements(id) on delete set null,
  related_beat_id uuid references public.producer_beats(id) on delete set null,
  related_license_id uuid references public.beat_license_grants(id) on delete set null,
  platform text not null default 'web' check (char_length(platform) <= 40),
  app_version text check (char_length(app_version) <= 80),
  membership_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(membership_snapshot) = 'object'),
  entitlement_source text check (char_length(entitlement_source) <= 80),
  diagnostic_context jsonb not null default '{}'::jsonb check (jsonb_typeof(diagnostic_context) = 'object'),
  last_response_at timestamptz not null default now(),
  last_customer_response_at timestamptz,
  last_staff_response_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete restrict,
  sender_type text not null check (sender_type in ('customer','support')),
  body text not null check (char_length(body) between 1 and 6000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_attachments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  message_id uuid references public.support_messages(id) on delete cascade,
  uploader_id uuid not null references auth.users(id) on delete restrict,
  storage_bucket text not null default 'support-attachments' check (storage_bucket = 'support-attachments'),
  storage_path text not null unique,
  file_name text not null check (char_length(file_name) between 1 and 180),
  mime_type text not null check (mime_type in ('image/png','image/jpeg','image/webp','application/pdf','text/plain')),
  size_bytes bigint not null check (size_bytes between 1 and 10485760),
  created_at timestamptz not null default now()
);

create table if not exists public.support_internal_notes (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete restrict,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_events (
  id bigint generated always as identity primary key,
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in ('created','customer_replied','support_replied','assigned','status_changed','priority_changed','internal_note_added','attachment_added','resolved','closed','reopened')),
  from_value text,
  to_value text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index if not exists support_tickets_owner_updated_idx on public.support_tickets(owner_id, updated_at desc);
create index if not exists support_tickets_queue_idx on public.support_tickets(status, priority, updated_at desc);
create index if not exists support_tickets_assigned_idx on public.support_tickets(assigned_to, status, updated_at desc);
create index if not exists support_messages_ticket_created_idx on public.support_messages(ticket_id, created_at);
create index if not exists support_attachments_ticket_idx on public.support_attachments(ticket_id, created_at);
create index if not exists support_internal_notes_ticket_idx on public.support_internal_notes(ticket_id, created_at);
create index if not exists support_events_ticket_idx on public.support_events(ticket_id, created_at);

drop trigger if exists support_tickets_set_updated_at on public.support_tickets;
create trigger support_tickets_set_updated_at before update on public.support_tickets
  for each row execute function public.set_updated_at();
drop trigger if exists support_messages_set_updated_at on public.support_messages;
create trigger support_messages_set_updated_at before update on public.support_messages
  for each row execute function public.set_updated_at();
drop trigger if exists support_internal_notes_set_updated_at on public.support_internal_notes;
create trigger support_internal_notes_set_updated_at before update on public.support_internal_notes
  for each row execute function public.set_updated_at();

alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;
alter table public.support_attachments enable row level security;
alter table public.support_internal_notes enable row level security;
alter table public.support_events enable row level security;

create policy "support_tickets_customer_read" on public.support_tickets for select to authenticated
  using (owner_id = (select auth.uid()));
create policy "support_tickets_customer_create" on public.support_tickets for insert to authenticated
  with check (owner_id = (select auth.uid()) and priority = 'normal' and assigned_to is null and status = 'open');
create policy "support_tickets_staff_all" on public.support_tickets for all to authenticated
  using (exists (select 1 from public.user_roles ur where ur.user_id = (select auth.uid()) and ur.role in ('moderator','admin')))
  with check (exists (select 1 from public.user_roles ur where ur.user_id = (select auth.uid()) and ur.role in ('moderator','admin')));

create policy "support_messages_customer_read" on public.support_messages for select to authenticated
  using (exists (select 1 from public.support_tickets t where t.id = ticket_id and t.owner_id = (select auth.uid())));
create policy "support_messages_customer_reply" on public.support_messages for insert to authenticated
  with check (sender_id = (select auth.uid()) and sender_type = 'customer' and exists (
    select 1 from public.support_tickets t where t.id = ticket_id and t.owner_id = (select auth.uid()) and t.status in ('open','in_progress','waiting_on_customer')
  ));
create policy "support_messages_staff_all" on public.support_messages for all to authenticated
  using (exists (select 1 from public.user_roles ur where ur.user_id = (select auth.uid()) and ur.role in ('moderator','admin')))
  with check (exists (select 1 from public.user_roles ur where ur.user_id = (select auth.uid()) and ur.role in ('moderator','admin')));

create policy "support_attachments_customer_read" on public.support_attachments for select to authenticated
  using (exists (select 1 from public.support_tickets t where t.id = ticket_id and t.owner_id = (select auth.uid())));
create policy "support_attachments_customer_create" on public.support_attachments for insert to authenticated
  with check (uploader_id = (select auth.uid()) and exists (select 1 from public.support_tickets t where t.id = ticket_id and t.owner_id = (select auth.uid())));
create policy "support_attachments_staff_all" on public.support_attachments for all to authenticated
  using (exists (select 1 from public.user_roles ur where ur.user_id = (select auth.uid()) and ur.role in ('moderator','admin')))
  with check (exists (select 1 from public.user_roles ur where ur.user_id = (select auth.uid()) and ur.role in ('moderator','admin')));

create policy "support_internal_notes_staff_only" on public.support_internal_notes for all to authenticated
  using (exists (select 1 from public.user_roles ur where ur.user_id = (select auth.uid()) and ur.role in ('moderator','admin')))
  with check (exists (select 1 from public.user_roles ur where ur.user_id = (select auth.uid()) and ur.role in ('moderator','admin')));
create policy "support_events_staff_only" on public.support_events for select to authenticated
  using (exists (select 1 from public.user_roles ur where ur.user_id = (select auth.uid()) and ur.role in ('moderator','admin')));

revoke all on public.support_tickets, public.support_messages, public.support_attachments, public.support_internal_notes, public.support_events from anon;
revoke update, delete on public.support_tickets, public.support_messages, public.support_attachments from authenticated;
revoke all on public.support_internal_notes, public.support_events from authenticated;
grant select, insert on public.support_tickets, public.support_messages, public.support_attachments to authenticated;
grant select, insert, update, delete on public.support_tickets, public.support_messages, public.support_attachments, public.support_internal_notes to service_role;
grant select, insert on public.support_events to service_role;
grant usage, select on sequence public.support_ticket_number_seq to authenticated, service_role;
grant usage, select on sequence public.support_events_id_seq to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('support-attachments', 'support-attachments', false, 10485760, array['image/png','image/jpeg','image/webp','application/pdf','text/plain'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "support_storage_customer_read" on storage.objects for select to authenticated
  using (bucket_id = 'support-attachments' and exists (
    select 1 from public.support_tickets t where t.id::text = (storage.foldername(name))[1] and t.owner_id = (select auth.uid())
  ));
create policy "support_storage_customer_upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'support-attachments' and exists (
    select 1 from public.support_tickets t where t.id::text = (storage.foldername(name))[1] and t.owner_id = (select auth.uid())
  ));
create policy "support_storage_staff_read" on storage.objects for select to authenticated
  using (bucket_id = 'support-attachments' and exists (
    select 1 from public.user_roles ur where ur.user_id = (select auth.uid()) and ur.role in ('moderator','admin')
  ));

alter table public.growth_events drop constraint if exists growth_events_event_name_check;
alter table public.growth_events add constraint growth_events_event_name_check check (event_name in (
  'campaign_viewed','campaign_claim_attempted','campaign_claimed','campaign_full','promo_started','promo_expired','promo_converted_to_paid',
  'referral_created','referral_registered','referral_qualified','referral_rewarded','membership_upgraded','membership_downgraded',
  'support_opened','help_article_viewed','ticket_started','ticket_submitted','ticket_replied','ticket_resolved'
));
