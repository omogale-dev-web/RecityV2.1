-- Run after 001_recit_core.sql. This adds internal-only Supabase Auth mapping.
-- Citizens never see or use this generated email address.

alter table public.profile_security
  add column if not exists internal_auth_email text unique;

alter table public.profile_security
  alter column internal_auth_email set not null;

create index if not exists profiles_recity_id_index on public.profiles (recity_id);
create index if not exists recovery_codes_profile_index on public.auth_recovery_codes (profile_id) where consumed_at is null;

-- Seed a first ward only if the wards table is currently empty.
insert into public.wards (name, municipality, code)
select 'Udgir Ward 01', 'Udgir', 'UDG-01'
where not exists (select 1 from public.wards);
