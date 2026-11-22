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
-- Elements of tech diving: the members-only section an Instructor or Admin switches on per student (added 2026-11-15).
alter table public.student_profiles add column if not exists tech_access boolean not null default false;
-- Dive log book switched on by hand for someone not (yet) registered for a class (added 2026-11-17).
alter table public.student_profiles add column if not exists logbook_access boolean not null default false;
-- Tools pages (Nitrox calculator, Diving physics): on for everyone unless an Instructor or Admin switches them
-- off for a person in Records → Student accounts (added 2026-11-22). On by default so nobody loses access.
alter table public.student_profiles add column if not exists nitrox_access boolean not null default true;
alter table public.student_profiles add column if not exists physics_access boolean not null default true;
alter table public.student_profiles drop constraint if exists student_profiles_address_parts;
alter table public.student_profiles drop constraint if exists student_profiles_photo_own_folder;
alter table public.student_profiles add constraint student_profiles_photo_own_folder
  check (photo_path = '' or photo_path like id::text || '/%');
alter table public.student_profiles add constraint student_profiles_address_parts
  check (length(street) <= 200 and length(city) <= 100 and length(state) <= 40 and length(zip) <= 20);

-- Only Instructors and Admins can switch Elements of tech diving, the dive log book or the Tools pages on or off. A student
-- saving their own details can't change them; new profiles start with both off.
create or replace function public.protect_tech_access()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if not public.has_role('instructor') then
    if tg_op = 'INSERT' then new.tech_access := false; new.logbook_access := false;
      new.nitrox_access := true; new.physics_access := true;
    else new.tech_access := old.tech_access; new.logbook_access := old.logbook_access;
      new.nitrox_access := old.nitrox_access; new.physics_access := old.physics_access;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists student_profiles_protect_tech on public.student_profiles;
create trigger student_profiles_protect_tech before insert or update on public.student_profiles
  for each row execute function public.protect_tech_access();

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
  photo_path text, role text, tech_access boolean, logbook_access boolean, logbook_auto boolean,
  nitrox_access boolean, physics_access boolean
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
           u.email_confirmed_at is not null, p.photo_path, coalesce(r.role, 'student'), coalesce(p.tech_access, false),
           coalesce(p.logbook_access, false),
           -- the log book is on automatically: registered for a class (see my_logbook_access below)
           exists (select 1 from public.student_progress sp where sp.student_id = u.id)
             or exists (select 1 from public.event_signups es where es.student_id = u.id and es.kind = 'class' and es.status = 'enrolled'),
           coalesce(p.nitrox_access, true), coalesce(p.physics_access, true)
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

