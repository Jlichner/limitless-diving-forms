// Limitless Diving: tell the instructor when someone joins an event or signs up for a class on an event's
// information page (event.html), or asks for a class on Request a class (request.html).
// Supabase Edge Function "notify-signup". Body: { id } for a sign-up, or { request: id } for a request.
//
// event.js calls it right after the sign-up is saved, as the member who signed up. It asks the database
// (claim_signup_notice in supabase/schema.sql) for that sign-up; the database answers only once, only for
// the caller's own sign-up from the last 15 minutes, so the function can't be used to send repeat alerts.
//
// Where the alert goes, set in Supabase → Edge Functions → Secrets:
//   RESEND_API_KEY      already set for "send-email". Used for the email alert.
//   NOTIFY_EMAIL        the address that gets the email alert (default jamie@limitless-diving.com).
//                       Several addresses can be separated with commas, e.g. your email plus your
//                       carrier's email-to-text address (Verizon 5551234567@vtext.com, T-Mobile
//                       5551234567@tmomail.net; AT&T closed theirs in 2025). Set it to "off" for none.
//   FROM_EMAIL          optional, as for send-email.
// WhatsApp messages through CallMeBot (free; see https://www.callmebot.com/blog/free-api-whatsapp-messages/):
//   WHATSAPP_PHONE      your WhatsApp number with country code, like +15557654321
//   WHATSAPP_APIKEY     the key CallMeBot sent you on WhatsApp
// Telegram messages (free, from your own bot):
//   TELEGRAM_BOT_TOKEN  the token @BotFather gave you when you made your bot
//   TELEGRAM_CHAT_ID    your Telegram user id (message @userinfobot to see it). Send your bot "hi" once first.
// Text messages (optional, add these once your Twilio number is approved for texting):
//   TWILIO_ACCOUNT_SID  from the Twilio console (starts with AC…)
//   TWILIO_AUTH_TOKEN   from the Twilio console
//   TWILIO_FROM         your Twilio phone number, like +15551234567
//   NOTIFY_PHONE        your mobile number, like +15557654321
//
// This file has no imports, so it can be pasted straight into the Supabase dashboard editor.
// Turn "Verify JWT" OFF for this function: it checks the sign-in itself below.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const SITE = "https://limitless-diving.com";

