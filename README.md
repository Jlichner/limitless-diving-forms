# Limitless Diving Forms

A web app for Limitless Diving & Technical Training's Open Water Diver + Nitrox course. It turns the Open Water course proposal into editable student records.

## What it does

- **Student records:** details, training dates, open water site and instructor notes.
- **Required skill matrix:** all 30 NAUI Open Water skills, with Confined and Open Water status (IP / PR / R), Pass, and initials.
- **Final evaluation:** the 9 emergency and final performance skills, with status, date and initials.
- **Dive log:** four open water dives (date, site, depth, duration, gas, notes, initials).
- **Remediation plan:** add as many corrective-plan items as you need.
- **Payment:** deposit and balance tracking, extra training charges, and the balance due.
- **Sign-off:** the student acknowledgment, with signature dates.
- **Proposal:** a print-ready proposal for each student, filled in with their name, dates, matrix results and fees. Use **Print / save as PDF**.
- **Program settings:** change the price, deposit %, contact details, program structure and all of the proposal text.

## Where data is stored

Everything is saved in the browser you use (localStorage). Nothing is sent to a server. To back up or move your data to another computer, use **Export backup** and **Import**.

## Running it

It's a static site with no build step. Open `index.html` in a browser, or publish it with GitHub Pages:

1. Go to **Settings → Pages** in this repository.
2. Under **Build and deployment**, choose **Deploy from a branch**, then pick `main` and `/ (root)`.
3. Save. The site will be at `https://jlichner.github.io/limitless-diving-forms/`.

Note: if this repository is public, anyone can see the code and the default contact details in `app.js`. Student data is never in the repository.
