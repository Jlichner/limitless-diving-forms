# Limitless Diving Forms

A web app for Limitless Diving & Technical Training's Open Water Diver + Nitrox course. It turns the Open Water course proposal into editable student records.

## What it does

- **Students:** one shared student list for every course: contact info, date of birth, address, emergency contact, medical notes, current certification, and the courses each student is in.

- **Open Water records:** each enrollment links to a student and holds the training dates, open water site and notes. A course-profile tracker and gauges show progress at a glance.
- **Required skill matrix:** the NAUI Open Water skills (checked against the 2026 NAUI Standards), with Confined and Open Water status (IP / PR / R), Pass, and initials.
- **Final evaluation:** the 8 emergency and final performance skills, with status, date and initials.
- **Dive log:** four open water dives (date, site, depth, duration, gas, notes, initials).
- **Remediation plan:** add as many corrective-plan items as you need.
- **Payment:** deposit and balance tracking, extra training charges, and the balance due.
- **Sign-off:** the student acknowledgment, with signature dates.
- **Proposal:** a print-ready proposal for each student, filled in with their name, dates, matrix results and fees. Use **Print / save as PDF**.
- **Invoices:** build invoices in the J Lichner Dive Invoice layout. Start blank or from a student's record (name, contact, course fee, extra charges and payments received), edit every field, add saved items like TDI eLearning, mark paid, and print or save as PDF. **Invoice settings** holds the header, numbering, payment terms and saved items.
- **Program settings:** change the price, deposit %, contact details, program structure and all of the proposal text.

## Where data is stored

Everything is saved in the browser you use (localStorage). Nothing is sent to a server. To back up or move your data to another computer, use **Export backup** and **Import**.

## Running it

It's a static site with no build step. Open `index.html` in a browser, or publish it with GitHub Pages:

1. Go to **Settings → Pages** in this repository.
2. Under **Build and deployment**, choose **Deploy from a branch**, then pick `main` and `/ (root)`.
3. Save. The site will be at `https://jlichner.github.io/limitless-diving-forms/`.

Note: if this repository is public, anyone can see the code and the default contact details in `app.js`. Student data is never in the repository.

## Adding a course

Courses live in a registry in `app.js`. To add one, load a script after `app.js` that calls:

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

## Data shape (localStorage key `limitless-ow-v1`)

- `students`: the shared student list (`id, name, email, phone, dob, address, emergencyName, emergencyPhone, emergencyRel, medical, certAgency, certLevel, certNumber, notes`).
- `enrollments`: one per student per course (`id, studentId, course, dates, location, notes, skills, final, dives, remed, pay, ack`).
- `program`: Open Water settings. `programs[courseId]`: settings for the other courses.
- `invoices`, `invoiceSettings`: invoices.

Backups from the first version are converted automatically on import.
