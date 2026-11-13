# Limitless Diving Forms

A web app for Limitless Diving & Technical Training's courses: Open Water Diver + Nitrox, Rescue Diver and Divemaster. It opens on a class calendar, publishes upcoming classes to a public page, and turns each course proposal into editable student records.

## What it does

- **Class calendar (the landing page):** plan training classes on a month calendar. Each class has a course, dates (one per class day), time, location, price, seats and a public description. Enroll students straight from a class: they get a course record with the class's dates and location filled in, and the class shows their progress and balance. Mark a class **Show on the public calendar**, then use **Publish calendar** to put it on the public page.
- **Public class calendar (`classes.html`):** a page for students and the public with a month calendar and a card for each upcoming published class (dates, time, location, price, open seats, description, and an "Ask about this class" email link). It never shows student names.
- **Available classes (`available-classes.html`):** a public page listing every course in the catalog, grouped as Start diving, Keep going, Specialties, Technical diving and Leadership. Each course opens a detail view with a short description, the standards from the 2026 NAUI manual (age, what you need to start, dives, max depth), its next scheduled dates and an "Ask about this course" link. Descriptions live in `ABOUT` in `catalog.js`.
- **Request a class (`request.html`):** a logged-in student picks a course and the days they'd like. Days with a published class or someone else's request show as Taken and can't be picked. A course needs at least one day per 2 open water dives (`minDays` in `catalog.js`), so a 4-dive course needs 2 days. Requests show at the top of the instructor's Calendar, where an Instructor or Admin can **Schedule as a class** (makes a draft class on those days) or **Decline**, with an optional note the student sees. Needs the latest `supabase/schema.sql` (the `class_requests` table).
- **Nitrox calculator (`nitrox.html`):** open to everyone. Maximum operating depth (PO2 1.2–1.6, with the 1.6 contingency depth), best mix for a depth, equivalent air depth, and oxygen exposure (PO2 and CNS % from the NOAA single-dive limits). Feet or metres, salt or fresh water. MOD and best mix round down, and EAD and CNS round up.
- **Students:** one shared student list for every course: contact info, date of birth, address, emergency contact, medical notes, every certification the student holds (agency, certification, number and date; pick from the course list or type any other), and the courses each student is in.
- **All courses:** the full catalog of NAUI, NAUI Technical and TDI courses students can enroll in, grouped by agency, with each NAUI course's minimum age, prerequisites, required open water dives and maximum depth from the 2026 NAUI Standards and Policies Manual. TDI standards are left blank for you to fill in under **Settings → Course standards**. Every course can be picked when you add a class to the calendar or enroll a student. Courses without a full skill matrix still get a prerequisite checklist, dive log, payments, sign-off and a proposal.

- **Open Water records:** each enrollment links to a student and holds the training dates, open water site and notes. A course-profile tracker and gauges show progress at a glance.
- **Required skill matrix:** the NAUI Open Water skills (checked against the 2026 NAUI Standards), with Confined and Open Water status (IP / PR / R), Pass, and initials.
- **Final evaluation:** the 8 emergency and final performance skills, with status, date and initials.
- **Dive log:** four open water dives (date, site, depth, duration, gas, notes, initials).
- **Remediation plan:** add as many corrective-plan items as you need.
- **Payment:** deposit and balance tracking, extra training charges, and the balance due.
- **Sign-off:** the student acknowledgment, with signature dates.
- **Rescue Diver:** the 28-skill Rescue matrix (Confined IP / PR, then M in open water), a prerequisite checklist (Open Water cert, age, CPR / First Aid / EO2 before the card is issued, gear), the Sept 12–13 Lake Hydra schedule, two open water dives, and the Rescue proposal with lake-ticket logistics and Venmo payment.
- **Divemaster:** the Divemaster matrix (Practiced IP / PR, then M when evaluated for the record), including NAUI's leadership swim, skin and scuba skills as separate rows, a prerequisite checklist (age 18, 60 dives / 30 hours, certifications, leadership CPR, medical approval, gear), five self-paced phases, an activity log, and the Divemaster proposal.
- **Proposal:** a print-ready proposal for each student, filled in with their name, dates, matrix results and fees. Use **Print / save as PDF**.
- **Scheduling (Business → Scheduling, Instructors and Admins):** put a student on a class, event, tour or coaching session and make their learning agreement on the same screen. Pick the student (from Students, or a Student portal account, which adds them to Students), then pick any Calendar entry or a Coaching and tours listing (give those a date, time, location and fee here). Scheduling a student on a Class also enrolls them, like Enroll on the Calendar. **Make agreement** fills in the best template for that event (one for that course, then that kind of event, then "Anything") with the student's details, the event and the course standards. The class template follows the Open Water proposal and takes each course's wording from its Settings, so it works for every course. Edit the text for one student, then **Print / save as PDF**; signature lines for the student, a parent or guardian (under 18) and the instructor are added. **Agreement templates** lets you edit, add, duplicate or load templates from a text file, with a list of the `{{placeholders}}` you can use. Schedules and templates are kept in this browser like invoices; no database change is needed.
- **Invoices:** build invoices in the J Lichner Dive Invoice layout. Start blank or from a student's record (name, contact, course fee, extra charges and payments received), edit every field, add saved items like TDI eLearning, mark paid, and print or save as PDF. **Invoice settings** holds the header, numbering, payment terms and saved items.
- **Program settings:** change the price, deposit %, contact details, program structure and all of the proposal text.

