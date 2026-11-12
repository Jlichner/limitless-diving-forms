-- Limitless Diving: student accounts, staff roles, shared training progress and the public class calendar.
--
-- Run this whole file once in your Supabase project: Dashboard → SQL Editor → New query → paste → Run.
-- It is safe to run again; it only creates what's missing and replaces the policies and functions.
--
-- Four levels of access (row-level security enforces them in the database, not just on screen):
--   • Student      everyone who signs up. Reads and edits only their own profile; reads only their own progress.
--   • Dive Master  also reads every student's profile (contact, emergency contact, certifications) and progress,
--                  so they have emergency details on dive days. Can't change anything.
--   • Instructor   also edits student profiles, shares progress with students and publishes the class calendar.
--   • Admin        also gives and removes staff roles (Dive Master, Instructor, Admin).
--   Anyone, signed in or not, can read the published class calendar.
--   Students can request a class on open dates; Instructors and Admins schedule or decline requests.
--
-- Nobody can raise their own level from the website. Make the first Admin here in the SQL Editor:
--     insert into public.staff_roles (user_id, role)
--     select id, 'admin' from auth.users where email = 'you@example.com'
--     on conflict (user_id) do update set role = 'admin';
-- After that, the Admin gives roles to others from the app (Admin Log in → Staff and roles).

-- ---------- staff roles (no row = Student) ----------
create table if not exists public.staff_roles (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  role       text not null check (role in ('divemaster', 'instructor', 'admin')),
  created_at timestamptz not null default now()
);
alter table public.staff_roles enable row level security;

-- Earlier versions of this file had an instructors table: carry those people over as Admins.
do $$
begin
  if to_regclass('public.instructors') is not null then
    insert into public.staff_roles (user_id, role) select user_id, 'admin' from public.instructors on conflict (user_id) do nothing;
    drop table public.instructors cascade;
  end if;
end $$;
drop function if exists public.is_instructor() cascade;

-- Your level: 'student', 'divemaster', 'instructor' or 'admin'.
create or replace function public.my_role()
returns text
language sql stable security definer set search_path = ''
as $$
  select coalesce((select role from public.staff_roles where user_id = (select auth.uid())), 'student');
