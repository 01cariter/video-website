-- ============================================================================
-- Video Website — Neon Postgres schema (business data only)
-- ----------------------------------------------------------------------------
-- Run with:  npm run db:setup     (executes this file, then seeds mock data)
--
-- Authentication is handled by **Neon Auth** (@neondatabase/auth). Users,
-- sessions and providers live in the managed `neon_auth` schema — this file
-- does NOT create any auth tables. Business rows reference the Neon Auth user
-- id (a string/UUID) directly via a TEXT `user_id` column.
--
-- v2 changes:
--   • All imagery / video lives in a self-hosted `media` table (no Unsplash).
--   • Creators are now REAL users — videos reference `profiles.user_id`.
--   • Social graph: follows, saves (favourites) and comments.
-- ============================================================================

-- Drop in dependency order so the script is re-runnable.
DROP TABLE IF EXISTS comments     CASCADE;
DROP TABLE IF EXISTS video_saves  CASCADE;
DROP TABLE IF EXISTS video_likes  CASCADE;
DROP TABLE IF EXISTS follows      CASCADE;
DROP TABLE IF EXISTS projects     CASCADE;
DROP TABLE IF EXISTS videos       CASCADE;
DROP TABLE IF EXISTS media        CASCADE;
DROP TABLE IF EXISTS creators     CASCADE;
DROP TABLE IF EXISTS profiles     CASCADE;

-- Legacy self-managed auth tables (replaced by Neon Auth). Dropped if present.
DROP TABLE IF EXISTS otp_codes  CASCADE;
DROP TABLE IF EXISTS identities CASCADE;
DROP TABLE IF EXISTS sessions   CASCADE;
DROP TABLE IF EXISTS users      CASCADE;

-- ----------------------------------------------------------------------------
-- profiles — app-specific data that extends a Neon Auth user. This is also the
-- *creator identity*: every video is authored by a profile (a real user).
-- `user_id` holds the Neon Auth user id (from the managed `neon_auth` schema).
-- Seeded demo authors use synthetic ids prefixed with `seed_`.
-- ----------------------------------------------------------------------------
CREATE TABLE profiles (
  user_id         TEXT        PRIMARY KEY,            -- Neon Auth user id
  handle          TEXT        UNIQUE,                 -- @handle (nullable until chosen)
  display_name    TEXT,                               -- falls back to Neon Auth name
  bio             TEXT,
  avatar_color    TEXT        NOT NULL DEFAULT '#3f7d92',
  avatar_media_id INTEGER,                            -- optional self-hosted avatar (media.id)
  level           INTEGER     NOT NULL DEFAULT 1,
  streak          INTEGER     NOT NULL DEFAULT 0,
  followers_count INTEGER     NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_handle ON profiles (handle);

-- ----------------------------------------------------------------------------
-- media — self-hosted images & videos (replaces the Unsplash dependency).
-- A row can be served either from an external/`data:` URL (`url`) OR from inline
-- bytes (`data`) via the `/api/media/[id]` route. `kind` is image|video.
-- ----------------------------------------------------------------------------
CREATE TABLE media (
  id               SERIAL      PRIMARY KEY,
  kind             TEXT        NOT NULL CHECK (kind IN ('image', 'video')),
  mime             TEXT        NOT NULL DEFAULT 'image/svg+xml',
  url              TEXT,                               -- external/self URL or data: URI
  data             BYTEA,                              -- optional inline bytes (served via /api/media)
  width            INTEGER,                            -- intrinsic px (drives "fit to original size")
  height           INTEGER,
  duration_seconds NUMERIC,                            -- for video kind
  owner_id         TEXT,                               -- uploader (Neon Auth user id); null for seed
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (url IS NOT NULL OR data IS NOT NULL)
);

CREATE INDEX idx_media_owner ON media (owner_id);
CREATE INDEX idx_media_kind  ON media (kind);

-- ----------------------------------------------------------------------------
-- videos — the short-form feed content. Authored by a real user (profiles).
-- Imagery/playback reference the self-hosted `media` table.
-- ----------------------------------------------------------------------------
CREATE TABLE videos (
  id              SERIAL      PRIMARY KEY,
  title           TEXT        NOT NULL,
  description     TEXT,
  category        TEXT        NOT NULL CHECK (category IN ('study', 'play')),
  label           TEXT,                               -- optional override badge, e.g. SPORTS
  size            TEXT        NOT NULL DEFAULT '',     -- grid layout hint: '', 'big', 'tall'
  author_id       TEXT        NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  poster_media_id INTEGER     REFERENCES media(id) ON DELETE SET NULL,  -- cover image
  video_media_id  INTEGER     REFERENCES media(id) ON DELETE SET NULL,  -- playable clip
  duration        TEXT        NOT NULL DEFAULT '',     -- display string, e.g. 0:58
  likes_count     INTEGER     NOT NULL DEFAULT 0,
  saves_count     INTEGER     NOT NULL DEFAULT 0,
  comments_count  INTEGER     NOT NULL DEFAULT 0,
  views_count     INTEGER     NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_videos_category ON videos (category);
CREATE INDEX idx_videos_author   ON videos (author_id);

-- ----------------------------------------------------------------------------
-- video_likes — which user liked which video (many-to-many).
-- ----------------------------------------------------------------------------
CREATE TABLE video_likes (
  user_id    TEXT        NOT NULL,                                   -- Neon Auth user id
  video_id   INTEGER     NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, video_id)
);

CREATE INDEX idx_video_likes_user ON video_likes (user_id);

-- ----------------------------------------------------------------------------
-- video_saves — favourites / "收藏". Same shape as likes.
-- ----------------------------------------------------------------------------
CREATE TABLE video_saves (
  user_id    TEXT        NOT NULL,                                   -- Neon Auth user id
  video_id   INTEGER     NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, video_id)
);

CREATE INDEX idx_video_saves_user ON video_saves (user_id);

-- ----------------------------------------------------------------------------
-- follows — social graph: a follower follows an author (a profile).
-- ----------------------------------------------------------------------------
CREATE TABLE follows (
  follower_id TEXT        NOT NULL,                                  -- Neon Auth user id
  author_id   TEXT        NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, author_id),
  CHECK (follower_id <> author_id)
);

CREATE INDEX idx_follows_author ON follows (author_id);

-- ----------------------------------------------------------------------------
-- comments — threaded-by-time comments on a video.
-- ----------------------------------------------------------------------------
CREATE TABLE comments (
  id         SERIAL      PRIMARY KEY,
  video_id   INTEGER     NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  user_id    TEXT        NOT NULL,                                   -- Neon Auth user id
  body       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_comments_video ON comments (video_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- projects — drafts in the "Create studio". Thumbnails reference self-hosted
-- media rows (was Unsplash photo ids).
-- ----------------------------------------------------------------------------
CREATE TABLE projects (
  id         SERIAL      PRIMARY KEY,
  user_id    TEXT        NOT NULL,                  -- Neon Auth user id
  name       TEXT        NOT NULL,
  status     TEXT        NOT NULL DEFAULT 'draft',  -- draft | storyboard | published
  media_ids  INTEGER[]   NOT NULL DEFAULT '{}',     -- media ids for thumbnail
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_projects_user ON projects (user_id);
