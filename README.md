# Asset Management System

Asset custody registry + device monitoring. Built with **Next.js 16** (App Router)
and **Supabase** (Postgres, Auth, RLS, Realtime).

Tracks which employee holds which asset (issue / transfer / return with
acceptance, full chain-of-custody ledger), and monitors enrolled laptops:
online/offline, activity, battery, disk, and IP-based location reported by a
lightweight PowerShell agent every 5 minutes.

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

3. **Create the database** — open the Supabase SQL editor and run the files in
   `supabase/migrations/` in order (`0001` → `0004`).

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
app/(dashboard)         Authenticated shell + pages (assets, employees,
                        transfers, my-assets, alerts, monitoring, dashboard)
app/api/ingest          Device heartbeat endpoint (token-auth, service role)
agent/                  Windows monitoring agent (PowerShell) + installer
android-agent/          Android monitoring agent (Kotlin, build with Android Studio)
components/             UI components (assets, transfers, alerts, monitoring)
lib/actions/            Server actions (assets, employees, transfers, alerts,
                        monitoring)
lib/supabase/           Browser, server, admin clients + proxy session refresh
lib/dal.ts              Data Access Layer (auth + profile + role guards)
lib/types.ts            Domain types + role helpers
proxy.ts                Route protection (Next.js 16 middleware replacement)
supabase/migrations/    SQL schema, custody RPCs, alerts, monitoring (0001-0004)
```

## Device monitoring

1. In the app: asset detail → **Device monitoring** → **Enroll device** (staff
   only). Copy the one-time token.
2. On the target laptop, from the `agent/` folder in an Admin PowerShell:

   ```powershell
   powershell -ExecutionPolicy Bypass -File .\install-agent.ps1 `
     -Token <DEVICE_TOKEN> -Server https://your-deployment-url
   ```

   See `agent/README.md` for details, what is collected, and uninstall.
