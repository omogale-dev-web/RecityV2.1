-- RECITY Waste Intelligence OS: secure foundation migration
-- Run this file once in Supabase Dashboard → SQL Editor.
-- Public clients use RLS. Service-role access is server-only.

create extension if not exists pgcrypto;

create type public.app_role as enum ('citizen', 'collector', 'supervisor', 'admin');
create type public.report_status as enum ('draft', 'submitted', 'ai_checked', 'verified', 'assigned', 'accepted', 'collected', 'proof_reviewed', 'resolved', 'rejected');

create table public.wards (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  municipality text not null default 'Udgir',
  code text not null unique,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  recity_id text not null unique check (recity_id ~ '^RCY-[A-Z0-9]{3}-[A-Z0-9]{4}-[A-Z0-9]{4}$'),
  display_name text not null check (char_length(display_name) between 2 and 80),
  eco_identity text not null default 'Seedling' check (eco_identity in ('Seedling','Eco Explorer','Green Guardian','City Shaper')),
  locale text not null default 'en' check (locale in ('en','mr')),
  ward_id uuid references public.wards(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Security data is separated so a citizen can never read its own PIN/recovery hashes.
create table public.profile_security (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  pin_hash text not null,
  failed_pin_attempts smallint not null default 0 check (failed_pin_attempts >= 0),
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  role public.app_role not null default 'citizen',
  assigned_by uuid references public.profiles(id),
  assigned_at timestamptz not null default now()
);

create table public.auth_recovery_codes (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  code_hash text not null unique,
  consumed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.waste_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id),
  ward_id uuid references public.wards(id),
  title text not null check (char_length(title) between 3 and 140),
  notes text,
  status public.report_status not null default 'draft',
  latitude numeric(9,6),
  longitude numeric(9,6),
  location_label text,
  priority_score numeric(5,2),
  duplicate_of uuid references public.waste_reports(id),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((latitude is null and longitude is null) or (latitude between -90 and 90 and longitude between -180 and 180))
);

create table public.report_status_history (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.waste_reports(id) on delete cascade,
  status public.report_status not null,
  changed_by uuid references public.profiles(id),
  note text,
  created_at timestamptz not null default now()
);

create table public.report_photos (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.waste_reports(id) on delete cascade,
  storage_path text not null unique,
  kind text not null check (kind in ('report', 'collection_proof', 'reuse_proof')),
  created_at timestamptz not null default now()
);

create table public.ai_analyses (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null unique references public.waste_reports(id) on delete cascade,
  model text not null,
  raw_result jsonb not null,
  canonical_category text,
  material text,
  item_condition text,
  contamination_level text,
  hazard_level text,
  confidence numeric(5,2),
  created_at timestamptz not null default now()
);

create table public.waste_items (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references public.ai_analyses(id) on delete cascade,
  name text not null,
  material text,
  reusable_percent smallint check (reusable_percent between 0 and 100),
  recyclable_percent smallint check (recyclable_percent between 0 and 100),
  compostable_percent smallint check (compostable_percent between 0 and 100),
  hazard_percent smallint check (hazard_percent between 0 and 100),
  final_action text check (final_action in ('reuse','recycle','report_collection','safe_disposal')),
  created_at timestamptz not null default now()
);

create table public.rewards_ledger (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id),
  report_id uuid references public.waste_reports(id),
  points integer not null check (points <> 0),
  reason text not null,
  verification_status text not null default 'pending' check (verification_status in ('pending','verified','rejected')),
  verified_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  verified_at timestamptz
);

create table public.collector_assignments (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null unique references public.waste_reports(id) on delete cascade,
  collector_id uuid not null references public.profiles(id),
  assigned_by uuid not null references public.profiles(id),
  status text not null default 'assigned' check (status in ('assigned','accepted','rejected','collected','cancelled')),
  rejection_reason text,
  assigned_at timestamptz not null default now(),
  accepted_at timestamptz,
  completed_at timestamptz
);

create or replace function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
create trigger profiles_updated_at before update on public.profiles for each row execute procedure public.set_updated_at();
create trigger reports_updated_at before update on public.waste_reports for each row execute procedure public.set_updated_at();

create or replace function public.has_staff_role() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid() and role in ('collector','supervisor','admin'));
$$;

alter table public.wards enable row level security;
alter table public.profiles enable row level security;
alter table public.profile_security enable row level security;
alter table public.user_roles enable row level security;
alter table public.auth_recovery_codes enable row level security;
alter table public.waste_reports enable row level security;
alter table public.report_status_history enable row level security;
alter table public.report_photos enable row level security;
alter table public.ai_analyses enable row level security;
alter table public.waste_items enable row level security;
alter table public.rewards_ledger enable row level security;
alter table public.collector_assignments enable row level security;

create policy "wards readable by signed-in users" on public.wards for select to authenticated using (true);
create policy "citizen reads own profile" on public.profiles for select to authenticated using (id = auth.uid());
create policy "citizen updates own public profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "citizen reads own role" on public.user_roles for select to authenticated using (user_id = auth.uid());
create policy "citizen reads own reports; staff reads operational reports" on public.waste_reports for select to authenticated using (reporter_id = auth.uid() or public.has_staff_role());
create policy "citizen creates own draft reports" on public.waste_reports for insert to authenticated with check (reporter_id = auth.uid() and status = 'draft');
create policy "citizen updates own draft reports" on public.waste_reports for update to authenticated using (reporter_id = auth.uid() and status = 'draft') with check (reporter_id = auth.uid());
create policy "report history visible to owner or staff" on public.report_status_history for select to authenticated using (exists (select 1 from public.waste_reports r where r.id = report_id and (r.reporter_id = auth.uid() or public.has_staff_role())));
create policy "report photos visible to owner or staff" on public.report_photos for select to authenticated using (exists (select 1 from public.waste_reports r where r.id = report_id and (r.reporter_id = auth.uid() or public.has_staff_role())));
create policy "analysis visible to owner or staff" on public.ai_analyses for select to authenticated using (exists (select 1 from public.waste_reports r where r.id = report_id and (r.reporter_id = auth.uid() or public.has_staff_role())));
create policy "items visible through owned analysis" on public.waste_items for select to authenticated using (exists (select 1 from public.ai_analyses a join public.waste_reports r on r.id = a.report_id where a.id = analysis_id and (r.reporter_id = auth.uid() or public.has_staff_role())));
create policy "ledger visible to owner or staff" on public.rewards_ledger for select to authenticated using (profile_id = auth.uid() or public.has_staff_role());
create policy "assignments visible to assigned collector or staff" on public.collector_assignments for select to authenticated using (collector_id = auth.uid() or public.has_staff_role());

-- No browser policy is created for security hashes, recovery codes, AI writes, role assignment, or rewards verification.
-- Those operations must go through protected Vercel server functions using the service-role key.
