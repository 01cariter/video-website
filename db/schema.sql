-- ============================================================================
-- Video Website — Neon Postgres schema (business data only)
-- ----------------------------------------------------------------------------
-- Run with:  npm run db:setup     (executes this file, then seeds mock data)
--
-- Authentication is handled by **Neon Auth** (@neondatabase/auth). Users,
-- sessions and providers live in the managed `neon_auth` schema — this file
-- does NOT create any auth tables. Business rows reference the Neon Auth user
-- id (a string/UUID) directly via a TEXT `user_id` column.
-- ============================================================================

-- Drop in dependency order so the script is re-runnable.
DROP TABLE IF EXISTS video_likes CASCADE;
DROP TABLE IF EXISTS projects    CASCADE;
DROP TABLE IF EXISTS videos      CASCADE;
DROP TABLE IF EXISTS creators    CASCADE;
DROP TABLE IF EXISTS profiles    CASCADE;

-- Legacy self-managed auth tables (replaced by Neon Auth). Dropped if present.
DROP TABLE IF EXISTS otp_codes  CASCADE;
DROP TABLE IF EXISTS identities CASCADE;
DROP TABLE IF EXISTS sessions   CASCADE;
DROP TABLE IF EXISTS users      CASCADE;

-- ----------------------------------------------------------------------------
-- profiles — app-specific data that extends a Neon Auth user.
-- `user_id` holds the Neon Auth user id (from the managed `neon_auth` schema).
-- We intentionally do NOT add a hard cross-schema foreign key to the managed
-- auth table; rows are created on-demand (find-or-create) on first sign-in.
-- ----------------------------------------------------------------------------
CREATE TABLE profiles (
  user_id      TEXT        PRIMARY KEY,            -- Neon Auth user id
  avatar_color TEXT        NOT NULL DEFAULT '#3f7d92',
  level        INTEGER     NOT NULL DEFAULT 1,
  streak       INTEGER     NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- creators — the @handles that publish videos
-- ----------------------------------------------------------------------------
CREATE TABLE creators (
  id           SERIAL PRIMARY KEY,
  handle       TEXT        NOT NULL UNIQUE,   -- e.g. @mathmood
  display_name TEXT        NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- videos — the short-form feed content
-- ----------------------------------------------------------------------------
CREATE TABLE videos (
  id          SERIAL PRIMARY KEY,
  title       TEXT        NOT NULL,
  category    TEXT        NOT NULL CHECK (category IN ('study', 'play')),
  label       TEXT,                            -- optional override badge, e.g. SPORTS
  size        TEXT        NOT NULL DEFAULT '',  -- layout hint: '', 'big', 'tall'
  creator_id  INTEGER     NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  image_id    TEXT        NOT NULL,             -- Unsplash photo id
  duration    TEXT        NOT NULL,             -- e.g. 0:58
  likes_count INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_videos_category ON videos (category);
CREATE INDEX idx_videos_creator  ON videos (creator_id);

-- ----------------------------------------------------------------------------
-- video_likes — which user liked which video (many-to-many).
-- `user_id` references the Neon Auth user id (TEXT).
-- ----------------------------------------------------------------------------
CREATE TABLE video_likes (
  user_id    TEXT        NOT NULL,                                   -- Neon Auth user id
  video_id   INTEGER     NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, video_id)
);

CREATE INDEX idx_video_likes_user ON video_likes (user_id);

-- ----------------------------------------------------------------------------
-- projects — drafts in the "Create studio".
-- `user_id` references the Neon Auth user id (TEXT).
-- ----------------------------------------------------------------------------
CREATE TABLE projects (
  id         SERIAL PRIMARY KEY,
  user_id    TEXT        NOT NULL,                  -- Neon Auth user id
  name       TEXT        NOT NULL,
  status     TEXT        NOT NULL DEFAULT 'draft',  -- draft | storyboard | published
  image_ids  TEXT[]      NOT NULL DEFAULT '{}',     -- Unsplash photo ids for thumbnail
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_projects_user ON projects (user_id);
