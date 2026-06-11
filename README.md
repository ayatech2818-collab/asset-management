# Asset Management System

Asset custody registry + device monitoring. Built with **Next.js 16** (App Router)
and **Supabase** (Postgres, Auth, RLS, Realtime).

> See `../Asset_Management_Master_Plan.md` for the full architecture and roadmap.

## Stack

- Next.js 16 (App Router, Turbopack, `proxy.ts` for auth)
- Supabase (`@supabase/ssr`) — Auth + Postgres + RLS
- Tailwind CSS v4, lucide-react, recharts
- TypeScript

## Getting started

1. **Install** (already done): `npm install`

2. **Configure Supabase** — create a project at [supabase.com](https://supabase.com),
   then put your keys in `.env.local`:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

   Until real keys are added the app stays on the login screen with a notice.

3. **Create the database** — open the Supabase SQL editor and run
   `supabase/migrations/0001_init.sql`.

4. **Create the first admin** — sign up one user (via the app or the Supabase
   Auth dashboard), then in the SQL editor:

   ```sql
   update profiles set role = 'admin', full_name = 'Your Name'
   where email = 'you@company.com';
   ```

5. **Run the dev server**: `npm run dev` → http://localhost:3000

## Roles

`admin` · `asset_manager` · `employee`. Enforced both at the database (RLS,
`is_staff()`) and in the app (`requireStaff` / `requireAdmin` in `lib/dal.ts`).

## Project structure

```
app/(auth)/login        Login page + auth server actions
app/(dashboard)         Authenticated shell (sidebar + header) and pages
components/              Layout, StatCard, placeholders
lib/supabase/           Browser, server, admin clients + proxy session refresh
lib/dal.ts              Data Access Layer (auth + profile + role guards)
lib/types.ts            Domain types + role helpers
proxy.ts                Route protection (Next.js 16 middleware replacement)
supabase/migrations/    SQL schema
```
