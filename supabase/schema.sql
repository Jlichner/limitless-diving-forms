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