## Student accounts

Students can create their own account at `account.html` (the **Student portal** button links to it). On their account page they add a **profile photo** and keep their **name, mailing address (street, city, state, zip), phone number, emergency contact (with phone) and current certifications** up to date, see the training progress you share with them, and see upcoming classes, with the ones they're enrolled in marked.

Staff use the **Admin Log in** button in the header (next to the dive flag). Instructors and Admins sign in there to:

- see every student account and **link** it to a student in your Students list (or add them as a new student). Linking copies their details in.
- **Share progress**: each linked student sees their course dates, skills mastered, dives logged and balance due. Medical notes, your notes and other students are never sent.

**Four levels of access**, enforced by row-level security in the database (`supabase/schema.sql`), not just on screen:

| Level | Can |
| --- | --- |
| **Student** (everyone who signs up) | See and edit only their own details; see only their own progress; see the class calendar. |
| **Dive Master** | Also see every student's contact, emergency contact, certifications and progress (read only). |
| **Instructor** | Also edit student details, link accounts, share progress and publish the class calendar. |
| **Admin** | Also give and remove staff roles (**Admin Log in → Staff and roles**). |

Nobody can raise their own level from the website, and an Admin can't change their own role (another Admin has to).

Your course records, invoices and settings in this app still live only in the browser you use them in, so they aren't behind a login. Only the online data (accounts, shared progress, the online calendar) is.

### Turning on student accounts (one time, about 15 minutes)

