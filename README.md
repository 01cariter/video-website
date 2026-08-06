# Snackd

A short-form learning/play video app — a feed of bite-sized "study" and "play"
shorts with a vertical player, search, category filters, likes, and a Solo
creation workspace. Built with **Next.js + TypeScript (App Router)** and **Supabase** via the Vercel
Supabase Integration.

## Stack

- [Next.js 16](https://nextjs.org) App Router (deployable on Vercel)
- TypeScript with strict type checking
- [Supabase Postgres](https://supabase.com/database) for business data
- [Supabase Auth](https://supabase.com/auth) for sign-up / sign-in, sessions,
  and social providers

## Authentication (Supabase Auth)

Auth is fully managed by Supabase Auth. This app keeps only app-specific data in
a `profiles` table (avatar colour, level, streak), keyed by the Supabase Auth
user id.

Supported sign-in methods:

- **Email + password** (`supabase.auth.signInWithPassword` / `signUp`)
- **Google** social sign-in (`supabase.auth.signInWithOAuth`)

> Social providers must be enabled in Supabase Auth Providers. No provider
> secrets are stored in this repo.

Key files:

| File | Role |
| --- | --- |
| `lib/supabase/server.ts` | Server Supabase SSR client |
| `lib/supabase/client.ts` | Browser Supabase client |
| `lib/user.ts` | `getCurrentUser()` — merges the Supabase Auth user with the `profiles` row |
| `app/auth/callback/route.ts` | OAuth / email PKCE callback |
| `proxy.ts` | Refreshes Supabase cookies and protects `/create` |

## Environment

Install the Supabase integration in Vercel, then pull env vars:

```bash
npx vercel link
npx vercel env pull .env.local
```

Required locally:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...  # or NEXT_PUBLIC_SUPABASE_ANON_KEY
POSTGRES_URL=...                          # or SUPABASE_DATABASE_URL
NEXT_PUBLIC_SITE_URL=https://your-domain.example
NEXT_PUBLIC_SOLO_URL=https://work-solo.ai/ # optional
```

## Run locally

```bash
npm install
npm run db:setup     # local Supabase only: recreates schema, applies security, seeds data
npm run dev          # http://localhost:3000
```

> Likes, saves, follows, and comments start empty.

Build for production:

```bash
npm run build
npm start
```

## Database and Storage

- Production: apply `supabase/migrations/20260727000100_secure_initial_schema.sql`
  with `supabase db push` or the Supabase SQL editor.
- `npm run db:setup` — destructive local setup. It is blocked for remote
  databases unless `ALLOW_DESTRUCTIVE_DB_SETUP=1` is explicitly set.
- `npm run db:seed` — re-seed business content only (schema must already exist)

Schema (`db/schema.sql`): `profiles`, `media`, `videos`, `video_likes`,
`video_saves`, `follows`, `comments`. Business tables reference the
Supabase Auth user id via a `TEXT` `user_id` column.

- **`media`** — metadata in Postgres; uploaded files are stored in the public
  Supabase Storage `media` bucket under each authenticated user's folder.
- The migration enables RLS on every public business table, applies Storage
  ownership policies, and limits the bucket to approved image/video MIME types
  and 50 MB per object.
- `POST /api/media` accepts approved multipart files up to 4 MB (the Vercel
  request-safe path) or a public HTTPS URL. Larger files should upload directly
  from the signed-in browser to Supabase Storage, where the bucket limit applies.
- **Creators are real users** — every video's `author_id` references a
  `profiles` row (a Supabase Auth user). Seeded demo authors use synthetic
  `seed_*` ids.
- Likes, saves, follows and comments update their denormalized counters through
  database triggers. Toggle/comment functions use one transaction and advisory
  locks, so concurrent requests cannot drift the counters.

## Features

- Cursor-paginated feed with infinite scrolling, cached recommendation ranking,
  and study/play category filters
- Independent `/videos/:id` pages with video-specific metadata and generated OG images
- Click-to-preview with **motion** shared-element animation; the player fits
  each clip's original dimensions
- Search bar and category filters
- **Follow** creators, **like**, **save** (favourite) and **comment** — all
  persisted per signed-in user
- **Create** opens the Solo workspace in a dedicated full-height iframe
- Light / dark theme toggle
- Self-hosted media (SVG posters by default), Lucide interface icons
