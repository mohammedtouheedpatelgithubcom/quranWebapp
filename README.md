Noor is a Quran companion built with Next.js, Quran API data, Supabase auth, and a community learning feed.

## Getting Started

First, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the reader.

You can start editing the page by modifying `src/app/page.tsx` and `src/app/quran-reader.tsx`.

## Backend Setup

The app works in demo mode without backend credentials, but signups, profile sync, bookmarks, progress, and community posts are enabled when Supabase is configured.

1. Create a Supabase project.
2. Run the SQL in `supabase/schema.sql` in the Supabase SQL editor.
3. Set these environment variables in `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

4. Start the app with `npm run dev`.

## Deploying

Vercel is the easiest option because the app uses environment variables and hosted auth. GitHub Pages is not a good fit for the backend-enabled version unless you move auth and data to another hosted service.

### GitHub Push

If this folder is not yet connected to a remote GitHub repository:

```bash
git init
git add .
git commit -m "Build Noor Quran companion"
git branch -M master
git remote add origin <your-github-repo-url>
git push -u origin master
```

If the remote already exists, use:

```bash
git add .
git commit -m "Update Noor Quran companion"
git push
```

### Vercel Deploy

1. Push the repository to GitHub.
2. Import the repo into Vercel.
3. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in the Vercel project settings.
4. Run a production deploy.
5. Open the deployed site and verify sign-in, bookmarks, progress, and community posting.

## Design Notes

This project uses `next/font` with Geist for the app shell and a warm Quran-themed interface for the reader experience.

## Learn More

For Next.js deployment and auth references, see the official Next.js and Supabase docs.
