/* Limitless Diving — the shared connection to Supabase, used by the instructor app (index.html)
   and the student account page (account.html). Load after supabase-config.js and the supabase-js library.
   window.LDCloud.ready resolves once the sign-in session (if any) is known. */
(function () {
  "use strict";

  const cfg = window.LD_SUPABASE || {};
  const url = String(cfg.url || "").trim().replace(/\/+$/, "");
  const key = String(cfg.key || "").trim();
  const configured = /^https:\/\/[^\s/]+$/.test(url) && key.length > 20;
  const hasLib = !!(window.supabase && window.supabase.createClient);
  const listeners = [];

  const C = {
    configured,                  // URL and key are filled in
    available: configured && hasLib,
    client: null, session: null, user: null, instructor: false,
    url, key,
    onChange(fn) { listeners.push(fn); },
    async refreshRole() {
      C.instructor = false;
      if (!C.client || !C.user) return false;
      const { data, error } = await C.client.rpc("is_instructor");
      C.instructor = !error && data === true;
      return C.instructor;
    },
    signOut() { return C.client ? C.client.auth.signOut() : Promise.resolve(); },
    // A plain-language message for a Supabase error.
    explain(err) {
      const m = String((err && (err.message || err.error_description)) || err || "");
      if (/invalid login credentials/i.test(m)) return "That email and password don't match an account.";
      if (/email not confirmed/i.test(m)) return "Please confirm your email first. Check your inbox for the link.";
      if (/already registered|already been registered/i.test(m)) return "There's already an account with that email. Try signing in, or reset your password.";
      if (/password should be|weak password/i.test(m)) return "Please choose a longer password (at least 8 characters).";
      if (/rate limit|too many/i.test(m)) return "Too many tries. Please wait a few minutes and try again.";
      if (/failed to fetch|network/i.test(m)) return "Couldn't reach the server. Check your connection and try again.";
      return m || "Something went wrong. Please try again.";
    }
  };

  function emit(event) { listeners.forEach(fn => { try { fn(event); } catch (e) { console.error(e); } }); }

  let resolveReady;
  C.ready = new Promise(r => { resolveReady = r; });

  if (!C.available) {
    resolveReady(C);
  } else {
    C.client = window.supabase.createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    let first = true;
    C.client.auth.onAuthStateChange((event, session) => {
      const prev = C.user && C.user.id;
      C.session = session || null; C.user = session ? session.user : null;
      // Don't call Supabase inside this callback (it can deadlock); finish the work afterwards.
      setTimeout(async () => {
        if (first || (C.user && C.user.id) !== prev || event === "SIGNED_IN") await C.refreshRole();
        if (!C.user) C.instructor = false;
        if (first) { first = false; resolveReady(C); }
        emit(event);
      }, 0);
    });
  }

  window.LDCloud = C;
})();
