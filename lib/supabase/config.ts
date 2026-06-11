// Central place for Supabase connection values + a "configured" guard.
// The guard lets the app run with placeholder env vars (before real keys are
// added) without crashing on network calls to a fake URL.

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const isSupabaseConfigured =
  SUPABASE_URL.startsWith("https://") &&
  !SUPABASE_URL.includes("placeholder") &&
  SUPABASE_ANON_KEY.length > 30;
