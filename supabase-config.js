/* Limitless Diving — connection to your Supabase project (student accounts and the online class calendar).
   Paste your project's URL and publishable key between the quotes. Both are safe to publish: the
   database's row-level security rules (supabase/schema.sql) decide who can see what.
   Find them in Supabase: Project Settings → API Keys (the "Publishable key"), and Project Settings → Data API (the "Project URL").
   Leave them empty to keep the app working only in this browser, as before. */
window.LD_SUPABASE = {
  url: "https://tohabfygfsvcntarmfck.supabase.co/rest/v1/",   // e.g. "https://abcdefghijklmnop.supabase.co"
  key: "sb_publishable_hLYAAHHOgtSbTIjOjr9GaQ_DxkefCDZ"    // e.g. "sb_publishable_..." (or the older "anon public" key)
};
