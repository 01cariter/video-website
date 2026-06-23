'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authClient } from '@/lib/auth/client';
import { bg, fmtLikes, initials } from './media';

const FEED_COPY = {
  all: { h: 'Your feed', s: 'Tap any short to start — then just keep swiping.' },
  study: { h: 'Study feed', s: 'Quick lessons that actually stick.' },
  play: { h: 'Entertainment feed', s: 'Light, fun shorts for your break.' },
};

function HeartIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path d="M12 20s-7-4.6-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.4-7 10-7 10Z" />
    </svg>
  );
}

function badgeMeta(v) {
  const label = v.label || (v.category === 'study' ? 'STUDY' : 'FUN');
  const cls = v.label === 'SPORTS' ? 'sport' : v.category;
  return { label, cls };
}

export default function HomeFeed({ user, initialVideos }) {
  const router = useRouter();
  const [videos, setVideos] = useState(initialVideos);
  const [mode, setMode] = useState('all');
  const [playerMode, setPlayerMode] = useState('all');
  const [playerOpen, setPlayerOpen] = useState(false);
  const [pending, setPending] = useState({});

  const list = useMemo(
    () => (mode === 'all' ? videos : videos.filter((v) => v.category === mode)),
    [videos, mode]
  );

  function toggleTheme() {
    const el = document.documentElement;
    const isDark = el.getAttribute('data-theme') === 'dark';
    if (isDark) {
      el.removeAttribute('data-theme');
      localStorage.setItem('snackd-theme', 'light');
    } else {
      el.setAttribute('data-theme', 'dark');
      localStorage.setItem('snackd-theme', 'dark');
    }
  }

  async function like(e, video) {
    e.stopPropagation();
    if (!user) {
      router.push('/login?next=/');
      return;
    }
    if (pending[video.id]) return;
    setPending((p) => ({ ...p, [video.id]: true }));
    try {
      const res = await fetch(`/api/videos/${video.id}/like`, { method: 'POST' });
      if (res.status === 401) {
        router.push('/login?next=/');
        return;
      }
      const data = await res.json();
      if (res.ok) {
        setVideos((vs) =>
          vs.map((v) =>
            v.id === video.id ? { ...v, liked: data.liked, likes_count: data.likes_count } : v
          )
        );
      }
    } finally {
      setPending((p) => {
        const next = { ...p };
        delete next[video.id];
        return next;
      });
    }
  }

  async function logout() {
    await authClient.signOut();
    router.refresh();
  }

  function openPlayer() {
    setPlayerMode(mode);
    setPlayerOpen(true);
    document.body.style.overflow = 'hidden';
  }
  function closePlayer() {
    setPlayerOpen(false);
    document.body.style.overflow = '';
  }

  const copy = FEED_COPY[mode];

  // Build an "endless" reel sequence for the player.
  const reelPool = playerMode === 'all' ? videos : videos.filter((v) => v.category === playerMode);
  const reels = [];
  for (let r = 0; r < 4; r += 1) reels.push(...reelPool);

  return (
    <>
      <div className="app">
        {/* SIDEBAR */}
        <aside className="side">
          <div className="logo">
            <span className="mark" />
            <span>Snackd</span>
          </div>
          <nav className="nav">
            <button className={mode === 'all' ? 'active' : ''} onClick={() => setMode('all')}>
              <span className="ic">
                <svg viewBox="0 0 24 24">
                  <path d="M3 11.5 12 4l9 7.5" />
                  <path d="M5 10v10h14V10" />
                </svg>
              </span>
              <span>Home</span>
            </button>
            <button className={mode === 'study' ? 'active' : ''} onClick={() => setMode('study')}>
              <span className="ic">
                <svg viewBox="0 0 24 24">
                  <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H12v15.5H5.5A1.5 1.5 0 0 1 4 18Z" />
                  <path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H12v15.5h6.5A1.5 1.5 0 0 0 20 18Z" />
                </svg>
              </span>
              <span>Study</span>
            </button>
            <button className={mode === 'play' ? 'active' : ''} onClick={() => setMode('play')}>
              <span className="ic">
                <svg viewBox="0 0 24 24">
                  <rect x="3" y="5" width="18" height="14" rx="3" />
                  <path d="m10 9 5 3-5 3Z" fill="currentColor" stroke="none" />
                </svg>
              </span>
              <span>Entertainment</span>
            </button>
          </nav>
          <Link className="create" href="/create">
            <span className="ic">
              <svg viewBox="0 0 24 24">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </span>
            <span>Create</span>
          </Link>

          {user ? (
            <div className="me">
              <span className="av" style={{ background: user.avatar_color }}>
                {initials(user.display_name)}
              </span>
              <span className="txt">
                <b>{user.display_name}</b>
                <small>
                  Lvl {user.level} · Streak {user.streak}
                </small>
              </span>
              <button className="logout" onClick={logout} title="Sign out" aria-label="Sign out">
                <svg viewBox="0 0 24 24">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <path d="M16 17l5-5-5-5M21 12H9" />
                </svg>
              </button>
            </div>
          ) : (
            <div className="guest">
              <Link className="signin" href="/login">
                Sign in
              </Link>
              <Link className="signup" href="/register">
                Create account
              </Link>
            </div>
          )}
        </aside>

        {/* MAIN */}
        <main className="main">
          <div className="topbar">
            <div className="search">
              <svg className="sic" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.2-3.2" />
              </svg>
              <input placeholder="Search shorts, topics, creators…" />
            </div>
            <button
              className="themeBtn"
              onClick={toggleTheme}
              title="Toggle light / dark"
              aria-label="Toggle theme"
            >
              <svg className="sun" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="4.5" />
                <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8" />
              </svg>
              <svg className="moon" viewBox="0 0 24 24">
                <path d="M20 14.5A8 8 0 0 1 9.5 4 7 7 0 1 0 20 14.5Z" />
              </svg>
            </button>
          </div>

          <div className="feedwrap">
            <h1>{copy.h}</h1>
            <p className="sub">{copy.s}</p>
            <div className="grid">
              {list.map((v, idx) => {
                const cls =
                  mode === 'all'
                    ? v.size || ''
                    : idx === 0
                    ? 'big'
                    : idx % 4 === 1
                    ? 'tall'
                    : '';
                const { label, cls: bcls } = badgeMeta(v);
                return (
                  <div
                    key={v.id}
                    className={`vcard ${cls}`}
                    style={{ backgroundImage: bg(v.image_id, v.category, idx, 800) }}
                    onClick={openPlayer}
                  >
                    <span className={`badge ${bcls}`}>{label}</span>
                    <span className="dur">{v.duration}</span>
                    <span className="play-ic" />
                    <b>{v.title}</b>
                    <small>
                      {v.creator_handle} ·{' '}
                      <button
                        className={`like ${v.liked ? 'liked' : ''}`}
                        onClick={(e) => like(e, v)}
                        title={user ? 'Like' : 'Sign in to like'}
                      >
                        <HeartIcon className="hic" /> {fmtLikes(v.likes_count)}
                      </button>
                    </small>
                  </div>
                );
              })}
            </div>
          </div>
        </main>
      </div>

      {/* PLAYER OVERLAY */}
      <div className={`player ${playerOpen ? 'show' : ''}`}>
        <button className="closeP" onClick={closePlayer}>
          <svg viewBox="0 0 24 24">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
        <div className="pswitch">
          <button className={playerMode === 'all' ? 'on' : ''} onClick={() => setPlayerMode('all')}>
            Mixed
          </button>
          <button className={playerMode === 'study' ? 'on' : ''} onClick={() => setPlayerMode('study')}>
            Study
          </button>
          <button className={playerMode === 'play' ? 'on' : ''} onClick={() => setPlayerMode('play')}>
            Fun
          </button>
        </div>
        <div className="reels">
          {reels.map((v, i) => {
            const { label, cls } = badgeMeta(v);
            return (
              <section className="reel" key={`${v.id}-${i}`}>
                <div className="stage" style={{ backgroundImage: bg(v.image_id, v.category, i, 900) }}>
                  <span className={`badge ${cls}`}>{label}</span>
                  <div className="actions">
                    <div className="a">
                      <HeartIcon />
                      <span>{fmtLikes(v.likes_count)}</span>
                    </div>
                    <div className="a">
                      <svg viewBox="0 0 24 24">
                        <path d="M4 5h16v11H8l-4 4Z" />
                      </svg>
                      <span>{(i + 2) * 3}h</span>
                    </div>
                    <div className="a">
                      <svg viewBox="0 0 24 24">
                        <path d="M6 4h12v16l-6-4-6 4Z" />
                      </svg>
                      <span>Save</span>
                    </div>
                    <div className="a">
                      <svg viewBox="0 0 24 24">
                        <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
                        <path d="M12 15V4M8 8l4-4 4 4" />
                      </svg>
                      <span>Share</span>
                    </div>
                  </div>
                  <h2>{v.title}</h2>
                  <p>
                    {v.category === 'study'
                      ? 'A 60-second lesson, made simple.'
                      : 'Made to make you smile.'}
                  </p>
                  <div className="creator">
                    <span className="av" />
                    {v.creator_handle} · Follow
                  </div>
                  <div className="progress">
                    <i />
                  </div>
                </div>
              </section>
            );
          })}
        </div>
        <div className="hint">
          <svg viewBox="0 0 24 24">
            <path d="M12 19V5M6 11l6-6 6 6" />
          </svg>{' '}
          Swipe up for more
        </div>
      </div>
    </>
  );
}