-- ---------- Elements of tech diving access (added 2026-11-15) ----------
-- Instructors and Admins switch it on for a person from Records → Students. Works for staff accounts too
-- (makes their profile row if they don't have one yet).
create or replace function public.set_tech_access(member uuid, allow boolean)
returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.has_role('instructor') then
    raise exception 'Only Instructors and Admins can change tech diving access' using errcode = '42501';
  end if;
  if not exists (select 1 from auth.users where id = member) then
    raise exception 'No account found' using errcode = 'P0002';
  end if;
  insert into public.student_profiles (id, tech_access) values (member, coalesce(allow, false))
  on conflict (id) do update set tech_access = excluded.tech_access;
  return coalesce(allow, false);
end;
$$;
revoke all on function public.set_tech_access(uuid, boolean) from public, anon;
grant execute on function public.set_tech_access(uuid, boolean) to authenticated;

-- True when you may open Elements of tech diving: it's switched on in your profile, or you're an Instructor or Admin.
create or replace function public.my_tech_access()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.has_role('instructor')
      or coalesce((select tech_access from public.student_profiles where id = (select auth.uid())), false);
$$;
revoke all on function public.my_tech_access() from public, anon;
grant execute on function public.my_tech_access() to authenticated;

-- ---------- Tools access: Nitrox calculator and Diving physics (added 2026-11-22) ----------
-- On for everyone by default. Instructors and Admins switch a tool off (or back on) for one person from
-- Records → Student accounts. tool is 'nitrox' or 'physics'. Makes their profile row if they don't have one yet.
create or replace function public.set_tool_access(member uuid, tool text, allow boolean)
returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.has_role('instructor') then
    raise exception 'Only Instructors and Admins can change tools access' using errcode = '42501';
  end if;
  if tool not in ('nitrox', 'physics') then
    raise exception 'Unknown tool' using errcode = '22023';
  end if;
  if not exists (select 1 from auth.users where id = member) then
    raise exception 'No account found' using errcode = 'P0002';
  end if;
  if tool = 'nitrox' then
    insert into public.student_profiles (id, nitrox_access) values (member, coalesce(allow, false))
    on conflict (id) do update set nitrox_access = excluded.nitrox_access;
  else
    insert into public.student_profiles (id, physics_access) values (member, coalesce(allow, false))
    on conflict (id) do update set physics_access = excluded.physics_access;
  end if;
  return coalesce(allow, false);
end;
$$;
revoke all on function public.set_tool_access(uuid, text, boolean) from public, anon;
grant execute on function public.set_tool_access(uuid, text, boolean) to authenticated;

-- Which Tools pages you may open: {"nitrox": true, "physics": true}. Dive Masters and up always may.
create or replace function public.my_tool_access()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select case when public.has_role('divemaster') then jsonb_build_object('nitrox', true, 'physics', true)
    else jsonb_build_object(
      'nitrox',  coalesce((select nitrox_access  from public.student_profiles where id = (select auth.uid())), true),
      'physics', coalesce((select physics_access from public.student_profiles where id = (select auth.uid())), true))
  end;
$$;
revoke all on function public.my_tool_access() from public, anon;
grant execute on function public.my_tool_access() to authenticated;

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
-- Minimum certification to join an event (a catalog course id like 'naui-aow', or '' for none), added 2026-11-13.
alter table public.classes add column if not exists min_cert text not null default '' check (length(min_cert) <= 60);
alter table public.classes add column if not exists min_cert_name text not null default '' check (length(min_cert_name) <= 200);
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
-- When the alert to the instructor went out (notify-signup Edge Function), added 2026-11-14.
alter table public.class_requests add column if not exists notified_at timestamptz;

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
  new.status := 'pending'; new.staff_note := ''; new.class_id := null; new.notified_at := null;
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

-- ---------- sign-ups from the event information page (event.html), added 2026-11-13 ----------
-- Clicking an entry on the calendar opens event.html, where a logged-in member joins an Event, Exploration or
-- Tour ('join': they're in straight away, up to the seats left), or starts signing up for a Class ('class': it
-- waits as 'pending' until an Instructor schedules them with Business → Scheduling, which marks it 'enrolled').
-- class_id is the calendar entry's id. It isn't a foreign key on purpose: Publish calendar rewrites the
-- classes table, and sign-ups must survive that.
create table if not exists public.event_signups (
  id            uuid primary key default gen_random_uuid(),
  class_id      text not null check (char_length(class_id) between 1 and 80),
  student_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  student_name  text not null default '' check (char_length(student_name) <= 200),
  student_email text not null default '' check (char_length(student_email) <= 320),
  title         text not null default '' check (char_length(title) <= 300),
  kind          text not null default 'join' check (kind in ('join', 'class')),
  status        text not null default 'pending' check (status in ('joined', 'pending', 'enrolled', 'declined')),
  notes         text not null default '' check (char_length(notes) <= 1000),
  staff_note    text not null default '' check (char_length(staff_note) <= 1000),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (class_id, student_id)
);
alter table public.event_signups enable row level security;
-- When the alert to the instructor went out (notify-signup Edge Function), added 2026-11-14.
alter table public.event_signups add column if not exists notified_at timestamptz;

-- New sign-ups are always the member's own, for a published entry that hasn't ended. The server decides the
-- kind and status, fills in the name and email from the account, and keeps joins within the seats left.
create or replace function public.check_event_signup()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare k public.classes%rowtype; going integer;
begin
  new.student_id := (select auth.uid());
  select * into k from public.classes where id = new.class_id;
  if not found then
    raise exception 'This is no longer on the calendar.';
  end if;
  if exists (select 1 from jsonb_array_elements_text(k.dates) d) and
     (select max(d) from jsonb_array_elements_text(k.dates) d) < to_char(current_date, 'YYYY-MM-DD') then
    raise exception 'This has already finished.';
  end if;
  new.title := left(coalesce(nullif(k.title, ''), k.course_name, ''), 300);
  new.kind := case when k.event_type = 'class' or k.course <> '' then 'class' else 'join' end;
  new.status := case when new.kind = 'class' then 'pending' else 'joined' end;
  new.staff_note := ''; new.created_at := now(); new.updated_at := now(); new.notified_at := null;
  new.student_email := left(coalesce((select u.email::text from auth.users u where u.id = new.student_id), ''), 320);
  new.student_name := left(coalesce(nullif((select p.full_name from public.student_profiles p where p.id = new.student_id), ''), new.student_name, ''), 200);
  if new.kind = 'join' and k.seats_left is not null then
    select count(*) into going from public.event_signups where class_id = new.class_id and status = 'joined';
    if going >= k.seats_left then
      raise exception 'Sorry, this is full. Get in touch to go on the waiting list.';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists event_signups_check on public.event_signups;
create trigger event_signups_check before insert on public.event_signups
  for each row execute function public.check_event_signup();

drop policy if exists "Members see their own sign-ups; staff see all" on public.event_signups;
create policy "Members see their own sign-ups; staff see all" on public.event_signups
  for select to authenticated using (student_id = (select auth.uid()) or (select public.has_role('divemaster')));

drop policy if exists "Members sign themselves up" on public.event_signups;
create policy "Members sign themselves up" on public.event_signups
  for insert to authenticated with check (student_id = (select auth.uid()));

drop policy if exists "Members leave or withdraw; instructors remove any" on public.event_signups;
create policy "Members leave or withdraw; instructors remove any" on public.event_signups
  for delete to authenticated
  using ((student_id = (select auth.uid()) and status in ('joined', 'pending', 'declined')) or (select public.has_role('instructor')));

drop policy if exists "Instructors answer sign-ups" on public.event_signups;
create policy "Instructors answer sign-ups" on public.event_signups
  for update to authenticated
  using ((select public.has_role('instructor')))
  with check ((select public.has_role('instructor')));

revoke all on public.event_signups from anon;
grant select, insert, update, delete on public.event_signups to authenticated;

-- The notify-signup Edge Function calls this, as the member who just signed up, to get what goes in the
-- alert to the instructor. It answers once per sign-up, only for the caller's own sign-up made in the last
-- 15 minutes, and marks it as alerted, so nobody can use it to send repeat alerts or read others' sign-ups.
create or replace function public.claim_signup_notice(p_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare s public.event_signups%rowtype; k public.classes%rowtype;
begin
  update public.event_signups e set notified_at = now()
    where e.id = p_id and e.student_id = (select auth.uid()) and e.notified_at is null
      and e.created_at > now() - interval '15 minutes'
    returning e.* into s;
  if not found then return null; end if;
  select * into k from public.classes where id = s.class_id;
  return jsonb_build_object('name', s.student_name, 'email', s.student_email, 'title', s.title, 'kind', s.kind,
    'notes', s.notes, 'class_id', s.class_id, 'dates', coalesce(k.dates, '[]'::jsonb),
    'time', coalesce(k.time, ''), 'location', coalesce(k.location, ''),
    'phone', coalesce((select p.phone from public.student_profiles p where p.id = s.student_id), ''));
end $$;
revoke all on function public.claim_signup_notice(uuid) from public, anon;

-- The same for a new request on Request a class (request.html), added 2026-11-14.
create or replace function public.claim_request_notice(p_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare r public.class_requests%rowtype;
begin
  update public.class_requests q set notified_at = now()
    where q.id = p_id and q.student_id = (select auth.uid()) and q.notified_at is null
      and q.created_at > now() - interval '15 minutes'
    returning q.* into r;
  if not found then return null; end if;
  return jsonb_build_object('name', r.student_name, 'email', r.student_email, 'title', coalesce(nullif(r.course_name, ''), r.course),
    'kind', 'request', 'notes', r.notes, 'dates', r.dates,
    'phone', coalesce((select p.phone from public.student_profiles p where p.id = r.student_id), ''));
end $$;
revoke all on function public.claim_request_notice(uuid) from public, anon;
grant execute on function public.claim_request_notice(uuid) to authenticated;
grant execute on function public.claim_signup_notice(uuid) to authenticated;

-- How many people have joined an event (a number only, never who), for the event page.
create or replace function public.event_going(p_class_id text)
returns integer
language sql stable security definer set search_path = ''
as $$
  select count(*)::integer from public.event_signups where class_id = p_class_id and status = 'joined';
$$;
revoke all on function public.event_going(text) from public;
grant execute on function public.event_going(text) to anon, authenticated;

-- ---------- coaching and tours listings ----------
-- The cards at the top of Available classes (coaching sessions, Lake Hydra tours, ...). Anyone can read them;
-- Instructors and Admins edit them in the staff app (Settings → Coaching and tours listings). Students ask for
-- one on Request a class, as course "offer-<id>". cal_type is the calendar event type a scheduled request becomes.
create table if not exists public.offerings (
  id         text primary key check (id ~ '^[a-z0-9-]{1,40}$'),
  name       text not null check (char_length(name) between 1 and 120),
  tag        text not null default '' check (char_length(tag) <= 80),
  about      text not null default '' check (char_length(about) <= 1000),
  price      text not null default '' check (char_length(price) <= 80),
  cal_type   text not null default 'event' check (char_length(cal_type) <= 40),
  active     boolean not null default true,
  sort       integer not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.offerings enable row level security;

drop policy if exists "Anyone can read the listings" on public.offerings;
create policy "Anyone can read the listings" on public.offerings
  for select to anon, authenticated using (true);

drop policy if exists "Instructors manage the listings" on public.offerings;
create policy "Instructors manage the listings" on public.offerings
  for all to authenticated
  using ((select public.has_role('instructor')))
  with check ((select public.has_role('instructor')));

revoke all on public.offerings from anon;
grant select on public.offerings to anon;
grant select, insert, update, delete on public.offerings to authenticated;

-- The first two listings, added only while the table is empty (so a listing you remove stays removed).
insert into public.offerings (id, name, tag, about, cal_type, sort)
select * from (values
  ('coaching', 'Coaching sessions', 'With an instructor', 'Work one on one or in a small group with an instructor to hone the skill of your choice.', 'event', 0),
  ('hydra', 'Lake Hydra tours', 'Led by a divemaster', 'Day-long tours of Lake Hydra with a divemaster. The adventure is yours: dive as little or as much as you like for the day.', 'tour', 1)
) v(id, name, tag, about, cal_type, sort)
where not exists (select 1 from public.offerings);

-- ---------- members' dive sites and the dive map ----------
-- Each member keeps a list of places they've dived (Student portal → Places I've dived). Members see and change
-- only their own; Dive Masters and up can read all. The public Dive map (dive-map.html) reads dive_map(), which
-- returns pins only: the site, its rounded location and how many members dived there, never who.
create table if not exists public.dive_sites (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 120),
  place      text not null default '' check (char_length(place) <= 200),
  lat        double precision not null check (lat between -90 and 90),
  lng        double precision not null check (lng between -180 and 180),
  dived_on   date,
  notes      text not null default '' check (char_length(notes) <= 500),
  created_at timestamptz not null default now()
);
create index if not exists dive_sites_user_idx on public.dive_sites (user_id);
alter table public.dive_sites enable row level security;

drop policy if exists "Members see their own dive sites; staff see all" on public.dive_sites;
create policy "Members see their own dive sites; staff see all" on public.dive_sites
  for select to authenticated using (user_id = (select auth.uid()) or (select public.has_role('divemaster')));

drop policy if exists "Members add their own dive sites" on public.dive_sites;
create policy "Members add their own dive sites" on public.dive_sites
  for insert to authenticated with check (user_id = (select auth.uid()));

-- At most 500 places per member. Checked in a trigger: a policy can't count rows of its own table.
create or replace function public.check_dive_site()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if (select count(*) from public.dive_sites where user_id = new.user_id) >= 500 then
    raise exception 'You can save up to 500 places.';
  end if;
  return new;
end $$;
drop trigger if exists dive_sites_check on public.dive_sites;
create trigger dive_sites_check before insert on public.dive_sites
  for each row execute function public.check_dive_site();

drop policy if exists "Members change their own dive sites" on public.dive_sites;
create policy "Members change their own dive sites" on public.dive_sites
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "Members remove their own dive sites" on public.dive_sites;
create policy "Members remove their own dive sites" on public.dive_sites
  for delete to authenticated using (user_id = (select auth.uid()));

revoke all on public.dive_sites from anon;
grant select, insert, update, delete on public.dive_sites to authenticated;

-- Pins for the public map: sites within about 1 km of each other are one pin, named by the most common name.
create or replace function public.dive_map()
returns table (lat double precision, lng double precision, name text, place text, divers integer, entries integer)
language sql stable security definer set search_path = ''
as $$
  select round(s.lat::numeric, 2)::double precision, round(s.lng::numeric, 2)::double precision,
         mode() within group (order by s.name), mode() within group (order by s.place),
         count(distinct s.user_id)::integer, count(*)::integer
  from public.dive_sites s
  group by round(s.lat::numeric, 2), round(s.lng::numeric, 2);
$$;
revoke all on function public.dive_map() from public;
grant execute on function public.dive_map() to anon, authenticated;

-- How many members have added at least one dive site (for the map's headline).
create or replace function public.dive_map_members()
returns integer
language sql stable security definer set search_path = ''
as $$ select count(distinct user_id)::integer from public.dive_sites; $$;
revoke all on function public.dive_map_members() from public;
grant execute on function public.dive_map_members() to anon, authenticated;

-- ---------- the digital dive log book (logbook.html), added 2026-11-17 ----------
-- Each member logs their dives: date, site, depth, time, gas, conditions, buddy and notes. A dive's site is one of
-- their "Places I've dived" (dive_sites above), so every logged dive is a pin on their map and on the public Dive
-- map. The site's name and location are copied onto the dive too, so the log keeps them if the place is removed.
-- Who gets a log book: anyone registered for at least one class (a course record shared to their account, which
-- the instructor app syncs from the class rosters, or a calendar class sign-up an Instructor has enrolled), plus
-- all staff. Members see and change only their own dives; Dive Masters and up can read everyone's.
-- Training dives can be signed off by an Instructor or Admin with sign_dive(). Nobody else can write a signature,
-- and a signed dive is locked: the diver can't change or delete it unless an Instructor takes the signature back.

-- True when you may use the dive log book: staff, anyone registered for a class, or switched on by hand.
create or replace function public.my_logbook_access()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.has_role('divemaster')
      or coalesce((select logbook_access from public.student_profiles where id = (select auth.uid())), false)
      or exists (select 1 from public.student_progress where student_id = (select auth.uid()))
      or exists (select 1 from public.event_signups
                 where student_id = (select auth.uid()) and kind = 'class' and status = 'enrolled');
$$;
revoke all on function public.my_logbook_access() from public, anon;
grant execute on function public.my_logbook_access() to authenticated;

create table if not exists public.dive_logs (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  dive_no        integer not null check (dive_no between 1 and 100000),
  dived_on       date not null,
  time_in        text not null default '' check (time_in = '' or time_in ~ '^\d{2}:\d{2}$'),
  site_id        uuid references public.dive_sites (id) on delete set null,
  site_name      text not null check (char_length(site_name) between 1 and 120),
  place          text not null default '' check (char_length(place) <= 200),
  lat            double precision check (lat between -90 and 90),
  lng            double precision check (lng between -180 and 180),
  units          text not null default 'imperial' check (units in ('imperial', 'metric')),  -- ft/psi/°F or m/bar/°C
  max_depth      numeric check (max_depth > 0 and max_depth <= 1500),
  avg_depth      numeric check (avg_depth > 0 and avg_depth <= 1500),
  bottom_time    integer check (bottom_time between 1 and 1440),          -- minutes
  surface_interval integer check (surface_interval between 0 and 100000), -- minutes before this dive
  gas            text not null default 'air' check (gas in ('air', 'nitrox', 'trimix', 'oxygen', 'other')),
  o2_pct         numeric check (o2_pct between 5 and 100),
  he_pct         numeric check (he_pct between 0 and 95),
  tank           text not null default '' check (char_length(tank) <= 60),
  start_pressure integer check (start_pressure between 0 and 6000),
  end_pressure   integer check (end_pressure between 0 and 6000),
  water_temp     numeric check (water_temp between -5 and 120),
  air_temp       numeric check (air_temp between -60 and 140),
  visibility     numeric check (visibility between 0 and 500),
  entry          text not null default '' check (entry in ('', 'shore', 'boat', 'other')),
  water          text not null default '' check (water in ('', 'salt', 'fresh')),
  current        text not null default '' check (current in ('', 'none', 'light', 'moderate', 'strong')),
  conditions     text not null default '' check (char_length(conditions) <= 300),
  suit           text not null default '' check (char_length(suit) <= 80),
  weight         numeric check (weight between 0 and 200),
  tags           text[] not null default '{}' check (cardinality(tags) <= 12 and tags <@ array[
                   'training', 'night', 'deep', 'deco', 'wreck', 'cave', 'overhead', 'drift', 'sidemount', 'dpv',
                   'drysuit', 'ice']::text[]),
  buddy          text not null default '' check (char_length(buddy) <= 200),
  course         text not null default '' check (char_length(course) <= 200),     -- for training dives
  instructor     text not null default '' check (char_length(instructor) <= 200), -- who taught it
  notes          text not null default '' check (char_length(notes) <= 4000),
  signed_by      uuid references auth.users (id) on delete set null,
  signed_name    text,
  signed_role    text,
  signed_at      timestamptz,
  sign_comment   text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists dive_logs_user_idx on public.dive_logs (user_id, dived_on desc);
create index if not exists dive_logs_unsigned_training_idx on public.dive_logs (dived_on)
  where signed_at is null and 'training' = any (tags);
alter table public.dive_logs enable row level security;

drop policy if exists "Members see their own dive log; staff see all" on public.dive_logs;
create policy "Members see their own dive log; staff see all" on public.dive_logs
  for select to authenticated using (user_id = (select auth.uid()) or (select public.has_role('divemaster')));

drop policy if exists "Registered members log their own dives" on public.dive_logs;
create policy "Registered members log their own dives" on public.dive_logs
  for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.my_logbook_access()));

drop policy if exists "Members change their own unsigned dives" on public.dive_logs;
create policy "Members change their own unsigned dives" on public.dive_logs
  for update to authenticated
  using (user_id = (select auth.uid()) and signed_at is null)
  with check (user_id = (select auth.uid()) and (select public.my_logbook_access()));

drop policy if exists "Members remove their own unsigned dives" on public.dive_logs;
create policy "Members remove their own unsigned dives" on public.dive_logs
  for delete to authenticated using (user_id = (select auth.uid()) and signed_at is null);

-- Keeps the signature fields for sign_dive()/unsign_dive() only, stamps updated_at, and caps each log at 5000 dives.
create or replace function public.check_dive_log()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if (select count(*) from public.dive_logs where user_id = new.user_id) >= 5000 then
      raise exception 'You can log up to 5000 dives.';
    end if;
    new.created_at := now();
  else
    new.user_id := old.user_id; new.created_at := old.created_at;
  end if;
  if coalesce(current_setting('ld.signing', true), '') <> 'on' then
    if tg_op = 'INSERT' then
      new.signed_by := null; new.signed_name := null; new.signed_role := null; new.signed_at := null; new.sign_comment := null;
    else
      new.signed_by := old.signed_by; new.signed_name := old.signed_name; new.signed_role := old.signed_role;
      new.signed_at := old.signed_at; new.sign_comment := old.sign_comment;
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists dive_logs_check on public.dive_logs;
create trigger dive_logs_check before insert or update on public.dive_logs
  for each row execute function public.check_dive_log();

-- An Instructor or Admin signs off a training dive (with an optional comment). Not their own dives.
create or replace function public.sign_dive(dive_id uuid, comment text default '')
returns public.dive_logs
language plpgsql security definer set search_path = ''
as $$
declare d public.dive_logs; me uuid := (select auth.uid()); who text;
begin
  if not public.has_role('instructor') then
    raise exception 'Only an Instructor or Admin can sign off dives.' using errcode = '42501';
  end if;
  select * into d from public.dive_logs where id = dive_id for update;
  if not found then raise exception 'That dive isn''t in the log book any more.'; end if;
  if d.user_id = me then raise exception 'You can''t sign off your own dives.'; end if;
  if d.signed_at is not null then raise exception 'This dive is already signed off.'; end if;
  select coalesce(nullif(trim(p.full_name), ''), u.email::text) into who
    from auth.users u left join public.student_profiles p on p.id = u.id where u.id = me;
  perform set_config('ld.signing', 'on', true);
  update public.dive_logs
     set signed_by = me, signed_name = left(coalesce(who, ''), 200), signed_role = public.my_role(),
         signed_at = now(), sign_comment = nullif(left(trim(coalesce(comment, '')), 500), '')
   where id = d.id
   returning * into d;
  perform set_config('ld.signing', 'off', true);
  return d;
end $$;
revoke all on function public.sign_dive(uuid, text) from public, anon;
grant execute on function public.sign_dive(uuid, text) to authenticated;

-- An Instructor or Admin takes a sign-off back (e.g. signed by mistake), which unlocks the dive again.
create or replace function public.unsign_dive(dive_id uuid)
returns public.dive_logs
language plpgsql security definer set search_path = ''
as $$
declare d public.dive_logs;
begin
  if not public.has_role('instructor') then
    raise exception 'Only an Instructor or Admin can take back a sign-off.' using errcode = '42501';
  end if;
  perform set_config('ld.signing', 'on', true);
  update public.dive_logs
     set signed_by = null, signed_name = null, signed_role = null, signed_at = null, sign_comment = null
   where id = dive_id
   returning * into d;
  perform set_config('ld.signing', 'off', true);
  if d.id is null then raise exception 'That dive isn''t in the log book any more.'; end if;
  return d;
end $$;
revoke all on function public.unsign_dive(uuid) from public, anon;
grant execute on function public.unsign_dive(uuid) to authenticated;

-- Training dives waiting for a sign-off, with the diver's name: the Instructor's list on logbook.html.
create or replace function public.dives_to_sign()
returns table (id uuid, user_id uuid, diver text, dive_no integer, dived_on date, site_name text, place text,
               course text, instructor text, max_depth numeric, bottom_time integer, units text)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.has_role('instructor') then
    raise exception 'Only an Instructor or Admin can sign off dives.' using errcode = '42501';
  end if;
  return query
    select d.id, d.user_id, coalesce(nullif(trim(p.full_name), ''), u.email::text), d.dive_no, d.dived_on,
           d.site_name, d.place, d.course, d.instructor, d.max_depth, d.bottom_time, d.units
    from public.dive_logs d
    join auth.users u on u.id = d.user_id
    left join public.student_profiles p on p.id = d.user_id
    where d.signed_at is null and 'training' = any (d.tags) and d.user_id <> (select auth.uid())
    order by d.dived_on, d.created_at
    limit 200;
end;
$$;
revoke all on function public.dives_to_sign() from public, anon;
grant execute on function public.dives_to_sign() to authenticated;

-- An Instructor or Admin switches the log book on (or off) by hand for one person, from Records → Students.
-- Someone registered for a class has it anyway. Makes their profile row if they don't have one yet.
create or replace function public.set_logbook_access(member uuid, allow boolean)
returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.has_role('instructor') then
    raise exception 'Only Instructors and Admins can change log book access' using errcode = '42501';
  end if;
  if not exists (select 1 from auth.users where id = member) then
    raise exception 'No account found' using errcode = 'P0002';
  end if;
  insert into public.student_profiles (id, logbook_access) values (member, coalesce(allow, false))
  on conflict (id) do update set logbook_access = excluded.logbook_access;
  return coalesce(allow, false);
end;
$$;
revoke all on function public.set_logbook_access(uuid, boolean) from public, anon;
grant execute on function public.set_logbook_access(uuid, boolean) to authenticated;

revoke all on public.dive_logs from anon;
grant select, insert, update, delete on public.dive_logs to authenticated;

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

-- ---------- emails sent from the site (added 2026-11-13) ----------
-- One row each time an Instructor or Admin sends an email from the site (the send-email Edge Function
-- writes it). It holds how many people it went to and the subject, never addresses or the message,
-- and keeps sending inside Resend's free allowance of 100 emails a day.
create table if not exists public.email_log (
  id          bigint generated always as identity primary key,
  sent_by     uuid default auth.uid() references auth.users (id) on delete set null,
  recipients  integer not null check (recipients between 1 and 100),
  subject     text not null default '' check (length(subject) <= 200),
  created_at  timestamptz not null default now()
);
alter table public.email_log enable row level security;

drop policy if exists "Instructors see the email log" on public.email_log;
create policy "Instructors see the email log" on public.email_log
  for select to authenticated using ((select public.has_role('instructor')));

drop policy if exists "Instructors add to the email log" on public.email_log;
create policy "Instructors add to the email log" on public.email_log
  for insert to authenticated
  with check ((select public.has_role('instructor')) and sent_by = (select auth.uid()));

-- ---------- learning agreements students sign in the Student portal (added 2026-11-13) ----------
-- Business → Scheduling sends a student their learning agreement. It is copied here so the student can read,
-- sign and print it in the Student portal, and they get an email asking them to. Students see only their own;
-- Dive Masters and up see all. Only Instructors and Admins add, change or take back agreements, and only
-- until the student signs. Signing is done through sign_agreement() below, and only by that student: nobody,
-- staff included, can write or change a signature any other way.
create table if not exists public.agreements (
  id             text primary key,                -- the Scheduling entry's id in the instructor app
  student_id     uuid not null references public.student_profiles (id) on delete cascade,
  title          text not null default '' check (length(title) <= 300),
  body           text not null default '' check (length(body) <= 100000),
  meta           jsonb not null default '{}'::jsonb,   -- names, dates and contact shown at the top of the agreement
  sent_by        uuid default auth.uid() references auth.users (id) on delete set null,
  sent_at        timestamptz not null default now(),
  signed_at      timestamptz,
  signed_name    text,
  guardian_name  text,
  signed_body    text                              -- exactly the wording the student signed
);
create index if not exists agreements_student_id on public.agreements (student_id);
alter table public.agreements enable row level security;

drop policy if exists "Students read their own agreements; staff read all" on public.agreements;
create policy "Students read their own agreements; staff read all" on public.agreements
  for select to authenticated using (student_id = (select auth.uid()) or (select public.has_role('divemaster')));

drop policy if exists "Instructors send agreements" on public.agreements;
create policy "Instructors send agreements" on public.agreements
  for insert to authenticated with check ((select public.has_role('instructor')));

drop policy if exists "Instructors change agreements until signed" on public.agreements;
create policy "Instructors change agreements until signed" on public.agreements
  for update to authenticated
  using ((select public.has_role('instructor')) and signed_at is null)
  with check ((select public.has_role('instructor')));

drop policy if exists "Instructors take back agreements" on public.agreements;
create policy "Instructors take back agreements" on public.agreements
  for delete to authenticated using ((select public.has_role('instructor')));

-- Signature fields can only be written by sign_agreement().
create or replace function public.protect_agreement_signature()
returns trigger language plpgsql set search_path = '' as $$
begin
  if coalesce(current_setting('ld.signing', true), '') <> 'on' then
    if tg_op = 'INSERT' then
      new.signed_at := null; new.signed_name := null; new.guardian_name := null; new.signed_body := null;
    else
      new.signed_at := old.signed_at; new.signed_name := old.signed_name;
      new.guardian_name := old.guardian_name; new.signed_body := old.signed_body;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists agreements_protect_signature on public.agreements;
create trigger agreements_protect_signature before insert or update on public.agreements
  for each row execute function public.protect_agreement_signature();

create or replace function public.sign_agreement(agreement_id text, signer_name text, guardian text default '')
returns public.agreements
language plpgsql security definer set search_path = '' as $$
declare a public.agreements;
begin
  select * into a from public.agreements where id = agreement_id and student_id = (select auth.uid()) for update;
  if not found then raise exception 'That agreement isn''t in your account.'; end if;
  if a.signed_at is not null then raise exception 'You''ve already signed this agreement.'; end if;
  if length(trim(coalesce(signer_name, ''))) < 2 then raise exception 'Type your full name to sign.'; end if;
  perform set_config('ld.signing', 'on', true);
  update public.agreements
     set signed_at = now(), signed_name = left(trim(signer_name), 200),
         guardian_name = nullif(left(trim(coalesce(guardian, '')), 200), ''), signed_body = body
   where id = a.id
   returning * into a;
  perform set_config('ld.signing', 'off', true);
  return a;
end $$;
revoke all on function public.sign_agreement(text, text, text) from public, anon;
grant execute on function public.sign_agreement(text, text, text) to authenticated;

revoke all on public.agreements from anon;
grant select, insert, update, delete on public.agreements to authenticated;

-- ---------- Site map access levels (added 2026-11-21) ----------
-- Site maps are only for logged-in members with a site map access level, set per member by an Admin in
-- Records → Student accounts ("Site maps access"). Each level sees its own lines and every level below it:
--   green         Green circle: open water divers (the main survey)
--   blue          Blue square: advanced divers
--   black         Black diamond: tech divers
--   double-black  Double black diamond: tech divers on scooters
--   survey        Survey team: sees everything and can suggest changes to the map (an admin approves them)
--   site-admin    Dive site admin: also publishes changes, rates lines, places maps, adds layers, approves
--                 photos. None of the website's other Admin powers. Only Admins can give or take this level.
-- Website Admins are always Dive site admins. Members with no level can't open the site maps.
create table if not exists public.site_map_members (
  user_id  uuid primary key references auth.users (id) on delete cascade,
  level    text not null check (level in ('green', 'blue', 'black', 'double-black', 'survey', 'site-admin')),
  set_by   uuid default auth.uid() references auth.users (id) on delete set null,
  set_at   timestamptz not null default now()
);
alter table public.site_map_members enable row level security;

-- The level as a number: 0 none, 1 green, 2 blue, 3 black, 4 double black, 5 survey team, 6 Dive site admin.
-- Callable by visitors who aren't logged in (then 0), so the policies below can use it.
create or replace function public.site_map_rank()
returns integer language sql stable security definer set search_path = '' as $$
  select case
    when (select auth.uid()) is null then 0
    when public.has_role('admin') then 6
    else coalesce((select array_position(array['green', 'blue', 'black', 'double-black', 'survey', 'site-admin'], level)
                     from public.site_map_members where user_id = (select auth.uid())), 0)
  end;
$$;
revoke all on function public.site_map_rank() from public;
grant execute on function public.site_map_rank() to anon, authenticated;

-- True for Admins and Dive site admins.
create or replace function public.is_site_map_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.site_map_rank() >= 6;
$$;
revoke all on function public.is_site_map_admin() from public;
grant execute on function public.is_site_map_admin() to anon, authenticated;

-- Your own level for the site map pages: 'admin' for website Admins, else the level or 'none'.
create or replace function public.my_site_map_level()
returns text language sql stable security definer set search_path = '' as $$
  select case when (select auth.uid()) is null then 'none'
              when public.has_role('admin') then 'admin'
              else coalesce((select level from public.site_map_members where user_id = (select auth.uid())), 'none') end;
$$;
revoke all on function public.my_site_map_level() from public, anon;
grant execute on function public.my_site_map_level() to authenticated;

drop policy if exists "Site map levels: your own; Dive site admins see all" on public.site_map_members;
create policy "Site map levels: your own; Dive site admins see all" on public.site_map_members for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_site_map_admin()));
revoke all on public.site_map_members from anon;
grant select on public.site_map_members to authenticated;

