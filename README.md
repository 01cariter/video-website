# Snackd

A short-form learning/play video app — a feed of bite-sized "study" and "play"
shorts with a vertical player, search, category filters, likes, and an AI-native
CreatorStudio canvas. Built with **Next.js + TypeScript (App Router)** and **Supabase** via the Vercel
Supabase Integration.

## Stack

- [Next.js 16](https://nextjs.org) App Router (deployable on Vercel)
- TypeScript with strict type checking
- [Supabase Postgres](https://supabase.com/database) for business data
- [Supabase Auth](https://supabase.com/auth) for sign-up / sign-in, sessions,
  and social providers
- [Vercel AI SDK + AI Gateway](https://vercel.com/ai-gateway) for every
  CreatorStudio Agent, text, image, and video request
- [Stripe Checkout](https://docs.stripe.com/checkout) for hosted credit top-ups

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
| `app/components/compose/ComposeModal.tsx` | Posting overlay — opened from the feed, profile, or selected Studio nodes |

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
SUPABASE_DB_URL=...                       # Integration may inject VIDEO_WEB_POSTGRES_URL_NON_POOLING
NEXT_PUBLIC_SITE_URL=https://your-domain.example
AI_GATEWAY_API_KEY=...
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
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

- Production: Vercel runs `supabase db push` before `next build`; Preview
  deployments skip migrations. A migration failure blocks the deployment.
- `npm run db:migrate:check` — dry-run pending migrations without applying them.
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
`video_saves`, `follows`, `comments`; migrations also add `studio_projects`,
`credit_accounts`, `credit_ledger`, `credit_packages`, `credit_orders`,
`billing_events`, and `ai_generation_requests`. Business tables reference the
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
- **Post** accepts images and videos from the device or selected CreatorStudio
  nodes. Uploads go directly to Supabase Storage with progress, dimensions,
  duration, and generated video covers; publishing lands on `/videos/:id`.
- **CreatorStudio** combines a LeaferJS infinite canvas, image/video/text
  generators, Agent + Skills, Quick Edit, reusable prompts and parameters, and
  direct publishing of selected nodes.
- **Profiles** at `/u/:handle` — avatar, bio, follower/post/like counts, follow
  button, and the creator's posts. Your own profile adds a **Saved** tab.
  Reachable from the sidebar and from the author on any video.
- Light / dark theme toggle
- Self-hosted media (SVG posters by default), Lucide interface icons

## CreatorStudio AI, credits, and Stripe

- The infinite canvas is rendered and edited with LeaferJS. Existing
  React Flow/localStorage projects are migrated into the new node shape on
  first load.
- Signed-in projects sync to Supabase; localStorage remains an offline/guest
  cache.
- Models use Vercel AI Gateway ids only. The versioned catalog contains the
  supported Agent, text, image, and video parameter contracts; Vercel Flags
  choose the Agent model and control each model's availability and credit
  formula, including a safe upstream-rate multiplier. Language requests are
  pinned to the priced Gateway provider.
- Each AI request has a unique request id. Postgres atomically reserves
  credits, rejects duplicate work, stores completed results, and refunds failed
  generations. Generated image/video bytes are persisted in the Supabase
  `media` bucket instead of being kept as data URLs.
- Stripe uses hosted Checkout. Prices come from the trusted
  `credit_packages` table; successful Checkout sessions grant credits only
  through the signed webhook.

### Connect Stripe

1. Create a Stripe account and copy a restricted/live secret key into
   `STRIPE_SECRET_KEY` in Vercel.
2. Deploy once, then create a Stripe webhook endpoint:
   `https://YOUR_DOMAIN/api/billing/webhooks/stripe`.
3. Subscribe to `checkout.session.completed`,
   `checkout.session.async_payment_succeeded`, and
   `checkout.session.async_payment_failed`, and
   `checkout.session.expired`.
4. Copy the endpoint signing secret into `STRIPE_WEBHOOK_SECRET` and redeploy.
5. Run `supabase db push`. Visit `/credits` and complete a small test-mode
   payment with Stripe's test card `4242 4242 4242 4242`.
6. Optional: create Stripe Prices and put their ids in
   `credit_packages.stripe_price_id`. If left null, Checkout securely builds
   `price_data` from the server-side package row.

For local webhook testing:

```bash
stripe listen --forward-to localhost:3000/api/billing/webhooks/stripe
```