$$;
-- True when your level is at least the one named.
create or replace function public.has_role(min_role text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select array_position(array['student', 'divemaster', 'instructor', 'admin'], public.my_role())
      >= coalesce(array_position(array['student', 'divemaster', 'instructor', 'admin'], min_role), 99);
$$;
revoke all on function public.my_role() from public, anon;
revoke all on function public.has_role(text) from public, anon;
grant execute on function public.my_role() to authenticated;
grant execute on function public.has_role(text) to authenticated;

drop policy if exists "Staff see their own role; admins see all" on public.staff_roles;
create policy "Staff see their own role; admins see all" on public.staff_roles
  for select to authenticated using (user_id = (select auth.uid()) or (select public.has_role('admin')));
-- Roles change only through set_staff_role() below (or the SQL Editor), so there are no write policies.

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
  address                text not null default '',   -- the whole mailing address on one line, built from the four parts below
  street                 text not null default '',
  city                   text not null default '',
  state                  text not null default '',
  zip                    text not null default '',
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

-- Mailing address in parts (added after the first version; safe to run again).
alter table public.student_profiles add column if not exists street text not null default '';
alter table public.student_profiles add column if not exists city   text not null default '';
alter table public.student_profiles add column if not exists state  text not null default '';
alter table public.student_profiles add column if not exists zip    text not null default '';
-- Profile photo: the file's path in the private "avatars" storage bucket (see the end of this file).
alter table public.student_profiles add column if not exists photo_path text not null default '';
alter table public.student_profiles drop constraint if exists student_profiles_address_parts;
alter table public.student_profiles drop constraint if exists student_profiles_photo_own_folder;
alter table public.student_profiles add constraint student_profiles_photo_own_folder
  check (photo_path = '' or photo_path like id::text || '/%');
alter table public.student_profiles add constraint student_profiles_address_parts
  check (length(street) <= 200 and length(city) <= 100 and length(state) <= 40 and length(zip) <= 20);

drop trigger if exists student_profiles_touch on public.student_profiles;
create trigger student_profiles_touch before update on public.student_profiles
  for each row execute function public.touch_updated_at();

drop policy if exists "Students read their own profile; staff read all" on public.student_profiles;
create policy "Students read their own profile; staff read all" on public.student_profiles
  for select to authenticated using (id = (select auth.uid()) or (select public.has_role('divemaster')));

drop policy if exists "Students create their own profile" on public.student_profiles;
create policy "Students create their own profile" on public.student_profiles
  for insert to authenticated with check (id = (select auth.uid()));

drop policy if exists "Students edit their own profile; instructors edit all" on public.student_profiles;
create policy "Students edit their own profile; instructors edit all" on public.student_profiles
  for update to authenticated
  using (id = (select auth.uid()) or (select public.has_role('instructor')))
  with check (id = (select auth.uid()) or (select public.has_role('instructor')));

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

-- Staff's list of student accounts, with each student's sign-in email (which lives in auth.users).
drop function if exists public.student_accounts();
create or replace function public.student_accounts()
returns table (
  id uuid, email text, full_name text, address text, phone text,
  emergency_name text, emergency_relationship text, emergency_phone text,
  certifications jsonb, created_at timestamptz, updated_at timestamptz, email_confirmed boolean,
  photo_path text
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.has_role('divemaster') then
    raise exception 'Only staff can list student accounts' using errcode = '42501';
  end if;
  return query
    select p.id, u.email::text, p.full_name, p.address, p.phone,
           p.emergency_name, p.emergency_relationship, p.emergency_phone,
           p.certifications, p.created_at, p.updated_at, u.email_confirmed_at is not null,
           p.photo_path
    from public.student_profiles p
    join auth.users u on u.id = p.id
    where not exists (select 1 from public.staff_roles r where r.user_id = p.id)
    order by p.full_name;
end;
$$;
revoke all on function public.student_accounts() from public, anon;
grant execute on function public.student_accounts() to authenticated;

-- Everyone with an account, students and staff, with their level: the Records → Students list.
-- Dive Masters and up only. Added 2026-11-12; safe to run again.
drop function if exists public.member_directory();
create or replace function public.member_directory()
returns table (
  id uuid, email text, full_name text, address text, phone text,
  emergency_name text, emergency_relationship text, emergency_phone text,
  certifications jsonb, created_at timestamptz, updated_at timestamptz, email_confirmed boolean,
  photo_path text, role text
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.has_role('divemaster') then
    raise exception 'Only staff can list accounts' using errcode = '42501';
  end if;
  return query
    select u.id, u.email::text, coalesce(p.full_name, ''), coalesce(p.address, ''), coalesce(p.phone, ''),
           coalesce(p.emergency_name, ''), coalesce(p.emergency_relationship, ''), coalesce(p.emergency_phone, ''),
           coalesce(p.certifications, '[]'::jsonb), coalesce(p.created_at, u.created_at), coalesce(p.updated_at, u.created_at),
           u.email_confirmed_at is not null, p.photo_path, coalesce(r.role, 'student')
    from auth.users u
    left join public.student_profiles p on p.id = u.id
    left join public.staff_roles r on r.user_id = u.id
    order by coalesce(nullif(p.full_name, ''), u.email::text);
end;
$$;
revoke all on function public.member_directory() from public, anon;
grant execute on function public.member_directory() to authenticated;

-- ---------- managing staff (Admins only) ----------
create or replace function public.staff_members()
returns table (id uuid, email text, full_name text, role text)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.has_role('admin') then
    raise exception 'Only admins can see the staff list' using errcode = '42501';
  end if;
  return query
    select r.user_id, u.email::text, coalesce(p.full_name, ''), r.role
    from public.staff_roles r
    join auth.users u on u.id = r.user_id
    left join public.student_profiles p on p.id = r.user_id
    order by array_position(array['admin', 'instructor', 'divemaster'], r.role), p.full_name;
end;
$$;
revoke all on function public.staff_members() from public, anon;
grant execute on function public.staff_members() to authenticated;

-- Give someone a level by the email they signed up with. new_role 'student' takes their staff role away.
create or replace function public.set_staff_role(member_email text, new_role text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  target uuid;
begin
  if not public.has_role('admin') then
    raise exception 'Only admins can change roles' using errcode = '42501';
  end if;
  if new_role not in ('student', 'divemaster', 'instructor', 'admin') then
    raise exception 'Unknown role %', new_role using errcode = '22023';
  end if;
  select id into target from auth.users where lower(email) = lower(trim(member_email));
  if target is null then
    raise exception 'No account uses that email. Ask them to sign up on the student log in page first.' using errcode = 'P0002';
  end if;
  if target = (select auth.uid()) then
    raise exception 'You can''t change your own role. Ask another admin.' using errcode = '42501';
  end if;
  if new_role = 'student' then
    delete from public.staff_roles where user_id = target;
  else
    insert into public.staff_roles (user_id, role) values (target, new_role)
    on conflict (user_id) do update set role = excluded.role;
  end if;
  return new_role;
end;
$$;
revoke all on function public.set_staff_role(text, text) from public, anon;
grant execute on function public.set_staff_role(text, text) to authenticated;

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

drop policy if exists "Students read their own progress; staff read all" on public.student_progress;
create policy "Students read their own progress; staff read all" on public.student_progress
  for select to authenticated using (student_id = (select auth.uid()) or (select public.has_role('divemaster')));

drop policy if exists "Instructors write progress" on public.student_progress;
create policy "Instructors write progress" on public.student_progress
  for all to authenticated
  using ((select public.has_role('instructor')))
  with check ((select public.has_role('instructor')));

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
-- Calendar entry types (Class, Event, Exploration, Tour…), added 2026-11-12.
alter table public.classes add column if not exists event_type text not null default 'class';
alter table public.classes add column if not exists event_type_name text not null default 'Class';
alter table public.classes enable row level security;

drop policy if exists "Anyone can read the class calendar" on public.classes;
create policy "Anyone can read the class calendar" on public.classes
  for select to anon, authenticated using (true);

drop policy if exists "Instructors manage classes" on public.classes;
create policy "Instructors manage classes" on public.classes
  for all to authenticated
  using ((select public.has_role('instructor')))
  with check ((select public.has_role('instructor')));

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
  using ((select public.has_role('instructor')))
  with check ((select public.has_role('instructor')));

-- ---------- class requests ----------
-- A signed-in student asks for a course on dates they pick. Students see and withdraw only their own requests;
-- Dive Masters and up see all of them; Instructors and Admins schedule or decline them.
create table if not exists public.class_requests (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  student_name  text not null default '' check (char_length(student_name) <= 200),
  student_email text not null default '' check (char_length(student_email) <= 320),
  course        text not null check (char_length(course) between 1 and 80),
  course_name   text not null default '' check (char_length(course_name) <= 200),
  dates         jsonb not null check (jsonb_typeof(dates) = 'array' and jsonb_array_length(dates) between 1 and 30),
  notes         text not null default '' check (char_length(notes) <= 2000),
  status        text not null default 'pending' check (status in ('pending', 'scheduled', 'declined')),
  staff_note    text not null default '' check (char_length(staff_note) <= 1000),
  class_id      text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
alter table public.class_requests enable row level security;

-- Days that can't be requested: published class days, and days already asked for or scheduled.
-- Returns dates only (never who asked), so anyone can see which days are free.
create or replace function public.taken_dates()
returns setof text
language sql stable security definer set search_path = ''
as $$
  select distinct d from (
    select jsonb_array_elements_text(dates) as d from public.classes
    union all
    select jsonb_array_elements_text(dates) from public.class_requests where status in ('pending', 'scheduled')
  ) x where d >= to_char(current_date, 'YYYY-MM-DD');
$$;
revoke all on function public.taken_dates() from public;
grant execute on function public.taken_dates() to anon, authenticated;

-- New requests are always the student's own and pending, on free days from tomorrow on, and a student
-- can have at most 5 pending at once.
create or replace function public.check_class_request()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare bad text;
begin
  new.student_id := (select auth.uid());
  new.status := 'pending'; new.staff_note := ''; new.class_id := null;
  new.created_at := now(); new.updated_at := now();
  if (select count(*) from public.class_requests where student_id = new.student_id and status = 'pending') >= 5 then
    raise exception 'You already have 5 requests waiting. Please wait for an answer or withdraw one first.';
  end if;
  select d into bad from jsonb_array_elements_text(new.dates) d
    where d !~ '^\d{4}-\d{2}-\d{2}$' or d <= to_char(current_date, 'YYYY-MM-DD')
       or d in (select public.taken_dates()) limit 1;
  if bad is not null then
    raise exception 'The date % is no longer open. Please pick another day.', bad;
  end if;
  return new;
end $$;
drop trigger if exists class_requests_check on public.class_requests;
create trigger class_requests_check before insert on public.class_requests
  for each row execute function public.check_class_request();

drop policy if exists "Students see their own requests; staff see all" on public.class_requests;
create policy "Students see their own requests; staff see all" on public.class_requests
  for select to authenticated using (student_id = (select auth.uid()) or (select public.has_role('divemaster')));

drop policy if exists "Students make their own requests" on public.class_requests;
create policy "Students make their own requests" on public.class_requests
  for insert to authenticated with check (student_id = (select auth.uid()));

drop policy if exists "Students withdraw their pending requests; instructors remove any" on public.class_requests;
create policy "Students withdraw their pending requests; instructors remove any" on public.class_requests
  for delete to authenticated
  using ((student_id = (select auth.uid()) and status = 'pending') or (select public.has_role('instructor')));

drop policy if exists "Instructors answer requests" on public.class_requests;
create policy "Instructors answer requests" on public.class_requests
  for update to authenticated
  using ((select public.has_role('instructor')))
  with check ((select public.has_role('instructor')));

revoke all on public.class_requests from anon;
grant select, insert, update, delete on public.class_requests to authenticated;

-- ---------- table access for the API roles (row-level security above still applies) ----------
revoke all on public.staff_roles, public.student_profiles, public.student_progress, public.classes, public.calendar_settings from anon;
grant select on public.classes, public.calendar_settings to anon;
grant select on public.staff_roles to authenticated;
grant select, insert, update on public.student_profiles to authenticated;
grant select, insert, update, delete on public.student_progress, public.classes, public.calendar_settings to authenticated;

-- ---------- profile photos (Supabase Storage) ----------
-- A private bucket: photos are never public. Each student's photo lives in a folder named after their
-- account id ("<id>/photo.jpg"). Students upload, replace and remove only their own; staff can view all.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Photos: students see their own, staff see all" on storage.objects;
create policy "Photos: students see their own, staff see all" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.has_role('divemaster'))));

drop policy if exists "Photos: students add their own" on storage.objects;
create policy "Photos: students add their own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Photos: students replace their own" on storage.objects;
create policy "Photos: students replace their own" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Photos: students remove their own" on storage.objects;
create policy "Photos: students remove their own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
