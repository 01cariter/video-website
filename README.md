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
| `proxy.ts` | Refreshes Supabase cookies |
| `app/components/CreateModal.tsx` | Posting overlay — opened from the feed and the profile, no `/create` route |

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

> **Uploading fails with "Bucket not found"?** The `media` storage bucket is
> created only by that migration — `db/schema.sql` contains no storage
> statements, and `db:setup` refuses to touch a remote database. Run the
> migration (its bucket and policy statements are idempotent). Creating the
> bucket by hand in the dashboard is not enough: without the storage policies
> the upload then fails on row-level security, and the name must be exactly
> `media`.

Schema (`db/schema.sql`): `profiles`, `media`, `videos`, `video_likes`,
`video_saves`, `follows`, `comments`. Business tables reference the
Supabase Auth user id via a `TEXT` `user_id` column.

- **`media`** — metadata in Postgres; uploaded files are stored in the public
  Supabase Storage `media` bucket under each authenticated user's folder.
- The migration enables RLS on every public business table, applies Storage
  ownership policies, and limits the bucket to approved image/video MIME types
  and 50 MB per object.
- `POST /api/media` accepts three shapes: an approved multipart file up to 4 MB
  (the Vercel request-safe path), a public HTTPS `url`, or a `storagePath` for
  an object the signed-in browser already pushed straight to Supabase Storage.
  The `storagePath` form verifies the path sits in the caller's own folder and
  that the object exists before recording the row — that is how uploads above
  4 MB reach the 50 MB bucket limit.
- `POST /api/videos` publishes a post. It re-checks that the attached
  `posterMediaId` / `videoMediaId` belong to the caller, because the direct
  Postgres connection bypasses RLS.
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
- **Create** asks first: *"I have my own"* or *"Make it with AI"*.
  - **I have my own** — drag-and-drop photo/video uploader. Files go from the
    browser straight to Supabase Storage with a real progress bar, dimensions
    and clip duration are read client-side, and a cover frame is grabbed from
    video with a canvas so the post has a feed poster. Publishing lands on
    `/videos/:id`.
  - **Make it with AI** — hands off to the Solo studio and takes the finished
    file back through the uploader. There is no Solo API integration. The page
    still mounts Solo in a full-height iframe first, but **Solo refuses to
    render when it is not the top window** — it sends no `X-Frame-Options` and
    no `frame-ancestors` CSP, so the frame fires `load` and then stays blank,
    and nothing cross-origin reveals that. After a 3s grace period the page
    offers **Open Solo** (its own tab) and **I have the file — upload it**,
    with a "Show the embed anyway" escape hatch in case Solo ever allows
    framing.
- **Profiles** at `/u/:handle` — avatar, bio, follower/post/like counts, follow
  button, and the creator's posts. Your own profile adds a **Saved** tab.
  Reachable from the sidebar and from the author on any video.
- Light / dark theme toggle
- Self-hosted media (SVG posters by default), Lucide interface icons
