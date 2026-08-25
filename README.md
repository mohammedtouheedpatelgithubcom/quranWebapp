# Noor Quran Companion

Noor is a lightweight Quran web app built with Next.js, Quran API data, verse audio, Supabase auth, saved reading progress, bookmarks, profiles, and a small community reflection feed.

The app works in demo mode without backend credentials. Add Supabase environment variables when you want real authentication, synced user data, and production-ready community features.

## Features

- Quran chapter reader with Arabic text and selectable English translations.
- Searchable surah menu and URL-based chapter/translation navigation.
- Verse audio playback from EveryAyah.
- Local demo mode for bookmarks, progress, profile, and posting tests.
- Supabase backend for auth, profiles, bookmarks, progress, and community posts.
- Row level security, input constraints, and query indexes in `supabase/schema.sql`.
- Daily-goal and recommendation cards designed to encourage repeat visits.

## Tech Stack

- Next.js App Router
- React
- Tailwind CSS
- Supabase
- Quran API CDN data from `fawazahmed0/quran-api`
- EveryAyah MP3 recitation files

## Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Useful checks:

```bash
npm run lint
npm run build
```

## Environment

Create `.env.local` for backend sync:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

Without these values, the app stays in demo mode and does not store real credentials. Demo sign-in creates only a local browser session so the UI can be tested offline.

## Supabase Setup

1. Create a Supabase project.
2. Open the Supabase SQL editor.
3. Run `supabase/schema.sql`.
4. Enable email authentication in Supabase Auth.
5. Add the two public environment variables to `.env.local` and to your deployment host.

The schema enables row level security. Users can read and write their own profiles, bookmarks, and progress. Authenticated users can read community posts and create their own posts.

## Deployment

### Vercel

Vercel is the recommended deployment target for this app.

1. Push the project to GitHub.
2. Import the repository in Vercel.
3. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Deploy.
5. Test sign-in, bookmarking, progress, and posting on the production URL.

### Firebase Hosting

Use Firebase only if you are comfortable deploying a Next.js app with Firebase App Hosting or another SSR-compatible setup. Classic static Firebase Hosting is not enough for server-rendered Next routes.

### GitHub Pages

GitHub Pages is not recommended for the backend-enabled version because the app uses server rendering and hosted auth. Use Vercel for the simplest production path.

### GitHub Pages Deployment

This repository now includes a GitHub Actions workflow at `.github/workflows/deploy-pages.yml`. It builds a static export and deploys it to:

`https://mohammedtouheedpatelgithubcom.github.io/quranWebapp/`

After the first push, open the repository settings, choose **Pages**, set **Source** to **GitHub Actions**, and rerun the workflow from the **Actions** tab if needed. Quran text, surah navigation, translations, bookmarks, progress, and audio work in the static version. Supabase-backed account sync requires the public Supabase environment variables to be added to the workflow.

## Performance Notes

- Quran API fetches are cached with a 24-hour revalidation window.
- Chapter/translation navigation uses real Next navigation so server data refreshes correctly.
- The backend schema includes indexes for user history and recent community feeds.
- Keep community post bodies short and moderate content before opening the feed publicly at scale.

## Security Notes

- Never commit `.env.local` or service-role Supabase keys.
- Only use `NEXT_PUBLIC_SUPABASE_ANON_KEY` in the browser.
- Keep Supabase row level security enabled.
- Add CAPTCHA/rate limiting at the auth/provider layer before heavy public launch.
- Moderate community posts and consider abuse reporting before scaling the feed.

## Project Structure

```text
src/app/page.tsx          Server data loading and query parsing
src/app/quran-reader.tsx  Main reader, auth, progress, audio, and community UI
src/lib/supabase.ts       Browser Supabase client factory
supabase/schema.sql       Backend tables, RLS policies, constraints, and indexes
```
