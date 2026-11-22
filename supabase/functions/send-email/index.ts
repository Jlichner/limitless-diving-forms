// Limitless Diving: send an email to students from the website (Supabase Edge Function "send-email").
//
// Only signed-in Instructors and Admins can use it. Each student gets their own copy, so nobody sees
// anyone else's address. Emails go out through Resend from the address in FROM_EMAIL, and replies go
// to REPLY_TO.
//
// Secrets (Supabase → Edge Functions → Secrets):
//   RESEND_API_KEY  required. A Resend API key with "Sending access" (never put it in the website code).
//   FROM_EMAIL      optional. Default: Jamie at Limitless Diving <jamie@limitless-diving.com>
//   REPLY_TO        optional. Default: jamie@limitless-diving.com
//
//   SITE_URL        optional. Default: https://limitless-diving.com (for the unsubscribe page)
//
// Two kinds of send:
//   • Personal (default): { to: [emails], subject, message, copyMe } from a compose box. Not changed by opting out.
//   • Group email ("promo": true): { promo: true, ids: [account ids], subject, message, copyMe } from Business →
//     Email groups. The database (promo_recipients) leaves out anyone who opted out, and every copy ends with that
//     person's own unsubscribe link, plus the List-Unsubscribe header so Gmail and others show an Unsubscribe button.
//     "{name}" in the message becomes each person's first name. If the daily limit runs out part way, it sends what
//     fits and answers with the ids still to go (notSent), so the page can send the rest tomorrow.
//   • Unsubscribe: GET or POST to this function's address with ?unsubscribe=<token> (the link in the email).
//
// This file has no imports, so it can be pasted straight into the Supabase dashboard editor.
// Turn "Verify JWT" OFF for this function: it checks the sign-in and the staff level itself below.

