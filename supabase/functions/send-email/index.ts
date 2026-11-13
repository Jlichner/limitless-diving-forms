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

const EMAIL_RE = /^[^\s@<>",;]+@[^\s@<>",;]+\.[^\s@<>",;]+$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
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
  let body: { to?: unknown; subject?: unknown; message?: unknown; copyMe?: unknown };
  try { body = await req.json(); } catch { return reply(400, { error: "The request wasn't readable." }); }
  const subject = String(body.subject || "").trim().slice(0, 200);
  const message = String(body.message || "").trim().slice(0, 20000);
  const seen = new Set<string>();
  const to = (Array.isArray(body.to) ? body.to : [])
    .map((x) => String(x || "").trim())
    .filter((e) => EMAIL_RE.test(e) && !seen.has(e.toLowerCase()) && seen.add(e.toLowerCase()));
  if (!to.length) return reply(400, { error: "Add at least one email address." });
  if (to.length > MAX_RECIPIENTS) return reply(400, { error: `That's ${to.length} people. Send to ${MAX_RECIPIENTS} or fewer at a time.` });
  if (!subject) return reply(400, { error: "Add a subject." });
  if (!message) return reply(400, { error: "Write a message." });
  const copyTo = body.copyMe && user.email && !seen.has(String(user.email).toLowerCase()) ? [String(user.email)] : [];
  const all = to.concat(copyTo);

  // Stay inside the daily allowance (counted from the email log, if the table exists).
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const logRes = await fetch(`${SUPABASE_URL}/rest/v1/email_log?select=recipients&created_at=gte.${encodeURIComponent(since)}`, { headers: asUser });
  const logOn = logRes.ok;
  if (logOn) {
    const rows: { recipients: number }[] = await logRes.json();
    const used = rows.reduce((n, r) => n + (r.recipients || 0), 0);
    if (used + all.length > DAILY_LIMIT) {
      return reply(429, { error: `That would go over today's limit of ${DAILY_LIMIT} emails (${used} sent in the last 24 hours). Try again tomorrow, or send to fewer people.` });
    }
  }

  // One email per person, sent together in one batch.
  const html = toHtml(message);
  const batch = all.map((addr) => ({ from: FROM, to: [addr], reply_to: REPLY_TO, subject, text: message, html }));
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
      body: JSON.stringify({ recipients: all.length, subject }),
    }).catch((e) => console.error("Couldn't write the email log", e));
  }

  return reply(200, { sent: to.length, copy: copyTo.length > 0, replyTo: REPLY_TO });
});