-- Set a member's level ('none' takes it away). Admins and Dive site admins; only Admins give or take 'site-admin'.
create or replace function public.set_site_map_level(member uuid, new_level text)
returns void language plpgsql security definer set search_path = '' as $$
declare old text;
begin
  if not public.is_site_map_admin() then
    raise exception 'Only Admins and Dive site admins can set site map access' using errcode = '42501';
  end if;
  if new_level not in ('none', 'green', 'blue', 'black', 'double-black', 'survey', 'site-admin') then
    raise exception 'Unknown site map level %', new_level using errcode = '22023';
  end if;
  select level into old from public.site_map_members where user_id = member;
  if (new_level = 'site-admin' or old = 'site-admin') and not public.has_role('admin') then
    raise exception 'Only Admins can make someone a Dive site admin, or change a Dive site admin' using errcode = '42501';
  end if;
  if new_level = 'none' then
    delete from public.site_map_members where user_id = member;
  else
    insert into public.site_map_members (user_id, level, set_by, set_at) values (member, new_level, (select auth.uid()), now())
    on conflict (user_id) do update set level = excluded.level, set_by = excluded.set_by, set_at = excluded.set_at;
  end if;
end $$;
revoke all on function public.set_site_map_level(uuid, text) from public, anon;
grant execute on function public.set_site_map_level(uuid, text) to authenticated;

