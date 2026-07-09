# Snackd

A short-form learning/play video app — a feed of bite-sized "study" and "play"
shorts with a vertical player, search, category filters, likes, and a Create
studio. Built with **Next.js (App Router)** and **Supabase** via the Vercel
Supabase Integration.

## Stack

- [Next.js 16](https://nextjs.org) App Router (deployable on Vercel)
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
| `lib/supabase/server.js` | Server Supabase SSR client |
| `lib/supabase/client.js` | Browser Supabase client |
| `lib/user.js` | `getCurrentUser()` — merges the Supabase Auth user with the `profiles` row |
| `app/auth/callback/route.js` | OAuth / email PKCE callback |
| `proxy.js` | Refreshes Supabase cookies and protects `/create` |

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
```

## Run locally

```bash
npm install
npm run db:setup     # creates the schema + seeds creators/videos
npm run dev          # http://localhost:3000
```

> Likes and projects start empty — sign up through Supabase Auth, then start liking
> shorts and creating projects.

Build for production:

```bash
npm run build
npm start
```

## Database

- `npm run db:setup` — apply `db/schema.sql`, then seed mock creators + videos
- `npm run db:seed` — re-seed business content only (schema must already exist)

Schema (`db/schema.sql`): `profiles`, `media`, `videos`, `video_likes`,
`video_saves`, `follows`, `comments`, `projects`. Business tables reference the
Supabase Auth user id via a `TEXT` `user_id` column.

- **`media`** — self-hosted images & videos (no Unsplash). Served from a URL /
  `data:` URI or inline bytes via `GET /api/media/:id`. Uploads go through
  `POST /api/media` (multipart `file` or JSON `{ url, kind, mime, width, height }`).
- **Creators are real users** — every video's `author_id` references a
  `profiles` row (a Supabase Auth user). Seeded demo authors use synthetic
  `seed_*` ids.

## Features

- Bite-sized video feed (study / play / sports categories)
- Click-to-preview with **motion** shared-element animation; the player fits
  each clip's original dimensions
- Search bar and category filters
- **Follow** creators, **like**, **save** (favourite) and **comment** — all
  persisted per signed-in user
- **Create studio** page — composer, templates, recent projects
- Light / dark theme toggle
- Self-hosted media (SVG posters by default), SVG icons (no emoji)
