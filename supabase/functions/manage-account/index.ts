// Limitless Diving: deactivate, reactivate or delete a member's account (Supabase Edge Function "manage-account").
//
// Used by the Deactivate / Reactivate / Delete buttons in Records → Student accounts. Only signed-in Admins
// can use it, and never on their own account.
//
//   deactivate  The account is switched off: they can't sign in, and any sign-in they still have stops working
//               within the hour (when it next renews). Everything they have on the site is kept.
//   reactivate  Switches the account back on. They sign in with the same email and password as before.
//   delete      Removes the account for good, with everything tied to it: profile, photo, course progress,
//               learning agreements, sign-ups, class requests, dive log, dive sites and site map photos.
//               This can't be undone.
//
// It needs the service role key, which Supabase gives every Edge Function by itself (SUPABASE_SERVICE_ROLE_KEY).
// Nothing to add under Secrets.
//
// This file has no imports, so it can be pasted straight into the Supabase dashboard editor.
// Turn "Verify JWT" OFF for this function: it checks the sign-in and the Admin level itself below.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function reply(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

// About 100 years: Supabase's way of saying "until someone switches it back on".
const FOREVER = "876000h";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return reply(405, { error: "Use POST." });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
  const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!KEY) return reply(500, { error: "The function can't find SUPABASE_SERVICE_ROLE_KEY." });

  // Who is asking? Check the sign-in with Supabase, then their level, using their own login.
  const auth = req.headers.get("Authorization") || "";
  const apikey = req.headers.get("apikey") || Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (!/^Bearer\s+\S+/.test(auth)) return reply(401, { error: "Please sign in first." });
  const asUser = { apikey, Authorization: auth, "Content-Type": "application/json" };

  const who = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: asUser });
  if (!who.ok) return reply(401, { error: "Your sign-in has expired. Sign out, sign in again, and retry." });
  const me = await who.json();

  const roleRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/my_role`, { method: "POST", headers: asUser, body: "{}" });
  const role = roleRes.ok ? await roleRes.json() : "student";
  if (role !== "admin") return reply(403, { error: "Only Admins can deactivate or delete accounts." });

  let body: { action?: unknown; member?: unknown };
  try { body = await req.json(); } catch { return reply(400, { error: "The request wasn't readable." }); }
  const action = String(body.action || "");
  const member = String(body.member || "");
  if (!["deactivate", "reactivate", "delete"].includes(action)) return reply(400, { error: "Deactivate, reactivate or delete?" });
  if (!/^[0-9a-f-]{36}$/i.test(member)) return reply(400, { error: "Which account?" });
  if (member === me.id) return reply(400, { error: "You can't do that to your own account. Ask another Admin." });

  const admin = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
  const userUrl = `${SUPABASE_URL}/auth/v1/admin/users/${member}`;

  const found = await fetch(userUrl, { headers: admin });
  if (found.status === 404) return reply(404, { error: "That account doesn't exist any more." });
  if (!found.ok) { console.error("get user", found.status, await found.text()); return reply(502, { error: "Couldn't look up the account." }); }
  const target = await found.json();
  const email = String(target.email || "");

  if (action === "deactivate" || action === "reactivate") {
    const r = await fetch(userUrl, {
      method: "PUT", headers: admin,
      body: JSON.stringify({ ban_duration: action === "deactivate" ? FOREVER : "none" }),
    });
    if (!r.ok) { console.error(action, r.status, await r.text()); return reply(502, { error: `Couldn't ${action} the account.` }); }
    console.log(`${me.email} ${action}d ${email} (${member})`);
    return reply(200, { done: action, member, email, deactivated: action === "deactivate" });
  }

  // Delete: first their files (the profile photo in avatars/<id>/, and any photos they added to the site maps),
  // then the account. The database removes everything else tied to it by itself.
  const removeFiles = async (bucket: string, paths: string[]) => {
    if (!paths.length) return;
    const r = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}`, { method: "DELETE", headers: admin, body: JSON.stringify({ prefixes: paths }) });
    if (!r.ok) console.error("remove files", bucket, r.status, await r.text());
  };
  try {
    const list = await fetch(`${SUPABASE_URL}/storage/v1/object/list/avatars`, {
      method: "POST", headers: admin, body: JSON.stringify({ prefix: member, limit: 1000 }),
    });
    if (list.ok) {
      const files: { name: string; id: string | null }[] = await list.json();
      await removeFiles("avatars", files.filter((f) => f.id).map((f) => `${member}/${f.name}`));
    }
  } catch (e) { console.error("avatars", e); }
  try {
    const rows = await fetch(`${SUPABASE_URL}/rest/v1/site_map_photos?select=path&author=eq.${member}`, { headers: admin });
    if (rows.ok) await removeFiles("site-map-photos", ((await rows.json()) as { path: string }[]).map((r) => r.path).filter(Boolean));
  } catch (e) { console.error("site map photos", e); }
  const del = await fetch(userUrl, { method: "DELETE", headers: admin });
  if (!del.ok) {
    const detail = await del.text();
    console.error("delete", del.status, detail);
    let msg = "";
    try { msg = JSON.parse(detail).msg || JSON.parse(detail).message || ""; } catch { /* not JSON */ }
    return reply(502, { error: "Couldn't delete the account" + (msg ? ": " + msg : ".") });
  }
  console.log(`${me.email} deleted ${email} (${member})`);
  return reply(200, { done: "delete", member, email });
});
