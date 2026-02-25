# RepBoard PWA (React + Supabase + Vercel)

RepBoard is an installable PWA with 3 core pages:
- Rep page (`+1`, `+5`, `-5`)
- Leaderboard page (ranked push-up totals + public profile view)
- Profile page (preferred rep type + push-up heatmap)

## Local setup

```bash
npm install
cp .env.example .env
```

Set `.env`:

```bash
VITE_SUPABASE_URL=https://lzlnzzfdxxvgzfikxljn.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

Run:

```bash
npm start
```

Open `http://localhost:5173`.

## Supabase setup

1. In Supabase SQL Editor, run `supabase/schema.sql`.
2. In Authentication -> Providers:
   - Enable Google
   - Enable Email
   - Keep email confirmation required
3. In Authentication -> URL Configuration, set:
   - Site URL: `https://repboard.judemakes.dev`
   - Redirect URLs:
     - `http://localhost:5173`
     - `https://repboard.judemakes.dev`

## Auth modes

- Google OAuth sign-in
- Email/password sign-up and sign-in
- Email sign-up requires verification before first login
- Password reset email is available from the sign-in mode

## Build and test

```bash
npm run test:run
npm run build
```

## Deploy to Vercel

1. Push repository to GitHub.
2. Import project in Vercel.
3. Add environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy (repo includes `vercel.json` SPA rewrites).
5. Recheck Supabase redirect URLs after first production deploy.

## PWA notes

- Manifest is `src/manifest.json`.
- Service worker is `src/sw.js`, registered in `src/main.jsx`.
- Install from mobile browser using Add to Home Screen.