1. **Create a Supabase project.** Go to [supabase.com/dashboard](https://supabase.com/dashboard), sign in (GitHub sign-in is fine), and click **New project**. Name it `limitless-diving`, choose a database password (save it somewhere safe), pick the region closest to you, and click **Create**. The free plan is enough.
2. **Create the tables.** In the project, open **SQL Editor** in the left menu, click **New query**, paste everything from [`supabase/schema.sql`](supabase/schema.sql), and click **Run**. You should see "Success".
3. **Point sign-in emails at your site.** Open **Authentication → URL Configuration**. Set **Site URL** to `https://limitless-diving.com/account.html`, and under **Redirect URLs** add `https://limitless-diving.com/**` and `https://www.limitless-diving.com/**`. This is where the "confirm your email" and "reset password" links send students.
4. **Connect the website.** Open **Project Settings → API Keys** and copy the **Publishable key**, then **Project Settings → Data API** and copy the **Project URL**. In this repository, edit [`supabase-config.js`](supabase-config.js) on GitHub (pencil icon), paste both between the quotes, and commit. These two values are meant to be public; the security rules protect the data. Never paste the **secret** (service role) key anywhere in this site.
5. **Make yourself the Admin.** Open `account.html` on your site and create an account with your own email (confirm it from your inbox). Then in the **SQL Editor**, run (with your email):

   ```sql
   insert into public.staff_roles (user_id, role)
   select id, 'admin' from auth.users where email = 'you@example.com'
   on conflict (user_id) do update set role = 'admin';
   ```

6. In the app, click **Admin Log in** and sign in with that account. Give Dive Masters and Instructors their roles under **Staff and roles** (they sign up as students first). Send students the link shown there.

Supabase sends the sign-up and password emails itself. Its built-in email is limited to a few emails an hour, which is fine to start. If many students sign up at once, add your own email sender under **Authentication → Emails → SMTP Settings**.

### Updating the database after an app update

When an update changes `supabase/schema.sql` (for example, the split mailing address and profile photos), copy the whole file into **SQL Editor → New query** again and click **Run**. It's safe to run any number of times and keeps existing accounts and data.

Profile photos are kept in a private storage bucket called `avatars`, which the schema creates. Students can only add, change or remove their own photo, and only staff (Dive Master and up) can see other people's photos. Photos are cropped square and shrunk to 512px before upload.

### The class calendar, online

Once you're signed in as the instructor, **Publish calendar…** shows **Publish online now**. It updates the public page right away, with no `classes.json` to upload. The public page reads the online calendar once you've published there, and uses `classes.json` until then.

## Where data is stored

Your records (students, courses, invoices, classes) are saved in the browser you use (localStorage). Nothing is sent to a server, except what students enter in their own accounts and what you choose to share or publish online (see Student accounts above). To back up or move your data to another computer, use **Export backup** and **Import**.

## Publishing classes

The instructor app saves everything in your browser, so publishing works through one file, `classes.json`, which the public page reads:

1. In **Calendar**, open each class you want to show and tick **Show on the public calendar**.
2. Click **Publish calendar…**, check the list, and click **Download classes.json**.
3. Upload that file to this repository ([Upload files](https://github.com/jlichner/limitless-diving-forms/upload/main)), replacing the old one, and commit.
4. In about a minute it's live at `https://limitless-diving.com/classes.html`.

Republish whenever classes change or students enroll, so the open seats stay current. Classes drop off the public page by themselves once their last date has passed. The file holds only class details and the contact info set on the Publish page.

## Running it

It's a static site with no build step. Open `index.html` in a browser, or publish it with GitHub Pages:

1. Go to **Settings → Pages** in this repository.
2. Under **Build and deployment**, choose **Deploy from a branch**, then pick `main` and `/ (root)`.
3. Save. The site will be at `https://jlichner.github.io/limitless-diving-forms/`.
4. **Custom domain (limitless-diving.com, registered at IONOS).** In IONOS DNS, add four **A** records for `@` pointing to `185.199.108.153`, `185.199.109.153`, `185.199.110.153` and `185.199.111.153`, and a **CNAME** for `www` pointing to `jlichner.github.io`. Leave the Resend email records (`resend._domainkey`, `send`, `_dmarc`) alone. Then in **Settings → Pages**, enter `limitless-diving.com` as the custom domain, save, and tick **Enforce HTTPS** once it's offered. The old github.io address forwards to the new one automatically.

Note: if this repository is public, anyone can see the code and the default contact details in `app.js`. Student data is never in the repository.

## Adding a course

The course list lives in `catalog.js` (one line per course: agency, name, and the standards). Add a course there and it shows up on **All courses**, in the calendar and in the enroll pickers right away. To give a catalog course a full skill matrix, register it as below with the same `id`.

Courses live in a registry in `app.js`. Rescue Diver and Divemaster are added this way in `courses.js`. To add one, load a script after `app.js` that calls:

```js
LD.registerCourse({
  id: "rescue", name: "Rescue", fullName: "NAUI Rescue Scuba Diver",
  skills: [["Domain", "Required performance objective"], ...],
  final: [["Domain", "Objective"], ...], finalTitle: "Final Evaluation",
  schedule: ["Day 1 — ...", "Day 2 — ..."], dives: 2, siteLabel: "Open water site",
  defaults: { /* proposal settings, same keys as Open Water's */ }
});
```

The course gets its own tab, roster, records, settings (`state.programs[id]`) and proposal. Students enroll from the Students tab.

Optional fields (defaults in `registerCourse`): `cols` (`"three"` for Confined / Open water / Pass, or `"two"` for a status column then M), `colLabels`, `key`, `skillHint`, `unit` and `structCols` (Day or Phase), `prereqs` (a per-student checklist: `{ k, label, detail, type }`), `diveTab`, `diveTitle`, `alwaysRecords` and the roster depth scale (`midDepth`, `maxDepth`). Proposal settings can also include `schedule`, `hours`, `location`, `payment`, `paymentUrl`, `feeLabel`, `depositPurpose`, `balanceDue`, `logisticsTitle`, `logistics`, `logisticsCallout`, `logisticsLink`, `prereqs`, `topics`, `matrixTitle`, `matrixIntro` and `costRows`; empty ones are left out of the proposal. A day's `date` fills that date in for each new enrollment.

## Data shape (localStorage key `limitless-ow-v1`)

- `students`: the shared student list (`id, name, email, phone, dob, address, emergencyName, emergencyPhone, emergencyRel, medical, certs, notes, accountId`). `certs` is a list of `{ agency, level, number, date }`, the same shape as a student account's certifications; older backups with a single `certAgency / certLevel / certNumber` are converted on load. `accountId` links a student to their online account.
- `enrollments`: one per student per course (`id, studentId, course, dates, location, notes, skills, final, dives, remed, pay, ack`).
- `program`: Open Water settings. `programs[courseId]`: settings for the other courses.
- `classes`: calendar classes (`id, course, title, dates[], time, location, price, seats, notes, published`). An enrollment's `classId` links it to its class.
- `calendarSettings`: the public page's heading, introduction and contact details.
- `invoices`, `invoiceSettings`: invoices.

Backups from the first version are converted automatically on import.
