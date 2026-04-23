# Forge React Intake App

React app for public UX consultation intake submissions with a Supabase-backed, allowlisted admin dashboard and submission notification emails.

## Stack

- React + Vite + TypeScript
- Tyler Forge (`@tylertech/forge`, `@tylertech/forge-react`)
- Supabase (Auth, Postgres, RLS, Edge Functions)
- Netlify hosting

## Environment Variables

Create `.env` from `.env.example`:

```bash
cp .env.example .env
```

Set:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

For Supabase Edge Function `notify-submission`, configure:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `NOTIFICATION_FROM_EMAIL`

## Local Development

```bash
npm install
npm run dev
```

## Supabase Setup

1. Apply migration in `supabase/migrations/20260421090000_create_intake_app_schema.sql`.
2. Seed `admin_allowlist` with authorized admin emails.
3. Seed `notification_recipients` with notification destination emails.
4. Deploy edge function:

```bash
supabase functions deploy notify-submission
```

## Deployment

- Netlify build config is in `netlify.toml`.
- Add the frontend env vars in Netlify site settings.
- Ensure Supabase Edge Function secrets are set in your Supabase project.