-- Members' names and levels for Map setup (Dive site admins can't read profiles otherwise).
drop function if exists public.site_map_people();
create or replace function public.site_map_people()
returns table (id uuid, full_name text, level text) language sql stable security definer set search_path = '' as $$
  select u.id, coalesce(nullif(p.full_name, ''), split_part(u.email::text, '@', 1)), coalesce(m.level, 'none')
    from auth.users u left join public.student_profiles p on p.id = u.id left join public.site_map_members m on m.user_id = u.id
   where public.is_site_map_admin()
   order by 2;
$$;
revoke all on function public.site_map_people() from public, anon;
grant execute on function public.site_map_people() to authenticated;

-- ---------- Site maps: published survey maps, suggested changes and history (added 2026-11-21) ----------
-- Members with a site map level can read a published map. The survey team suggests changes; Admins and Dive
-- site admins approve or decline them and publish. Every published version is kept in site_map_history.
-- The survey data lives only here, not in the website's public files: load a site the first time with the
-- private seed file (e.g. site-maps-seed-bonnie-castle.sql, kept in the project files, not in the repository).
create table if not exists public.site_maps (
  id          text primary key check (id ~ '^[a-z0-9-]{1,60}$'),
  data        jsonb not null check (jsonb_typeof(data) = 'object' and pg_column_size(data) <= 3000000),
  version     integer not null default 1,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users (id) on delete set null
);
alter table public.site_maps enable row level security;
drop policy if exists "Anyone can read published site maps" on public.site_maps;
drop policy if exists "Members with a site map level read published maps" on public.site_maps;
create policy "Members with a site map level read published maps" on public.site_maps for select to authenticated
  using ((select public.site_map_rank()) >= 1);