const MAX_RECIPIENTS = 50;   // per send
const DAILY_LIMIT = 100;     // Resend's free plan allows 100 emails a day

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function reply(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

// Plain text message → simple HTML: paragraphs, line breaks and clickable links.
function toHtml(text: string) {
  const linked = (s: string) => escapeHtml(s).replace(/https?:\/\/[^\s<]+/g, (u) => `<a href="${u}">${u}</a>`);
  const paras = text.split(/\n{2,}/).map((p) => `<p style="margin:0 0 14px">${linked(p).replace(/\n/g, "<br>")}</p>`).join("");
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#0c2233">${paras}</div>`;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The unsubscribe link in a group email. A POST is the email app's one-click button (RFC 8058); a GET is
// someone clicking the link, sent on to the website's unsubscribe page, which confirms it.
async function unsubscribe(req: Request, token: string) {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
  const SITE = (Deno.env.get("SITE_URL") || "https://limitless-diving.com").replace(/\/+$/, "");
  if (!UUID_RE.test(token)) return new Response("That unsubscribe link isn't complete.", { status: 400 });
  if (req.method === "GET") return Response.redirect(`${SITE}/unsubscribe.html?t=${encodeURIComponent(token)}`, 302);
  const anon = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/email_unsubscribe`, {
    method: "POST", headers: { apikey: anon, Authorization: `Bearer ${anon}`, "Content-Type": "application/json" },
    body: JSON.stringify({ t: token }),
  });
  if (!r.ok) { console.error("Unsubscribe failed", r.status, await r.text()); return new Response("Couldn't unsubscribe right now.", { status: 500 }); }
  return new Response("You're unsubscribed from Limitless Diving group emails.", { status: 200, headers: { "Content-Type": "text/plain" } });
}

const firstName = (n: string) => String(n || "").trim().split(/\s+/)[0] || "there";

const EMAIL_RE = /^[^\s@<>",;]+@[^\s@<>",;]+\.[^\s@<>",;]+$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const unsub = new URL(req.url).searchParams.get("unsubscribe");
  if (unsub !== null) return unsubscribe(req, unsub);
  if (req.method !== "POST") return reply(405, { error: "Use POST." });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
  const FROM = Deno.env.get("FROM_EMAIL") || "Jamie at Limitless Diving <jamie@limitless-diving.com>";
  const REPLY_TO = Deno.env.get("REPLY_TO") || "jamie@limitless-diving.com";
  if (!RESEND_API_KEY) return reply(500, { error: "Email isn't set up yet: the RESEND_API_KEY secret is missing in Supabase." });

  // Who is asking? Check the sign-in with Supabase, then their level, using their own login.
  const auth = req.headers.get("Authorization") || "";
  const apikey = req.headers.get("apikey") || Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (!/^Bearer\s+\S+/.test(auth)) return reply(401, { error: "Please sign in first." });
  const asUser = { apikey, Authorization: auth, "Content-Type": "application/json" };

  const who = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: asUser });
  if (!who.ok) return reply(401, { error: "Your sign-in has expired. Sign out, sign in again, and retry." });
  const user = await who.json();

  const roleRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/my_role`, { method: "POST", headers: asUser, body: "{}" });
  const role = roleRes.ok ? await roleRes.json() : "student";
  if (role !== "instructor" && role !== "admin") return reply(403, { error: "Only Instructors and Admins can send email from the site." });

  // What to send.
  let body: { to?: unknown; ids?: unknown; promo?: unknown; subject?: unknown; message?: unknown; copyMe?: unknown };
  try { body = await req.json(); } catch { return reply(400, { error: "The request wasn't readable." }); }
  const promo = body.promo === true;
  const subject = String(body.subject || "").trim().slice(0, 200);
  const message = String(body.message || "").trim().slice(0, 20000);
  if (!subject) return reply(400, { error: "Add a subject." });
  if (!message) return reply(400, { error: "Write a message." });
  const myEmail = String(user.email || "");

  // Who it goes to: { email, name, token } each. A group email asks the database, which drops anyone who opted out.
  type Person = { email: string; name: string; token: string; id: string };
  let people: Person[] = [];
  let asked = 0;
  if (promo) {
    const ids = [...new Set((Array.isArray(body.ids) ? body.ids : []).map((x) => String(x || "")).filter((x) => UUID_RE.test(x)))];
    asked = ids.length;
    if (!ids.length) return reply(400, { error: "Pick at least one person." });
    if (ids.length > MAX_RECIPIENTS) return reply(400, { error: `That's ${ids.length} people. Send to ${MAX_RECIPIENTS} or fewer at a time.` });
    const pr = await fetch(`${SUPABASE_URL}/rest/v1/rpc/promo_recipients`, { method: "POST", headers: asUser, body: JSON.stringify({ ids }) });
    if (!pr.ok) {
      console.error("promo_recipients", pr.status, await pr.text());
      return reply(500, { error: "The list of people couldn't be read. Has the latest schema.sql been run in Supabase?" });
    }
    const rows: { id: string; email: string; full_name: string; token: string }[] = await pr.json();
    const seenP = new Set<string>();
    people = rows.filter((r) => EMAIL_RE.test(r.email || "") && !seenP.has(r.email.toLowerCase()) && seenP.add(r.email.toLowerCase()))
      .map((r) => ({ email: r.email, name: r.full_name || "", token: r.token, id: r.id }));
  } else {
    const seen = new Set<string>();
    const to = (Array.isArray(body.to) ? body.to : [])
      .map((x) => String(x || "").trim())
      .filter((e) => EMAIL_RE.test(e) && !seen.has(e.toLowerCase()) && seen.add(e.toLowerCase()));
    if (!to.length) return reply(400, { error: "Add at least one email address." });
    if (to.length > MAX_RECIPIENTS) return reply(400, { error: `That's ${to.length} people. Send to ${MAX_RECIPIENTS} or fewer at a time.` });
    people = to.map((e) => ({ email: e, name: "", token: "", id: "" }));
    asked = to.length;
  }
  const skipped = promo ? asked - people.length : 0;   // opted out, email not confirmed, or deactivated
  const inList = people.some((p) => p.email.toLowerCase() === myEmail.toLowerCase());
  let wantCopy = !!body.copyMe && EMAIL_RE.test(myEmail) && !inList;

  // Stay inside the daily allowance (counted from the email log, if the table exists).
  let room = Infinity;
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const logRes = await fetch(`${SUPABASE_URL}/rest/v1/email_log?select=recipients,created_at&created_at=gte.${encodeURIComponent(since)}&order=created_at.asc`, { headers: asUser });
  const logOn = logRes.ok;
  let resetAt = "";
  if (logOn) {
    const rows: { recipients: number; created_at: string }[] = await logRes.json();
    const used = rows.reduce((n, r) => n + (r.recipients || 0), 0);
    room = Math.max(0, DAILY_LIMIT - used);
    if (rows.length) resetAt = new Date(new Date(rows[0].created_at).getTime() + 24 * 3600 * 1000).toISOString();
    if (!promo && used + people.length + (wantCopy ? 1 : 0) > DAILY_LIMIT) {
      return reply(429, { error: `That would go over today's limit of ${DAILY_LIMIT} emails (${used} sent in the last 24 hours). Try again tomorrow, or send to fewer people.` });
    }
  }
  // A group email sends what fits today; the rest come back as notSent.
  let notSent: string[] = [];
  if (promo && people.length > room) {
    notSent = people.slice(room).map((p) => p.id);
    people = people.slice(0, room);
    wantCopy = false;
  }
  if (promo && wantCopy && people.length + 1 > room) wantCopy = false;
  if (promo && !people.length) {
    if (notSent.length) return reply(200, { sent: 0, skipped, notSent, limit: true, resetAt, replyTo: REPLY_TO });
    return reply(200, { sent: 0, skipped, notSent: [], replyTo: REPLY_TO });
  }

  // One email per person, sent together in one batch.
  const fnUrl = `${SUPABASE_URL}/functions/v1/send-email`;
  const SITE = (Deno.env.get("SITE_URL") || "https://limitless-diving.com").replace(/\/+$/, "");
  const personal = (text: string, name: string) => promo ? text.replace(/\{name\}/gi, name) : text;
  const batch = people.map((p) => {
    const text = personal(message, firstName(p.name));
    if (!promo) return { from: FROM, to: [p.email], reply_to: REPLY_TO, subject, text, html: toHtml(text) };
    const page = `${SITE}/unsubscribe.html?t=${p.token}`;
    const footText = `\n\n--\nYou're getting this because you have a Limitless Diving account. Don't want emails about trips, new classes and news? Unsubscribe: ${page}\nYou'll still get emails about your own classes and agreements.`;
    const footHtml = `<p style="margin:24px 0 0;padding-top:12px;border-top:1px solid #d5dde3;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#5b6b78">You're getting this because you have a Limitless Diving account. Don't want emails about trips, new classes and news? <a href="${page}" style="color:#5b6b78">Unsubscribe</a>. You'll still get emails about your own classes and agreements.</p>`;
    return {
      from: FROM, to: [p.email], reply_to: REPLY_TO, subject, text: text + footText, html: toHtml(text) + footHtml,
      headers: {
        "List-Unsubscribe": `<${fnUrl}?unsubscribe=${p.token}>, <mailto:${REPLY_TO}?subject=Unsubscribe>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    };
  });
  if (wantCopy) {
    const text = personal(message, firstName(String((user.user_metadata && user.user_metadata.full_name) || "")));
    const note = promo ? "\n\n--\n(Your copy. Each person's email ends with their own unsubscribe link.)" : "";
    batch.push({ from: FROM, to: [myEmail], reply_to: REPLY_TO, subject, text: text + note, html: toHtml(text + note) } as typeof batch[number]);
  }
  const sent = await fetch("https://api.resend.com/emails/batch", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(batch),
  });
  if (!sent.ok) {
    const detail = await sent.text();
    console.error("Resend error", sent.status, detail);
    let msg = "";
    try { msg = JSON.parse(detail).message || ""; } catch { /* not JSON */ }
    return reply(502, { error: "The email service didn't accept it" + (msg ? ": " + msg : ".") });
  }

  if (logOn) {
    await fetch(`${SUPABASE_URL}/rest/v1/email_log`, {
      method: "POST", headers: { ...asUser, Prefer: "return=minimal" },
      body: JSON.stringify({ recipients: batch.length, subject }),
    }).catch((e) => console.error("Couldn't write the email log", e));
  }

  return reply(200, { sent: people.length, copy: wantCopy, replyTo: REPLY_TO, skipped, notSent, limit: notSent.length > 0, resetAt });
});
