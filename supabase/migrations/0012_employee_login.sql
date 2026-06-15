-- ============================================================
-- 0012 — Employee WhatsApp number + admin-managed login credentials
-- Run in the Supabase SQL editor after 0011.
-- ============================================================

-- WhatsApp number (with country code) for sharing login credentials.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS whatsapp TEXT;

-- Plaintext login passwords, kept ONLY so an admin can re-share them with the
-- employee. Deliberately NOT on `profiles` (which has a world-read RLS policy).
-- This table enables RLS with NO policies, so the anon/authenticated PostgREST
-- roles can't see it at all — only server-side code using the service-role key
-- (the admin actions) can read or write it.
CREATE TABLE IF NOT EXISTS public.employee_logins (
  profile_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  password   TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.employee_logins ENABLE ROW LEVEL SECURITY;
-- (intentionally no CREATE POLICY — default-deny keeps it private to the
--  service role.)
