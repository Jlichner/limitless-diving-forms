-- Limitless Diving: student accounts, shared training progress and the public class calendar.
--
-- Run this whole file once in your Supabase project: Dashboard → SQL Editor → New query → paste → Run.
-- It is safe to run again; it only creates what's missing and replaces the policies and functions.
--
-- Who can see what (row-level security):
--   • A student can read and edit only their own profile, and read only their own training progress.
--   • An instructor (a row in public.instructors) can read and edit every profile and write progress.
--   • Anyone, signed in or not, can read the published class calendar. Only instructors can change it.
--   • Nobody can make themselves an instructor from the app. Add instructors here in the SQL Editor:
--       insert into public.instructors (user_id)
--       select id from auth.users where email = 'you@example.com';

-- ---------- instructors ----------
create table if not exists public.instructors (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.instructors enable row level security;

drop policy if exists "Instructors can see their own row" on public.instructors;
create policy "Instructors can see their own row" on public.instructors
  for select to authenticated using (user_id = (select auth.uid()));
-- No insert, update or delete policies: instructors are added in the SQL Editor only.

create or replace function public.is_instructor()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.instructors where user_id = (select auth.uid()));
$$;
revoke all on function public.is_instructor() from public, anon;
grant execute on function public.is_instructor() to authenticated;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------- student profiles (the student account page) ----------
create table if not exists public.student_profiles (
  id                     uuid primary key references auth.users (id) on delete cascade,
  full_name              text not null default '',
  address                text not null default '',
  phone                  text not null default '',
  emergency_name         text not null default '',
  emergency_relationship text not null default '',
  emergency_phone        text not null default '',
  -- Current certifications: a list of {agency, level, number, date}.
  certifications         jsonb not null default '[]'::jsonb check (jsonb_typeof(certifications) = 'array'),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint student_profiles_sizes check (
    length(full_name) <= 200 and length(address) <= 500 and length(phone) <= 50
    and length(emergency_name) <= 200 and length(emergency_relationship) <= 100 and length(emergency_phone) <= 50
    and pg_column_size(certifications) <= 20000
  )
);
alter table public.student_profiles enable row level security;

drop trigger if exists student_profiles_touch on public.student_profiles;
create trigger student_profiles_touch before update on public.student_profiles
  for each row execute function public.touch_updated_at();

drop policy if exists "Students read their own profile; instructors read all" on public.student_profiles;
create policy "Students read their own profile; instructors read all" on public.student_profiles
  for select to authenticated using (id = (select auth.uid()) or (select public.is_instructor()));

drop policy if exists "Students create their own profile" on public.student_profiles;
create policy "Students create their own profile" on public.student_profiles
  for insert to authenticated with check (id = (select auth.uid()));

drop policy if exists "Students edit their own profile; instructors edit all" on public.student_profiles;
create policy "Students edit their own profile; instructors edit all" on public.student_profiles
  for update to authenticated
  using (id = (select auth.uid()) or (select public.is_instructor()))
  with check (id = (select auth.uid()) or (select public.is_instructor()));

-- Make a profile as soon as someone signs up, using the name they gave on the sign-up form.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.student_profiles (id, full_name)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 200))
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- The instructor's list of accounts, with each student's sign-in email (which lives in auth.users).
create or replace function public.student_accounts()
returns table (
  id uuid, email text, full_name text, address text, phone text,
  emergency_name text, emergency_relationship text, emergency_phone text,
  certifications jsonb, created_at timestamptz, updated_at timestamptz, email_confirmed boolean
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_instructor() then
    raise exception 'Only instructors can list student accounts' using errcode = '42501';
  end if;
  return query
    select p.id, u.email::text, p.full_name, p.address, p.phone,
           p.emergency_name, p.emergency_relationship, p.emergency_phone,
           p.certifications, p.created_at, p.updated_at, u.email_confirmed_at is not null
    from public.student_profiles p
    join auth.users u on u.id = p.id
    where not exists (select 1 from public.instructors i where i.user_id = p.id)
    order by p.full_name;
end;
$$;
revoke all on function public.student_accounts() from public, anon;
grant execute on function public.student_accounts() to authenticated;

-- ---------- training progress the instructor shares with each student ----------
create table if not exists public.student_progress (
  id          text primary key,                 -- the course record's id in the instructor app
  student_id  uuid not null references public.student_profiles (id) on delete cascade,
  course      text not null,
  summary     jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);
create index if not exists student_progress_student_id on public.student_progress (student_id);
alter table public.student_progress enable row level security;

drop policy if exists "Students read their own progress; instructors read all" on public.student_progress;
create policy "Students read their own progress; instructors read all" on public.student_progress
  for select to authenticated using (student_id = (select auth.uid()) or (select public.is_instructor()));

drop policy if exists "Instructors write progress" on public.student_progress;
create policy "Instructors write progress" on public.student_progress
  for all to authenticated
  using ((select public.is_instructor()))
  with check ((select public.is_instructor()));

-- ---------- public class calendar ----------
create table if not exists public.classes (
  id          text primary key,
  course      text not null default '',
  course_name text not null default '',
  title       text not null default '',
  color       text not null default 'k0',
  dates       jsonb not null default '[]'::jsonb check (jsonb_typeof(dates) = 'array'),
  time        text not null default '',
  location    text not null default '',
  price       numeric,
  seats       integer,
  seats_left  integer,
  notes       text not null default '',
  updated_at  timestamptz not null default now()
);
alter table public.classes enable row level security;

drop policy if exists "Anyone can read the class calendar" on public.classes;
create policy "Anyone can read the class calendar" on public.classes
  for select to anon, authenticated using (true);

drop policy if exists "Instructors manage classes" on public.classes;
create policy "Instructors manage classes" on public.classes
  for all to authenticated
  using ((select public.is_instructor()))
  with check ((select public.is_instructor()));

-- The public page's heading, introduction and contact details (one row).
create table if not exists public.calendar_settings (
  id         integer primary key default 1 check (id = 1),
  heading    text not null default '',
  intro      text not null default '',
  instructor text not null default '',
  phone      text not null default '',
  email      text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.calendar_settings enable row level security;

drop policy if exists "Anyone can read the calendar settings" on public.calendar_settings;
create policy "Anyone can read the calendar settings" on public.calendar_settings
  for select to anon, authenticated using (true);

drop policy if exists "Instructors manage the calendar settings" on public.calendar_settings;
create policy "Instructors manage the calendar settings" on public.calendar_settings
  for all to authenticated
  using ((select public.is_instructor()))
  with check ((select public.is_instructor()));

-- ---------- table access for the API roles (row-level security above still applies) ----------
revoke all on public.instructors, public.student_profiles, public.student_progress, public.classes, public.calendar_settings from anon;
grant select on public.classes, public.calendar_settings to anon;
grant select on public.instructors to authenticated;
grant select, insert, update on public.student_profiles to authenticated;
grant select, insert, update, delete on public.student_progress, public.classes, public.calendar_settings to authenticated;