function reply(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}
function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
// "Dec 12 – 13" style dates from "YYYY-MM-DD" strings.
function when(dates: string[]) {
  const ds = (dates || []).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  if (!ds.length) return "";
  const f = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return ds.length === 1 ? f(ds[0]) : f(ds[0]) + " – " + f(ds[ds.length - 1]);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return reply(405, { error: "Use POST." });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
  const auth = req.headers.get("Authorization") || "";
  const apikey = req.headers.get("apikey") || Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (!/^Bearer\s+\S+/.test(auth)) return reply(401, { error: "Please sign in first." });
  let body: { id?: unknown; request?: unknown };
  try { body = await req.json(); } catch { return reply(400, { error: "The request wasn't readable." }); }
  const isRequest = !!body.request;
  const id = String(body.request || body.id || "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return reply(400, { error: "Which sign-up?" });

  // Ask the database, as the member, for their new sign-up or request (once only).
  const claim = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${isRequest ? "claim_request_notice" : "claim_signup_notice"}`, {
    method: "POST", headers: { apikey, Authorization: auth, "Content-Type": "application/json" }, body: JSON.stringify({ p_id: id }),
  });
  if (!claim.ok) { console.error("claim_signup_notice", claim.status, await claim.text()); return reply(502, { error: "Couldn't read the sign-up." }); }
  const s = await claim.json();
  if (!s) return reply(200, { sent: false, reason: "Already sent, or not your sign-up." });

  const name = String(s.name || s.email || "Someone");
  const title = String(s.title || "an event");
  const dates = when(Array.isArray(s.dates) ? s.dates : []);
  const verb = s.kind === "request" ? "asked for a class:" : s.kind === "class" ? "signed up for" : "joined";
  const line = s.kind === "request"
    ? `${name} asked for a class: ${title}${dates ? " on " + (Array.isArray(s.dates) ? s.dates.length + " day" + (s.dates.length === 1 ? "" : "s") + ", " : "") + dates : ""}.`
    : `${name} ${verb} ${title}${dates ? " (" + dates + ")" : ""}.`;
  const contact = [s.email, s.phone].filter(Boolean).join(" · ");
  const next = s.kind === "request" ? "Schedule or decline it under Class requests on the Calendar."
    : s.kind === "class" ? "Schedule them from Website sign-ups on the Calendar." : "They're on the list.";
  const results: Record<string, unknown> = {};

  // Email alert.
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
  const TO = Deno.env.get("NOTIFY_EMAIL") || "jamie@limitless-diving.com";
  const toList = TO.split(",").map((x) => x.trim()).filter((x) => /^[^\s@<>",;]+@[^\s@<>",;]+\.[^\s@<>",;]+$/.test(x));
  const FROM = Deno.env.get("FROM_EMAIL") || "Jamie at Limitless Diving <jamie@limitless-diving.com>";
  if (RESEND_API_KEY && toList.length) {
    const text = [line, contact, s.notes ? `Their note: "${s.notes}"` : "", next, `${SITE}/index.html#staff`].filter(Boolean).join("\n\n");
    const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#0c2233">` +
      [line, contact, s.notes ? `Their note: “${s.notes}”` : "", next].filter(Boolean).map((p) => `<p style="margin:0 0 12px">${escapeHtml(String(p))}</p>`).join("") +
      `<p style="margin:0"><a href="${SITE}/index.html#staff">Open the Calendar</a>${s.class_id ? ` · <a href="${SITE}/event.html?id=${encodeURIComponent(String(s.class_id))}">See the event page</a>` : ""}</p></div>`;
    const subject = (s.kind === "request" ? "New class request: " : s.kind === "class" ? "New class sign-up: " : "New sign-up: ") + name + " · " + title;
    // Phone email-to-text addresses get a short plain message; everyone else the full email.
    const isPhone = (a: string) => /@(vtext|vzwpix|tmomail|messaging\.sprintpcs|mms\.att|txt\.att|msg\.fi\.google|email\.uscc|sms\.myboostmobile|mymetropcs|text\.republicwireless)\./i.test(a) || /^\+?\d{10,11}@/.test(a);
    const batch = toList.map((addr) => isPhone(addr)
      ? { from: FROM, to: [addr], subject: "New sign-up", text: `${line}${s.phone ? " " + s.phone : ""}`.slice(0, 300) }
      : { from: FROM, to: [addr], reply_to: s.email || undefined, subject, text, html });
    const r = await fetch("https://api.resend.com/emails/batch", {
      method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(batch),
    });
    results.email = r.ok;
    if (!r.ok) console.error("Resend error", r.status, await r.text());
  }

  // WhatsApp message, once CallMeBot is set up.
  const WA_PHONE = Deno.env.get("WHATSAPP_PHONE") || "", WA_KEY = Deno.env.get("WHATSAPP_APIKEY") || "";
  if (WA_PHONE && WA_KEY) {
    const msg = [`🤿 Limitless Diving: ${line}`, contact, s.notes ? `Note: "${String(s.notes).slice(0, 300)}"` : "", next, `${SITE}/index.html#staff`].filter(Boolean).join("\n");
    const r = await fetch("https://api.callmebot.com/whatsapp.php?" + new URLSearchParams({ phone: WA_PHONE, text: msg, apikey: WA_KEY }));
    const t = await r.text();
    // CallMeBot answers 200 even for some problems; its page says "Message queued" when it worked.
    results.whatsapp = r.ok && !/error|invalid|not\s+valid/i.test(t);
    if (!results.whatsapp) console.error("CallMeBot", r.status, t.slice(0, 500));
  }

  // Telegram message, once a bot is set up.
  const TG_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") || "", TG_CHAT = Deno.env.get("TELEGRAM_CHAT_ID") || "";
  if (TG_TOKEN && TG_CHAT) {
    const msg = [`🤿 ${line}`, contact, s.notes ? `Note: "${String(s.notes).slice(0, 500)}"` : "", next, `${SITE}/index.html#staff`].filter(Boolean).join("\n");
    const r = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: TG_CHAT, text: msg, disable_web_page_preview: true }),
    });
    results.telegram = r.ok;
    if (!r.ok) console.error("Telegram error", r.status, await r.text());
  }

  // Text message, once Twilio is set up.
  const SID = Deno.env.get("TWILIO_ACCOUNT_SID") || "", TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") || "";
  const FROM_PHONE = Deno.env.get("TWILIO_FROM") || "", TO_PHONE = Deno.env.get("NOTIFY_PHONE") || "";
  if (SID && TOKEN && FROM_PHONE && TO_PHONE) {
    const sms = `Limitless Diving: ${line}${s.phone ? " " + s.phone : ""}`.slice(0, 300);
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${SID}/Messages.json`, {
      method: "POST",
      headers: { Authorization: "Basic " + btoa(`${SID}:${TOKEN}`), "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ From: FROM_PHONE, To: TO_PHONE, Body: sms }),
    });
    results.text = r.ok;
    if (!r.ok) console.error("Twilio error", r.status, await r.text());
  }

  return reply(200, { sent: true, ...results });
});
