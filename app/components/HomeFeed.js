'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AnimatePresence, motion } from 'motion/react';
import { authClient } from '@/lib/auth/client';
import { aspect, bg, fmtLikes, initials } from './media';

const FEED_COPY = {
  all: { h: 'Your feed', s: 'Tap any short to start — then just keep swiping.' },
  study: { h: 'Study feed', s: 'Quick lessons that actually stick.' },
  play: { h: 'Entertainment feed', s: 'Light, fun shorts for your break.' },
};

const SPRING = { type: 'spring', stiffness: 320, damping: 34, mass: 0.8 };

function Icon({ name, className }) {
  const paths = {
    heart: <path d="M12 20s-7-4.6-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.4-7 10-7 10Z" />,
    bookmark: <path d="M6 4h12v16l-6-4-6 4Z" />,
    comment: <path d="M4 5h16v11H8l-4 4Z" />,
    share: (
      <>
        <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
        <path d="M12 15V4M8 8l4-4 4 4" />
      </>
    ),
    close: <path d="M6 6l12 12M18 6 6 18" />,
    up: <path d="M12 19V5M6 11l6-6 6 6" />,
    down: <path d="M12 5v14M6 13l6 6 6-6" />,
    send: <path d="M4 12 20 4l-6 16-3-7-7-1Z" />,
  };
  return (
    <svg className={className} viewBox="0 0 24 24">
      {paths[name]}
    </svg>
  );
}

function badgeMeta(v) {
  const label = v.label || (v.category === 'study' ? 'STUDY' : 'FUN');
  const cls = v.label === 'SPORTS' ? 'sport' : v.category;
  return { label, cls };
}

function timeAgo(ts) {
  const d = (Date.now() - new Date(ts).getTime()) / 1000;
  if (d < 60) return 'now';
  if (d < 3600) return `${Math.floor(d / 60)}m`;
  if (d < 86400) return `${Math.floor(d / 3600)}h`;
  return `${Math.floor(d / 86400)}d`;
}

