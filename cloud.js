/* Limitless Diving — the shared connection to Supabase, used by the instructor app (index.html)
   and the student account page (account.html). Load after supabase-config.js and the supabase-js library.
   window.LDCloud.ready resolves once the sign-in session (if any) is known. */
(function () {
  "use strict";

  const cfg = window.LD_SUPABASE || {};
  // Accept the Project URL with or without extra path (e.g. ".../rest/v1/"): only the origin is used.
  const url = (function (u) { try { const x = new URL(String(u || "").trim()); return x.protocol === "https:" ? x.origin : ""; } catch (e) { return ""; } })(cfg.url);
  const key = String(cfg.key || "").trim();
  const configured = /^https:\/\/[^\s/]+$/.test(url) && key.length > 20;
  const hasLib = !!(window.supabase && window.supabase.createClient);
  const listeners = [];

  const C = {
    configured,                  // URL and key are filled in
    available: configured && hasLib,
    client: null, session: null, user: null,
    role: "student",             // "student" | "divemaster" | "instructor" | "admin"
    instructor: false,           // role is Instructor or Admin
    techAccess: false,           // may open Elements of tech diving (switched on in their profile, or Instructor/Admin)
    // Tools pages they may open: on unless an Instructor or Admin switched one off for them (Dive Masters and up always).
    toolAccess: { nitrox: true, physics: true },
    ROLES: ["student", "divemaster", "instructor", "admin"],
    ROLE_NAMES: { student: "Student", divemaster: "Dive Master", instructor: "Instructor", admin: "Admin" },
    // True when the signed-in person's level is at least minRole.
    can(minRole) { return !!C.user && C.ROLES.indexOf(C.role) >= C.ROLES.indexOf(minRole); },
    url, key,
    onChange(fn) { listeners.push(fn); },
    async refreshRole() {
      C.role = "student"; C.roleError = false; C.instructor = false; C.techAccess = false; C.toolAccess = { nitrox: true, physics: true };
      if (!C.client || !C.user) { techLink(); return C.role; }
      // A slow or restarting Supabase (e.g. during a plan upgrade) answers with an error: try again a few times, and
      // remember it failed (C.roleError) so pages say "couldn't reach the server" rather than "this is a student account".
      let r, t, k;
      for (let i = 0; i < 3; i++) {
        if (i) await new Promise(res => setTimeout(res, 1500 * i));
        [r, t, k] = await Promise.all([C.client.rpc("my_role"), C.client.rpc("my_tech_access"), C.client.rpc("my_tool_access")]);
        if (!r.error) break;
      }
      C.roleError = !!r.error;
      if (!r.error && C.ROLES.includes(r.data)) C.role = r.data;
      C.instructor = C.can("instructor");
      // Before schema.sql is re-run there's no my_tech_access(): only Instructors and Admins get in then.
      C.techAccess = t.error ? C.instructor : t.data === true;
      // Before schema.sql is re-run there's no my_tool_access(): the Tools stay open to everyone then.
      if (!k.error && k.data && typeof k.data === "object") C.toolAccess = { nitrox: k.data.nitrox !== false, physics: k.data.physics !== false };
      techLink();
      return C.role;
    },
    signOut() { return C.client ? C.client.auth.signOut() : Promise.resolve(); },
    // Links to private Storage files, { path: url }. Each link is kept in this browser for a few days and reused, so
    // the browser can serve the picture from its own cache instead of downloading it again from Supabase on every
    // page load (a fresh link each time looks like a new file to the browser, and every download counts against the
    // Supabase bandwidth allowance). Kept per signed-in account, so nobody reuses another person's links.
    async signedUrls(bucket, paths) {
      const out = {};
      paths = [...new Set((paths || []).filter(Boolean))];
      if (!paths.length || !C.client) return out;
      const KEY = "ld-signed-urls", now = Date.now(), DAYS = 7, owner = (C.user && C.user.id) || "";
      let cache = {};
      try { cache = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (e) { cache = {}; }
      if (cache.owner !== owner) cache = { owner, urls: {} };
      cache.urls = cache.urls || {};
      for (const k of Object.keys(cache.urls)) if (!(cache.urls[k].exp > now)) delete cache.urls[k];
      const need = [];
      for (const p of paths) {
        const hit = cache.urls[bucket + "/" + p];
        if (hit && hit.exp - now > 86400000) out[p] = hit.url; else need.push(p); // keep a day's margin before it expires
      }
      if (need.length) {
        const { data, error } = await C.client.storage.from(bucket).createSignedUrls(need, DAYS * 86400);
        if (!error && data) data.forEach(r => {
          if (!r.signedUrl) return;
          out[r.path] = r.signedUrl;
          cache.urls[bucket + "/" + r.path] = { url: r.signedUrl, exp: now + DAYS * 86400000 };
        });
        try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch (e) { /* private window: just don't keep them */ }
      }
      return out;
    },
    // Forget kept links for these files (after replacing or deleting one).
    forgetSignedUrls(bucket, paths) {
      try {
        const cache = JSON.parse(localStorage.getItem("ld-signed-urls") || "{}") || {};
        (paths || []).forEach(p => { if (cache.urls) delete cache.urls[bucket + "/" + p]; });
        localStorage.setItem("ld-signed-urls", JSON.stringify(cache));
      } catch (e) { /* nothing kept */ }
    },
    // Uploads: tell browsers (and Supabase's CDN) they may keep the file for a week.
    CACHE_SECONDS: "604800",
    // A plain-language message for a Supabase error.
    explain(err) {
      const m = String((err && (err.message || err.error_description)) || err || "");
      if (/invalid login credentials/i.test(m)) return "That email and password don't match an account.";
      if (/user is banned|banned/i.test(m)) return "This account has been deactivated. Contact Limitless Diving to have it switched back on.";
      if (/email not confirmed/i.test(m)) return "Please confirm your email first. Check your inbox for the link.";
      if (/already registered|already been registered/i.test(m)) return "There's already an account with that email. Try signing in, or reset your password.";
      if (/password should be|weak password/i.test(m)) return "Please choose a longer password (at least 8 characters).";
      if (/rate limit|too many/i.test(m)) return "Too many tries. Please wait a few minutes and try again.";
      if (/PGRST204|PGRST205|could not find the .* (column|table)|column .* does not exist|schema cache/i.test(m)) return "The database needs a quick update first. Ask your instructor to run the latest supabase/schema.sql.";
      if (/bucket not found/i.test(m)) return "Photo storage isn't set up yet. Ask your instructor to run the latest supabase/schema.sql.";
      if (/failed to fetch|network/i.test(m)) return "Couldn't reach the server. Check your connection and try again.";
      return m || "Something went wrong. Please try again.";
    }
  };

  // Elements of tech diving: add its link to the top menu of every page for people who have access,
  // and take it away again for everyone else (e.g. after logging out).
  function techLink() {
    if (typeof document === "undefined") return;
    document.querySelectorAll(".pubnav").forEach(nav => {
      let a = nav.querySelector("a.tech-link");
      if (!C.techAccess) { if (a) a.remove(); return; }
      if (a) return;
      a = document.createElement("a");
      a.href = "tech-diving.html"; a.className = "tech-link"; a.textContent = "Elements of tech diving";
      if (/tech-diving\.html$/.test(location.pathname)) { a.classList.add("on"); a.setAttribute("aria-current", "page"); }
      const after = nav.querySelector('a[href="diving-physics.html"]') || nav.querySelector('a[href="account.html"]');
      if (after) after.insertAdjacentElement("afterend", a); else nav.appendChild(a);
    });
    // Tools switched off for this person: hide their links (the pages themselves say so too, see members-only.js).
    document.querySelectorAll('.pubnav a[href="nitrox.html"]').forEach(x => { x.hidden = !C.toolAccess.nitrox; });
    document.querySelectorAll('.pubnav a[href="diving-physics.html"]').forEach(x => { x.hidden = !C.toolAccess.physics; });
  }

  function emit(event) { listeners.forEach(fn => { try { fn(event); } catch (e) { console.error(e); } }); }

  let resolveReady;
  C.ready = new Promise(r => { resolveReady = r; });

  if (!C.available) {
    C.loaded = true; resolveReady(C);
  } else {
    C.client = window.supabase.createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    let first = true;
    C.client.auth.onAuthStateChange((event, session) => {
      const prev = C.user && C.user.id;
      C.session = session || null; C.user = session ? session.user : null;
      // Don't call Supabase inside this callback (it can deadlock); finish the work afterwards.
      setTimeout(async () => {
        if (first || (C.user && C.user.id) !== prev || event === "SIGNED_IN") await C.refreshRole();
        if (!C.user) { C.role = "student"; C.instructor = false; C.techAccess = false; C.toolAccess = { nitrox: true, physics: true }; techLink(); }
        if (first) { first = false; C.loaded = true; resolveReady(C); }
        emit(event);
      }, 0);
    });
  }

  window.LDCloud = C;
})();
