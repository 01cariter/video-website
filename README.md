# Snackd

A short-form learning/play video app — a feed of bite-sized "study" and "play"
shorts with a vertical player, search, category filters, likes, and a Create
studio. Built with **Next.js (App Router)**, **Neon Postgres**, and
**Neon Auth** for authentication.

## Stack

- [Next.js 14](https://nextjs.org) App Router (deployable on Vercel)
- [Neon Postgres](https://neon.com) for business data (videos, likes, projects, profiles)
- [Neon Auth](https://neon.com/docs/auth/overview) (`@neondatabase/auth` /
  `@neondatabase/neon-js`) for sign-up / sign-in, sessions, and social providers

## Authentication (Neon Auth)

Auth is fully managed by Neon Auth — users, sessions and providers live in the
managed `neon_auth` schema. This app keeps only app-specific data in a
`profiles` table (avatar colour, level, streak), keyed by the Neon Auth user id.

Supported sign-in methods:

- **Email + password** (`authClient.signIn.email` / `signUp.email`)
- **Google** and **Microsoft** social sign-in (`authClient.signIn.social`)

> Social providers must be enabled in the Neon Console (Project → Branch → Auth
> → Providers). No client secrets are stored in this repo.

Key files:

| File | Role |
| --- | --- |
| `lib/auth/server.js` | Server `createNeonAuth` instance (`handler`, `middleware`, `getSession`) |
| `lib/auth/client.js` | Browser `createAuthClient` instance |
| `lib/user.js` | `getCurrentUser()` — merges the Neon Auth session with the `profiles` row |
| `app/api/auth/[...path]/route.js` | Catch-all Neon Auth endpoint (sign-in/out, OAuth callbacks) |
| `middleware.js` | Protects `/create` via `auth.middleware()` |

## Environment

Copy `.env.example` to `.env.local` and fill in:

```bash
DATABASE_URL=...              # Neon Postgres connection string
NEON_AUTH_BASE_URL=...        # Neon Console → Auth → Configuration
NEON_AUTH_COOKIE_SECRET=...   # openssl rand -base64 32  (32+ chars)
```

## Run locally

```bash
npm install
npm run db:setup     # creates the schema + seeds creators/videos
npm run dev          # http://localhost:3000
```

> Likes and projects start empty — sign up through Neon Auth, then start liking
> shorts and creating projects.

Build for production:

```bash
npm run build
npm start
```

## Database

- `npm run db:setup` — apply `db/schema.sql`, then seed mock creators + videos
- `npm run db:seed` — re-seed business content only (schema must already exist)

Schema (`db/schema.sql`): `profiles`, `creators`, `videos`, `video_likes`,
`projects`. Business tables reference the Neon Auth user id via a `TEXT`
`user_id` column.

## Features

- Bite-sized video feed (study / play / sports categories)
- Vertical full-screen swipe player
- Search bar and category filters
- Likes persisted per signed-in user
- **Create studio** page — composer, templates, recent projects
- Light / dark theme toggle
- Real Unsplash imagery, SVG icons (no emoji)
