'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { ux, bg } from '../components/media';

const TEMPLATES = [
  { t: '60-second explainer', k: 'study', img: '1509228468518-180dd4864904' },
  { t: 'Comedy skit', k: 'play', img: '1543007630-9710e4a00a20' },
  { t: 'Sports highlight reel', k: 'play', img: '1546519638-68e109498ffc' },
  { t: 'Lo-fi study loop', k: 'study', img: '1511671782779-c97d3d27a1d4' },
  { t: 'Oddly satisfying', k: 'play', img: '1530026405186-ed1f139313f8' },
  { t: 'History deep-dive', k: 'study', img: '1509316785289-025f5b846b35' },
];

const CHIPS = [
  { id: 'auto', label: 'Auto', path: 'M12 3l2.1 4.8L19 9l-3.6 3.3L16.4 18 12 15.4 7.6 18l1-5.7L5 9l4.9-1.2Z' },
  { id: 'storyboard', label: 'Storyboard', path: 'M4 6h16M4 12h10M4 18h7' },
  { id: 'inspiration', label: 'Inspiration', path: null },
  { id: 'lesson', label: 'Lesson', path: null },
];

const RESULT_POOL = [
  '1536440136628-849c177e76a1',
  '1492619375914-88005aa9e8fb',
  '1518709268805-4e9042af9f23',
  '1535016120720-40c646be5580',
  '1478720568477-152d9b164e26',
  '1550745165-9bc0b252726f',
  '1492551557933-34265f7af79e',
  '1579546929518-9e396f3cc809',
];

function timeAgo(iso) {
  if (!iso) return 'just now';
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3.6e6);
  if (h < 1) return 'just now';
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function CreateStudio({ projects }) {
  const [prompt, setPrompt] = useState('');
  const [chip, setChip] = useState('auto');
  const [results, setResults] = useState(null); // null | 'loading' | string[]
  const [generating, setGenerating] = useState(false);
  const taRef = useRef(null);

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

  function applyTemplate(name) {
    setPrompt(`Make a "${name}" short about `);
    taRef.current?.focus();
  }

  function generate() {
    if (!prompt.trim()) {
      taRef.current?.focus();
      return;
    }
    setGenerating(true);
    setResults('loading');
    setTimeout(() => {
      const pool = [...RESULT_POOL].sort(() => Math.random() - 0.5).slice(0, 4);
      setResults(pool);
      setGenerating(false);
    }, 1500);
  }

  return (
    <>
      <header className="shead">
        <div className="left">
          <Link className="back" href="/">
            <svg viewBox="0 0 24 24">
              <path d="M15 18l-6-6 6-6" />
            </svg>{' '}
            Back
          </Link>
          <div className="stitle">
            <span className="mark" />
            <span>Create studio</span>
          </div>
        </div>
        <button className="themeBtn" onClick={toggleTheme} title="Toggle light / dark" aria-label="Toggle theme">
          <svg className="sun" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="4.5" />
            <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8" />
          </svg>
          <svg className="moon" viewBox="0 0 24 24">
            <path d="M20 14.5A8 8 0 0 1 9.5 4 7 7 0 1 0 20 14.5Z" />
          </svg>
        </button>
      </header>

      <div className="swrap">
        <h1 className="lead-h">What should we make?</h1>
        <p className="leadsub">Describe a short, pick a template, or pick up where you left off.</p>

        {/* composer */}
        <div className="composer">
          <div className="row1">
            <div className="thumb" title="Add a reference image">
              <svg viewBox="0 0 24 24">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </div>
            <textarea
              ref={taRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the short you want to make — a topic, a style, or @mention a creator to remix…"
            />
          </div>
          <div className="row2">
            {CHIPS.map((c) => (
              <button
                key={c.id}
                className={`chip ${chip === c.id ? 'on' : ''}`}
                onClick={() => setChip(c.id)}
              >
                {c.id === 'inspiration' ? (
                  <svg viewBox="0 0 24 24">
                    <circle cx="11" cy="11" r="7" />
                    <path d="m20 20-3.2-3.2" />
                  </svg>
                ) : c.id === 'lesson' ? (
                  <svg viewBox="0 0 24 24">
                    <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H12v15.5H5.5A1.5 1.5 0 0 1 4 18Z" />
                    <path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H12v15.5h6.5A1.5 1.5 0 0 0 20 18Z" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24">
                    <path d={c.path} />
                  </svg>
                )}{' '}
                {c.label}
              </button>
            ))}
            <button className="go" onClick={generate} disabled={generating} title="Generate">
              {generating ? (
                <svg viewBox="0 0 24 24" style={{ animation: 'spin .8s linear infinite' }}>
                  <path d="M12 3a9 9 0 1 0 9 9" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* results gallery */}
        {results && (
          <div className="results show">
            <div className="rcap">
              <span className="dot" />
              <span>{results === 'loading' ? 'Generating 4 takes…' : '4 takes ready — tap one to refine'}</span>
            </div>
            <div className="grid4">
              {results === 'loading'
                ? [0, 1, 2, 3].map((i) => <div className="rimg skel" key={i} />)
                : results.map((id) => (
                    <div
                      className="rimg"
                      key={id}
                      style={{ backgroundImage: `url('${ux(id, 500)}')` }}
                      title="Use this take"
                    />
                  ))}
            </div>
          </div>
        )}

        {/* quick start */}
        <div className="slabel">Quick start</div>
        <div className="qstart">
          {TEMPLATES.map((t) => (
            <div
              key={t.t}
              className="qcard"
              style={{ backgroundImage: bg(t.img, t.k, 0, 640) }}
              onClick={() => applyTemplate(t.t)}
            >
              <b>
                <svg viewBox="0 0 24 24">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
                {t.t}
              </b>
            </div>
          ))}
        </div>

        {/* recent projects */}
        <div className="slabel">Recent projects</div>
        <div className="recent">
          <div className="rcard new" onClick={() => { setPrompt(''); taRef.current?.focus(); }}>
            <div className="thumb2">
              <svg viewBox="0 0 24 24">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </div>
            <div className="rname">New project</div>
            <div className="rmeta">Start from scratch</div>
          </div>

          {projects.map((p) => {
            const imgs = p.image_ids || [];
            let inner;
            if (!imgs.length) {
              inner = (
                <div className="thumb2">
                  <svg viewBox="0 0 24 24">
                    <rect x="4" y="4" width="16" height="16" rx="3" />
                    <path d="M4 14l4-4 4 4 4-4 4 4" />
                  </svg>
                </div>
              );
            } else if (imgs.length >= 4) {
              inner = (
                <div className="thumb2">
                  <div className="quad">
                    {imgs.slice(0, 4).map((im) => (
                      <span key={im} style={{ backgroundImage: `url('${ux(im, 300)}')` }} />
                    ))}
                  </div>
                </div>
              );
            } else {
              inner = <div className="thumb2" style={{ backgroundImage: `url('${ux(imgs[0], 400)}')` }} />;
            }
            const metaStatus = p.status === 'draft' ? 'Empty' : 'Storyboard';
            return (
              <div className="rcard" key={p.id} onClick={() => setPrompt(`Continue editing: ${p.name}`)}>
                {inner}
                <div className="rname">{p.name}</div>
                <div className="rmeta">
                  {metaStatus} · {timeAgo(p.created_at)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