export default function HomeFeed({ user, initialVideos }) {
  const router = useRouter();
  const [videos, setVideos] = useState(initialVideos);
  const [mode, setMode] = useState('all');
  const [query, setQuery] = useState('');
  const [pending, setPending] = useState({});

  // Preview state
  const [openId, setOpenId] = useState(null);
  const [dir, setDir] = useState(0); // 1 = next, -1 = prev (drives slide direction)
  const [comments, setComments] = useState([]);
  const [cLoading, setCLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);

  const list = useMemo(() => {
    let l = mode === 'all' ? videos : videos.filter((v) => v.category === mode);
    const q = query.trim().toLowerCase();
    if (q) {
      l = l.filter(
        (v) =>
          v.title.toLowerCase().includes(q) ||
          (v.author_handle || '').toLowerCase().includes(q) ||
          (v.author_name || '').toLowerCase().includes(q)
      );
    }
    return l;
  }, [videos, mode, query]);

  const openIndex = useMemo(() => list.findIndex((v) => v.id === openId), [list, openId]);
  const current = openIndex >= 0 ? list[openIndex] : null;

  // ---- helpers to patch local state ----
  const patchVideo = useCallback((id, patch) => {
    setVideos((vs) => vs.map((v) => (v.id === id ? { ...v, ...patch } : v)));
  }, []);
  const patchAuthor = useCallback((authorId, patch) => {
    setVideos((vs) => vs.map((v) => (v.author_id === authorId ? { ...v, ...patch } : v)));
  }, []);

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

  async function logout() {
    await authClient.signOut();
    router.refresh();
  }

  const needAuth = useCallback(() => {
    router.push('/login?next=/');
  }, [router]);

  // ---- social actions ----
  async function act(url, body) {
    const res = await fetch(url, {
      method: 'POST',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 401) {
      needAuth();
      return null;
    }
    return res.ok ? res.json() : null;
  }

  async function like(e, v) {
    e?.stopPropagation();
    if (!user) return needAuth();
    if (pending[`l${v.id}`]) return;
    setPending((p) => ({ ...p, [`l${v.id}`]: true }));
    const data = await act(`/api/videos/${v.id}/like`);
    if (data) patchVideo(v.id, { liked: data.liked, likes_count: data.likes_count });
    setPending((p) => ({ ...p, [`l${v.id}`]: false }));
  }

  async function save(e, v) {
    e?.stopPropagation();
    if (!user) return needAuth();
    if (pending[`s${v.id}`]) return;
    setPending((p) => ({ ...p, [`s${v.id}`]: true }));
    const data = await act(`/api/videos/${v.id}/save`);
    if (data) patchVideo(v.id, { saved: data.saved, saves_count: data.saves_count });
    setPending((p) => ({ ...p, [`s${v.id}`]: false }));
  }

  async function follow(e, v) {
    e?.stopPropagation();
    if (!user) return needAuth();
    if (pending[`f${v.author_id}`]) return;
    setPending((p) => ({ ...p, [`f${v.author_id}`]: true }));
    const data = await act(`/api/authors/${encodeURIComponent(v.author_id)}/follow`);
    if (data) patchAuthor(v.author_id, { following: data.following, author_followers: data.followers_count });
    setPending((p) => ({ ...p, [`f${v.author_id}`]: false }));
  }

  async function postComment(e) {
    e.preventDefault();
    if (!user) return needAuth();
    const body = draft.trim();
    if (!body || !current || posting) return;
    setPosting(true);
    const data = await act(`/api/videos/${current.id}/comments`, { body });
    if (data) {
      setComments((cs) => [data.comment, ...cs]);
      patchVideo(current.id, { comments_count: data.comments_count });
      setDraft('');
    }
    setPosting(false);
  }

  // ---- preview open/close/nav ----
  const loadComments = useCallback(async (id) => {
    setCLoading(true);
    try {
      const res = await fetch(`/api/videos/${id}`);
      if (res.ok) {
        const data = await res.json();
        setComments(data.comments || []);
        if (data.video) patchVideo(id, data.video);
      }
    } finally {
      setCLoading(false);
    }
  }, [patchVideo]);

  function openPreview(v) {
    setDir(0);
    setOpenId(v.id);
    setDraft('');
    setComments([]);
    loadComments(v.id);
  }
  const closePreview = useCallback(() => {
    setOpenId(null);
  }, []);

  // Lock background scroll while the preview is open.
  useEffect(() => {
    document.body.style.overflow = openId ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [openId]);

  const go = useCallback(
    (delta) => {
      if (openIndex < 0) return;
      const next = openIndex + delta;
      if (next < 0 || next >= list.length) return;
      const target = list[next];
      setDir(delta);
      setOpenId(target.id);
      setDraft('');
      setComments([]);
      loadComments(target.id);
    },
    [openIndex, list, loadComments]
  );

  // keyboard nav for the preview
  useEffect(() => {
    if (!current) return undefined;
    function onKey(e) {
      if (e.key === 'Escape') closePreview();
      else if (e.key === 'ArrowDown') go(1);
      else if (e.key === 'ArrowUp') go(-1);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current, go, closePreview]);

  const copy = FEED_COPY[mode];

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
              <input
                placeholder="Search shorts, topics, creators…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
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
                  mode === 'all' ? v.size || '' : idx === 0 ? 'big' : idx % 4 === 1 ? 'tall' : '';
                const { label, cls: bcls } = badgeMeta(v);
                return (
                  <motion.div
                    key={v.id}
                    layoutId={`card-${v.id}`}
                    className={`vcard ${cls}`}
                    style={{ backgroundImage: bg(v.poster_url, v.category, idx) }}
                    onClick={() => openPreview(v)}
                    whileHover={{ y: -2 }}
                    transition={SPRING}
                  >
                    <span className={`badge ${bcls}`}>{label}</span>
                    <span className="dur">{v.duration}</span>
                    <span className="play-ic" />
                    <b>{v.title}</b>
                    <small>
                      {v.author_handle} ·{' '}
                      <button
                        className={`like ${v.liked ? 'liked' : ''}`}
                        onClick={(e) => like(e, v)}
                        title={user ? 'Like' : 'Sign in to like'}
                      >
                        <Icon name="heart" className="hic" /> {fmtLikes(v.likes_count)}
                      </button>
                    </small>
                  </motion.div>
                );
              })}
            </div>
            {list.length === 0 && <p className="empty">No shorts match “{query}”.</p>}
          </div>
        </main>
      </div>

      {/* MOTION PREVIEW */}
      <AnimatePresence>
        {current && (
          <motion.div
            className="pv-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closePreview}
          >
            <button className="pv-close" onClick={closePreview} aria-label="Close">
              <Icon name="close" />
            </button>

            {/* nav arrows */}
            <button
              className="pv-nav up"
              disabled={openIndex <= 0}
              onClick={(e) => {
                e.stopPropagation();
                go(-1);
              }}
              aria-label="Previous"
            >
              <Icon name="up" />
            </button>
            <button
              className="pv-nav down"
              disabled={openIndex >= list.length - 1}
              onClick={(e) => {
                e.stopPropagation();
                go(1);
              }}
              aria-label="Next"
            >
              <Icon name="down" />
            </button>

            <div className="pv-shell" onClick={(e) => e.stopPropagation()}>
              {/* STAGE — animates from the clicked card, sized to the clip's
                  natural aspect ratio (fits original size). */}
              <motion.div
                layoutId={`card-${current.id}`}
                className="pv-stage"
                transition={SPRING}
                style={{
                  aspectRatio: aspect(current.video_w || current.poster_w, current.video_h || current.poster_h),
                  backgroundImage: current.video_url ? undefined : bg(current.poster_url, current.category, openIndex),
                }}
              >
                {current.video_url && (
                  <video
                    className="pv-video"
                    src={current.video_url}
                    poster={current.poster_url || undefined}
                    autoPlay
                    loop
                    muted
                    playsInline
                  />
                )}
                <span className={`badge ${badgeMeta(current).cls}`}>{badgeMeta(current).label}</span>

                <motion.div
                  className="pv-meta"
                  key={current.id}
                  custom={dir}
                  initial={{ y: dir === 0 ? 12 : dir * 40, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.06, ...SPRING }}
                >
                  <h2>{current.title}</h2>
                  {current.description && <p>{current.description}</p>}
                  <div className="pv-author">
                    <span className="av" style={{ background: current.author_color }}>
                      {initials(current.author_name)}
                    </span>
                    <span className="who">
                      <b>{current.author_name}</b>
                      <small>
                        {current.author_handle} · {fmtLikes(current.author_followers)} followers
                      </small>
                    </span>
                    {user && current.author_id === user.id ? (
                      <span className="own">You</span>
                    ) : (
                      <button
                        className={`followBtn ${current.following ? 'on' : ''}`}
                        onClick={(e) => follow(e, current)}
                      >
                        {current.following ? 'Following' : 'Follow'}
                      </button>
                    )}
                  </div>
                </motion.div>

                <div className="progress">
                  <i />
                </div>
              </motion.div>

              {/* ACTION RAIL */}
              <div className="pv-rail">
                <button
                  className={`a ${current.liked ? 'on like' : ''}`}
                  onClick={(e) => like(e, current)}
                >
                  <Icon name="heart" />
                  <span>{fmtLikes(current.likes_count)}</span>
                </button>
                <button
                  className={`a ${current.saved ? 'on save' : ''}`}
                  onClick={(e) => save(e, current)}
                >
                  <Icon name="bookmark" />
                  <span>{fmtLikes(current.saves_count)}</span>
                </button>
                <div className="a static">
                  <Icon name="comment" />
                  <span>{fmtLikes(current.comments_count)}</span>
                </div>
                <button
                  className="a"
                  onClick={() => navigator?.clipboard?.writeText(`${location.origin}/?v=${current.id}`)}
                  title="Copy link"
                >
                  <Icon name="share" />
                  <span>Share</span>
                </button>
              </div>

              {/* COMMENTS */}
              <motion.aside
                className="pv-comments"
                initial={{ opacity: 0, x: 18 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05, ...SPRING }}
              >
                <header>
                  <b>Comments</b>
                  <span>{fmtLikes(current.comments_count)}</span>
                </header>
                <div className="clist">
                  {cLoading && <p className="cmuted">Loading…</p>}
                  {!cLoading && comments.length === 0 && (
                    <p className="cmuted">Be the first to comment.</p>
                  )}
                  {comments.map((c) => (
                    <div className="citem" key={c.id}>
                      <span className="cav" style={{ background: c.author_color || '#888' }}>
                        {initials(c.author_name)}
                      </span>
                      <div className="cbody">
                        <b>
                          {c.author_name}{' '}
                          <small>
                            {c.author_handle ? `${c.author_handle} · ` : ''}
                            {timeAgo(c.created_at)}
                          </small>
                        </b>
                        <p>{c.body}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <form className="cform" onSubmit={postComment}>
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={user ? 'Add a comment…' : 'Sign in to comment'}
                    onFocus={() => !user && needAuth()}
                  />
                  <button type="submit" disabled={posting || !draft.trim()} aria-label="Send">
                    <Icon name="send" />
                  </button>
                </form>
              </motion.aside>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