-- Written only by publish_site_map() below.

create table if not exists public.site_map_history (
  id            bigint generated always as identity primary key,
  site_id       text not null references public.site_maps (id) on delete cascade,
  version       integer not null,
  data          jsonb not null,
  summary       text not null default '' check (length(summary) <= 2000),
  published_at  timestamptz not null default now(),
  published_by  uuid references auth.users (id) on delete set null,
  published_by_name text not null default '',
  unique (site_id, version)
);
alter table public.site_map_history enable row level security;
drop policy if exists "Admins read site map history" on public.site_map_history;
create policy "Admins read site map history" on public.site_map_history for select to authenticated
  using ((select public.is_site_map_admin()));

create table if not exists public.site_map_edits (
  id            uuid primary key default gen_random_uuid(),
  site_id       text not null check (site_id ~ '^[a-z0-9-]{1,60}$'),
  author        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  author_name   text not null default '' check (length(author_name) <= 200),
  summary       text not null default '' check (length(summary) <= 2000),
  changes       jsonb not null check (jsonb_typeof(changes) = 'array' and jsonb_array_length(changes) between 1 and 200
                                      and pg_column_size(changes) <= 300000),
  base_version  integer not null default 0,
  status        text not null default 'pending' check (status in ('pending', 'approved', 'declined', 'withdrawn')),
  review_note   text not null default '' check (length(review_note) <= 2000),
  reviewed_by   uuid references auth.users (id) on delete set null,
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists site_map_edits_site_status on public.site_map_edits (site_id, status);
alter table public.site_map_edits enable row level security;
drop policy if exists "Members see their own suggestions; admins see all" on public.site_map_edits;
create policy "Members see their own suggestions; admins see all" on public.site_map_edits for select to authenticated
  using (author = (select auth.uid()) or (select public.is_site_map_admin()));
drop policy if exists "Members suggest changes" on public.site_map_edits;
drop policy if exists "The survey team suggests changes" on public.site_map_edits;
create policy "The survey team suggests changes" on public.site_map_edits for insert to authenticated
  with check (author = (select auth.uid()) and status = 'pending' and review_note = '' and reviewed_by is null and reviewed_at is null
              and (select public.site_map_rank()) >= 5);
-- Status changes go through the functions below, so there's no update policy.

-- The author's name comes from their profile (or email), not from what the page sends.
create or replace function public.site_map_edit_author()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.author := (select auth.uid());
  select coalesce(nullif(p.full_name, ''), u.email::text, '') into new.author_name
    from auth.users u left join public.student_profiles p on p.id = u.id where u.id = new.author;
  new.author_name := coalesce(new.author_name, '');
  return new;
end $$;
drop trigger if exists site_map_edits_author on public.site_map_edits;
create trigger site_map_edits_author before insert on public.site_map_edits
  for each row execute function public.site_map_edit_author();

-- Publish a new version of a site map (Admins). expected_version is the version the Admin's page was showing
-- (0 when the map has never been published), so two Admins can't overwrite each other's work by accident.
-- With edit_id, that suggestion is marked approved.
create or replace function public.publish_site_map(site text, new_data jsonb, expected_version integer,
                                                   summary text default '', edit_id uuid default null)
returns integer
language plpgsql security definer set search_path = '' as $$
declare cur integer; nv integer; who text;
begin
  if not public.is_site_map_admin() then
    raise exception 'Only Admins and Dive site admins can publish site maps' using errcode = '42501';
  end if;
  if new_data is null or jsonb_typeof(new_data) <> 'object' or jsonb_typeof(new_data -> 'runs') <> 'object'
     or jsonb_typeof(new_data -> 'plan') <> 'array' then
    raise exception 'That map data isn''t complete' using errcode = '22023';
  end if;
  select version into cur from public.site_maps where id = site for update;
  if coalesce(cur, 0) <> coalesce(expected_version, -1) then
    raise exception 'Someone else published this map while you were working. Refresh the page and check your changes again.'
      using errcode = '40001';
  end if;
  nv := coalesce(cur, 0) + 1;
  select coalesce(nullif(p.full_name, ''), u.email::text, '') into who
    from auth.users u left join public.student_profiles p on p.id = u.id where u.id = (select auth.uid());
  insert into public.site_maps (id, data, version, updated_at, updated_by)
    values (site, new_data, nv, now(), (select auth.uid()))
    on conflict (id) do update set data = excluded.data, version = excluded.version,
                                   updated_at = excluded.updated_at, updated_by = excluded.updated_by;
  insert into public.site_map_history (site_id, version, data, summary, published_by, published_by_name)
    values (site, nv, new_data, left(coalesce(summary, ''), 2000), (select auth.uid()), coalesce(who, ''));
  if edit_id is not null then
    update public.site_map_edits set status = 'approved', reviewed_by = (select auth.uid()), reviewed_at = now()
     where id = edit_id and site_id = site and status = 'pending';
  end if;
  return nv;
end $$;
revoke all on function public.publish_site_map(text, jsonb, integer, text, uuid) from public, anon;
grant execute on function public.publish_site_map(text, jsonb, integer, text, uuid) to authenticated;

-- Telegram alert to Jamie when the survey team sends a suggestion (notify-signup Edge Function, { mapEdit: id }),
-- added 2026-11-22. Answers once, only for the caller's own pending suggestion from the last 15 minutes.
alter table public.site_map_edits add column if not exists notified_at timestamptz;
create or replace function public.claim_site_map_edit_notice(p_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare r public.site_map_edits%rowtype;
begin
  update public.site_map_edits e set notified_at = now()
    where e.id = p_id and e.author = (select auth.uid()) and e.notified_at is null and e.status = 'pending'
      and e.created_at > now() - interval '15 minutes'
    returning e.* into r;
  if not found then return null; end if;
  return jsonb_build_object('kind', 'mapedit', 'site_id', r.site_id, 'notes', r.summary, 'changes', jsonb_array_length(r.changes),
    'title', coalesce((select m.data ->> 'title' from public.site_maps m where m.id = r.site_id), r.site_id),
    'name', coalesce(nullif(r.author_name, ''), (select nullif(p.full_name, '') from public.student_profiles p where p.id = r.author),
                     (select u.email::text from auth.users u where u.id = r.author), 'A survey team member'));
end $$;
revoke all on function public.claim_site_map_edit_notice(uuid) from public, anon;
grant execute on function public.claim_site_map_edit_notice(uuid) to authenticated;

-- An Admin declines a suggestion, with an optional note the member sees.
create or replace function public.decline_site_map_edit(edit_id uuid, note text default '')
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_site_map_admin() then
    raise exception 'Only Admins can review site map suggestions' using errcode = '42501';
  end if;
  update public.site_map_edits set status = 'declined', review_note = left(coalesce(note, ''), 2000),
         reviewed_by = (select auth.uid()), reviewed_at = now()
   where id = edit_id and status = 'pending';
  if not found then raise exception 'That suggestion has already been reviewed.'; end if;
end $$;
revoke all on function public.decline_site_map_edit(uuid, text) from public, anon;
grant execute on function public.decline_site_map_edit(uuid, text) to authenticated;

-- A member takes back their own suggestion before it's reviewed.
create or replace function public.withdraw_site_map_edit(edit_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.site_map_edits set status = 'withdrawn'
   where id = edit_id and author = (select auth.uid()) and status = 'pending';
  if not found then raise exception 'That suggestion has already been reviewed.'; end if;
end $$;
revoke all on function public.withdraw_site_map_edit(uuid) from public, anon;
grant execute on function public.withdraw_site_map_edit(uuid) to authenticated;

revoke all on public.site_maps, public.site_map_history, public.site_map_edits from anon;
grant select on public.site_maps to authenticated;
grant select on public.site_map_history to authenticated;
grant select, insert on public.site_map_edits to authenticated;

-- ---------- Site map layers: extra survey lines and pictures, some only for divers an Admin grants (added 2026-11-21) ----------
-- Each site map can have layers on top of its published survey (site_maps):
--   survey  more lines of survey (runs, plan, landmarks, runNames, like the site's own data) that start from
--           landmarks on the main survey. Used for line not every diver should follow (e.g. under the river).
--   image   a picture laid over the map, e.g. a topographic map. The file is in the private Storage bucket
--           'site-map-layers' at <site>/<layer id>/<file name>; bounds says where it sits, in feet on the map.
-- Rated survey layers (blue, black, double black) are readable by members whose level is that rating or higher.
-- A restricted picture layer is only readable by Dive site admins and the members listed in site_map_layer_access.
create table if not exists public.site_map_layers (
  id          uuid primary key default gen_random_uuid(),
  site_id     text not null check (site_id ~ '^[a-z0-9-]{1,60}$'),
  name        text not null check (length(name) between 1 and 120),
  kind        text not null check (kind in ('survey', 'image')),
  restricted  boolean not null default false,
  note        text not null default '' check (length(note) <= 500),   -- e.g. "Cave/overhead divers only"
  sort        integer not null default 0,
  opacity     real not null default 1 check (opacity between 0 and 1),
  survey      jsonb check (survey is null or (jsonb_typeof(survey) = 'object' and pg_column_size(survey) <= 3000000)),
  image_path  text not null default '' check (length(image_path) <= 300),
  bounds      jsonb check (bounds is null or jsonb_typeof(bounds) = 'object'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists site_map_layers_site on public.site_map_layers (site_id, sort);
-- Ski-style difficulty: a survey layer can hold all the lines of one rating. Green circle (novice) lines stay
-- on the main survey, which everyone sees; blue square, black diamond and double black diamond each get a layer.
alter table public.site_map_layers add column if not exists rating text;
alter table public.site_map_layers drop constraint if exists site_map_layers_rating;
alter table public.site_map_layers add constraint site_map_layers_rating
  check (rating is null or (kind = 'survey' and rating in ('blue', 'black', 'double-black')));
create unique index if not exists site_map_layers_one_per_rating on public.site_map_layers (site_id, rating) where rating is not null;
drop trigger if exists site_map_layers_touch on public.site_map_layers;
create trigger site_map_layers_touch before update on public.site_map_layers
  for each row execute function public.touch_updated_at();

create table if not exists public.site_map_layer_access (
  layer_id    uuid not null references public.site_map_layers (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  granted_by  uuid default auth.uid() references auth.users (id) on delete set null,
  granted_at  timestamptz not null default now(),
  primary key (layer_id, user_id)
);

-- True when the person looking may see a layer with this id, rating and restricted setting. The row policy
-- passes the row's own values: looking the row up by id would miss a row that is being added right now
-- (insert ... returning), which made adding a layer fail with "new row violates row-level security policy".
create or replace function public.site_map_layer_visible(layer uuid, layer_rating text, layer_restricted boolean)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.site_map_rank() >= 1 and (
    public.site_map_rank() >= 5
    or (layer_rating is not null and array_position(array['green', 'blue', 'black', 'double-black'], layer_rating) <= public.site_map_rank())
    or (layer_rating is null and (not coalesce(layer_restricted, false)
        or exists (select 1 from public.site_map_layer_access a where a.layer_id = layer and a.user_id = (select auth.uid())))));
$$;
revoke all on function public.site_map_layer_visible(uuid, text, boolean) from public;
grant execute on function public.site_map_layer_visible(uuid, text, boolean) to anon, authenticated;

-- The same, by the layer's id alone (for its picture in Storage).
create or replace function public.can_see_site_map_layer(layer uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.site_map_layers l where l.id = layer and public.site_map_layer_visible(l.id, l.rating, l.restricted));
$$;
revoke all on function public.can_see_site_map_layer(uuid) from public;
grant execute on function public.can_see_site_map_layer(uuid) to anon, authenticated;

alter table public.site_map_layers enable row level security;
drop policy if exists "Layers: open ones for everyone, restricted ones for granted members" on public.site_map_layers;
drop policy if exists "Layers: by site map level" on public.site_map_layers;
create policy "Layers: by site map level" on public.site_map_layers
  for select to authenticated using (public.site_map_layer_visible(id, rating, restricted));
drop policy if exists "Layers: Admins add" on public.site_map_layers;
create policy "Layers: Admins add" on public.site_map_layers for insert to authenticated with check ((select public.is_site_map_admin()));
drop policy if exists "Layers: Admins change" on public.site_map_layers;
create policy "Layers: Admins change" on public.site_map_layers for update to authenticated
  using ((select public.is_site_map_admin())) with check ((select public.is_site_map_admin()));
drop policy if exists "Layers: Admins remove" on public.site_map_layers;
create policy "Layers: Admins remove" on public.site_map_layers for delete to authenticated using ((select public.is_site_map_admin()));

alter table public.site_map_layer_access enable row level security;
drop policy if exists "Layer access: members see their own; Admins see all" on public.site_map_layer_access;
create policy "Layer access: members see their own; Admins see all" on public.site_map_layer_access
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_site_map_admin()));
drop policy if exists "Layer access: Admins grant" on public.site_map_layer_access;
create policy "Layer access: Admins grant" on public.site_map_layer_access for insert to authenticated with check ((select public.is_site_map_admin()));
drop policy if exists "Layer access: Admins take away" on public.site_map_layer_access;
create policy "Layer access: Admins take away" on public.site_map_layer_access for delete to authenticated using ((select public.is_site_map_admin()));

revoke all on public.site_map_layers, public.site_map_layer_access from anon;
grant select, insert, update, delete on public.site_map_layers to authenticated;
grant select, insert, delete on public.site_map_layer_access to authenticated;

-- Pictures for image layers: a private bucket. A picture can be read by whoever may see its layer
-- (the second folder of its path is the layer id); only Admins add, replace or remove them.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-map-layers', 'site-map-layers', false, 26214400, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "Site map pictures: whoever may see the layer" on storage.objects;
create policy "Site map pictures: whoever may see the layer" on storage.objects for select to authenticated
  using (bucket_id = 'site-map-layers' and (storage.foldername(name))[2] ~ '^[0-9a-f-]{36}$'
         and public.can_see_site_map_layer(((storage.foldername(name))[2])::uuid));
drop policy if exists "Site map pictures: Admins add" on storage.objects;
create policy "Site map pictures: Admins add" on storage.objects for insert to authenticated
  with check (bucket_id = 'site-map-layers' and (select public.is_site_map_admin()));
drop policy if exists "Site map pictures: Admins replace" on storage.objects;
create policy "Site map pictures: Admins replace" on storage.objects for update to authenticated
  using (bucket_id = 'site-map-layers' and (select public.is_site_map_admin()))
  with check (bucket_id = 'site-map-layers' and (select public.is_site_map_admin()));
drop policy if exists "Site map pictures: Admins remove" on storage.objects;
create policy "Site map pictures: Admins remove" on storage.objects for delete to authenticated
  using (bucket_id = 'site-map-layers' and (select public.is_site_map_admin()));

-- ---------- Site map landmark photos (added 2026-11-21) ----------
-- Tap a landmark on a site map to see its photos. Any member with a site map level can add one; it shows for
-- them all once an Admin approves it (an Admin's own photos show straight away). Files are in the private bucket
-- 'site-map-photos' at <site>/<uploader id>/<file name>.
create table if not exists public.site_map_photos (
  id          uuid primary key default gen_random_uuid(),
  site_id     text not null check (site_id ~ '^[a-z0-9-]{1,60}$'),
  landmark    text not null check (landmark ~ '^[A-Z][A-Z0-9_]{0,59}$'),
  path        text not null check (length(path) between 1 and 300),
  caption     text not null default '' check (length(caption) <= 300),
  author      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  author_name text not null default '' check (length(author_name) <= 200),
  approved    boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists site_map_photos_site on public.site_map_photos (site_id, landmark);
alter table public.site_map_photos enable row level security;
drop policy if exists "Photos: approved for everyone; your own; Admins all" on public.site_map_photos;
drop policy if exists "Photos: approved for members with a level; your own; admins all" on public.site_map_photos;
create policy "Photos: approved for members with a level; your own; admins all" on public.site_map_photos for select to authenticated
  using ((select public.site_map_rank()) >= 1 and (approved or author = (select auth.uid()) or (select public.is_site_map_admin())));
drop policy if exists "Photos: members add" on public.site_map_photos;
create policy "Photos: members add" on public.site_map_photos for insert to authenticated
  with check (author = (select auth.uid()) and (select public.site_map_rank()) >= 1 and (not approved or (select public.is_site_map_admin()))
              and split_part(path, '/', 2) = (select auth.uid())::text);
drop policy if exists "Photos: Admins approve and edit" on public.site_map_photos;
create policy "Photos: Admins approve and edit" on public.site_map_photos for update to authenticated
  using ((select public.is_site_map_admin())) with check ((select public.is_site_map_admin()));
drop policy if exists "Photos: yours or an Admin removes" on public.site_map_photos;
create policy "Photos: yours or an Admin removes" on public.site_map_photos for delete to authenticated
  using (author = (select auth.uid()) or (select public.is_site_map_admin()));

create or replace function public.site_map_photo_author()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.author := (select auth.uid());
  select coalesce(nullif(p.full_name, ''), split_part(u.email::text, '@', 1), '') into new.author_name
    from auth.users u left join public.student_profiles p on p.id = u.id where u.id = new.author;
  new.author_name := coalesce(new.author_name, '');
  return new;
end $$;
drop trigger if exists site_map_photos_author on public.site_map_photos;
create trigger site_map_photos_author before insert on public.site_map_photos
  for each row execute function public.site_map_photo_author();

revoke all on public.site_map_photos from anon;
grant select, insert, update, delete on public.site_map_photos to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-map-photos', 'site-map-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "Site map photos: approved, your own, or Admins" on storage.objects;
create policy "Site map photos: approved, your own, or Admins" on storage.objects for select to authenticated
  using (bucket_id = 'site-map-photos' and (select public.site_map_rank()) >= 1 and ((storage.foldername(name))[2] = (select auth.uid())::text
         or (select public.is_site_map_admin())
         or exists (select 1 from public.site_map_photos p where p.path = name and p.approved)));
drop policy if exists "Site map photos: members add to their own folder" on storage.objects;
create policy "Site map photos: members add to their own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'site-map-photos' and (storage.foldername(name))[2] = (select auth.uid())::text and (select public.site_map_rank()) >= 1);
drop policy if exists "Site map photos: yours or an Admin removes" on storage.objects;
create policy "Site map photos: yours or an Admin removes" on storage.objects for delete to authenticated
  using (bucket_id = 'site-map-photos' and ((storage.foldername(name))[2] = (select auth.uid())::text or (select public.is_site_map_admin())));

-- ---------- Moving earlier site map grants over to access levels (added 2026-11-21) ----------
-- The first version had a separate Dive site admin switch (site_map_admins) and per-rating grants
-- (site_map_layer_access rows on rated layers). They become levels, then the old records go.
do $$
begin
  if to_regclass('public.site_map_layer_access') is not null then
    insert into public.site_map_members (user_id, level)
    select a.user_id, (array['green', 'blue', 'black', 'double-black'])[max(array_position(array['green', 'blue', 'black', 'double-black'], l.rating))]
      from public.site_map_layer_access a join public.site_map_layers l on l.id = a.layer_id
     where l.rating is not null group by a.user_id
    on conflict (user_id) do nothing;
    delete from public.site_map_layer_access a using public.site_map_layers l where l.id = a.layer_id and l.rating is not null;
  end if;
  if to_regclass('public.site_map_admins') is not null then
    insert into public.site_map_members (user_id, level) select user_id, 'site-admin' from public.site_map_admins
    on conflict (user_id) do update set level = 'site-admin';
    drop function if exists public.set_site_map_admin(uuid, boolean);
    drop table public.site_map_admins;
  end if;
end $$;

-- ---------- Telegram alert when someone makes a new account (added 2026-11-22) ----------
-- When a row is added to auth.users, the database calls the notify-signup Edge Function with
-- { newAccount: id } (through pg_net, after the sign-up is saved). The function asks
-- claim_new_account_notice, which only the server key may call, for the name, email and time,
-- once per account and only within 15 minutes of sign-up. A failed alert never blocks a sign-up.
create extension if not exists pg_net;
create table if not exists public.new_account_notices (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  notified_at timestamptz
);
alter table public.new_account_notices enable row level security;
revoke all on public.new_account_notices from public, anon, authenticated;

create or replace function public.claim_new_account_notice(p_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare u auth.users%rowtype;
begin
  update public.new_account_notices n set notified_at = now()
    where n.user_id = p_id and n.notified_at is null and n.created_at > now() - interval '15 minutes';
  if not found then return null; end if;
  select * into u from auth.users where id = p_id;
  return jsonb_build_object('kind', 'account', 'email', u.email::text, 'created_at', u.created_at,
    'confirmed', u.email_confirmed_at is not null,
    'name', coalesce((select nullif(p.full_name, '') from public.student_profiles p where p.id = p_id),
                     u.raw_user_meta_data ->> 'full_name', ''));
end $$;
revoke all on function public.claim_new_account_notice(uuid) from public, anon, authenticated;
grant execute on function public.claim_new_account_notice(uuid) to service_role;

create or replace function public.notify_new_account()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  begin
    insert into public.new_account_notices (user_id) values (new.id) on conflict (user_id) do nothing;
    perform net.http_post(
      url := 'https://tohabfygfsvcntarmfck.supabase.co/functions/v1/notify-signup',
      body := jsonb_build_object('newAccount', new.id),
      headers := jsonb_build_object('Content-Type', 'application/json'));
  exception when others then
    raise warning 'New account alert not sent: %', sqlerrm;
  end;
  return new;
end $$;
revoke all on function public.notify_new_account() from public, anon, authenticated;

drop trigger if exists on_auth_user_created_notify on auth.users;
create trigger on_auth_user_created_notify after insert on auth.users
  for each row execute function public.notify_new_account();

-- ---------- email to members and groups, and opting out (added 2026-11-22) ----------
-- Business → Email groups sends one email to people picked by level, class or event, course, certification or
-- site maps level (the send-email Edge Function, "promo" mode). Members can opt out of these emails in their
-- Student portal, or with the unsubscribe link at the bottom of each one. Opting out never stops email about
-- their own classes, agreements or account. Read and changed only through the functions below.
create table if not exists public.email_prefs (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  opted_out  boolean not null default false,
  token      uuid not null unique default gen_random_uuid(),   -- the secret in their unsubscribe link
  updated_at timestamptz not null default now()
);
alter table public.email_prefs enable row level security;

-- The signed-in member's own choice (Student portal).
create or replace function public.my_email_opt_out()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select e.opted_out from public.email_prefs e where e.user_id = (select auth.uid())), false);
$$;
revoke all on function public.my_email_opt_out() from public, anon;
grant execute on function public.my_email_opt_out() to authenticated;

create or replace function public.set_email_opt_out(opt_out boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Please log in first' using errcode = '42501';
  end if;
  insert into public.email_prefs (user_id, opted_out, updated_at) values ((select auth.uid()), coalesce(opt_out, false), now())
  on conflict (user_id) do update set opted_out = excluded.opted_out, updated_at = now();
  return coalesce(opt_out, false);
end $$;
revoke all on function public.set_email_opt_out(boolean) from public, anon;
grant execute on function public.set_email_opt_out(boolean) to authenticated;

-- The unsubscribe link in an email (unsubscribe.html, or the email app's own Unsubscribe button). Works without
-- logging in: the random token in the link is the proof.
create or replace function public.email_unsubscribe(t uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update public.email_prefs set opted_out = true, updated_at = now() where token = t;
  return found;
end $$;
revoke all on function public.email_unsubscribe(uuid) from public;
grant execute on function public.email_unsubscribe(uuid) to anon, authenticated;

-- Everyone who could get a group email, with what the groups are made from. Instructors and Admins only.
-- Leaves out deactivated (banned) and deleted accounts.
drop function if exists public.email_audience();
create or replace function public.email_audience()
returns table (
  id uuid, email text, full_name text, role text, certifications jsonb, site_level text,
  events jsonb, courses jsonb, opted_out boolean, email_confirmed boolean
)
language plpgsql stable security definer set search_path = ''
as $$
#variable_conflict use_column
begin
  if not public.has_role('instructor') then
    raise exception 'Only Instructors and Admins can email groups' using errcode = '42501';
  end if;
  return query
    select u.id, u.email::text, coalesce(p.full_name, ''), coalesce(r.role, 'student'),
           coalesce(p.certifications, '[]'::jsonb), coalesce(m.level, 'none'),
           coalesce((select jsonb_agg(jsonb_build_object('id', s.class_id, 'status', s.status,
                       'title', coalesce(nullif(k.title, ''), nullif(k.course_name, ''), nullif(s.title, ''), 'Calendar entry'),
                       'dates', coalesce(k.dates, '[]'::jsonb)))
                       from public.event_signups s left join public.classes k on k.id = s.class_id
                      where s.student_id = u.id and s.status <> 'declined'), '[]'::jsonb),
           coalesce((select jsonb_agg(distinct sp.course) from public.student_progress sp where sp.student_id = u.id), '[]'::jsonb),
           coalesce(e.opted_out, false), u.email_confirmed_at is not null
    from auth.users u
    left join public.student_profiles p on p.id = u.id
    left join public.staff_roles r on r.user_id = u.id
    left join public.site_map_members m on m.user_id = u.id
    left join public.email_prefs e on e.user_id = u.id
    where coalesce(u.email, '') <> '' and u.deleted_at is null and (u.banned_until is null or u.banned_until < now())
    order by coalesce(nullif(p.full_name, ''), u.email::text);
end;
$$;
revoke all on function public.email_audience() from public, anon;
grant execute on function public.email_audience() to authenticated;

-- The people a group email actually goes to, out of the ones picked, with each one's unsubscribe token.
-- Leaves out anyone who opted out, hasn't confirmed their email, or is deactivated. Called by send-email.
drop function if exists public.promo_recipients(uuid[]);
create or replace function public.promo_recipients(ids uuid[])
returns table (id uuid, email text, full_name text, token uuid)
language plpgsql security definer set search_path = ''
as $$
#variable_conflict use_column
begin
  if not public.has_role('instructor') then
    raise exception 'Only Instructors and Admins can email groups' using errcode = '42501';
  end if;
  insert into public.email_prefs (user_id)
    select u.id from auth.users u where u.id = any(ids)
  on conflict (user_id) do nothing;
  return query
    select u.id, u.email::text, coalesce(p.full_name, ''), e.token
    from auth.users u
    join public.email_prefs e on e.user_id = u.id
    left join public.student_profiles p on p.id = u.id
    where u.id = any(ids) and not e.opted_out and u.email_confirmed_at is not null
      and coalesce(u.email, '') <> '' and u.deleted_at is null and (u.banned_until is null or u.banned_until < now());
end;
$$;
revoke all on function public.promo_recipients(uuid[]) from public, anon;
grant execute on function public.promo_recipients(uuid[]) to authenticated;
