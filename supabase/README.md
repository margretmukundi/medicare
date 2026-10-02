# Supabase setup

1. **Schema + seed** – run `supabase/migrations/0001_schema.sql` then `0002_seed.sql` in the
   Supabase SQL Editor, or `npm run db:migrate` after putting `DB_PASSWORD` in `supabase/.env.secrets`.
2. **First admin** – sign up on the site, then `npm run make-admin -- you@example.com`
   (or `npm run create-admin -- you@example.com 'StrongPassword'` to create the account directly).
3. **M-Pesa (Daraja)** – install the Supabase CLI, then have the project owner run
   `sh supabase/deploy-functions.sh` from the project root and sign in when prompted. The script
   uploads only the Edge Function secrets, not the database credentials in `.env.secrets`.
   Defaults to the Daraja **sandbox** (shortcode 174379). For live payments set `MPESA_ENV=production`
   and your own `MPESA_SHORTCODE` / `MPESA_PASSKEY`, then re-run `secrets set`.

`supabase/.env.secrets` holds server-side secrets and is git-ignored. Never import it from `src/`.
