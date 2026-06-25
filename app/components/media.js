// Shared visual helpers (client-safe — no server-only imports).
// Imagery is now self-hosted (the `media` table). Gradients remain as a graceful
// fallback while a clip has no poster yet. No external CDN / Unsplash.

const palettes = {
  study: [['#3f6b78', '#2e5562'], ['#4a7a6a', '#37604f'], ['#52708f', '#3c5470'], ['#5f7d78', '#445b56']],
  play: [['#a8542f', '#7e3c20'], ['#b06a3a', '#8a4e25'], ['#a85f4f', '#7e4135'], ['#b07f3f', '#85591f']],
};

export function grad(kind, i) {
  const set = palettes[kind] || palettes.study;
  const p = set[i % set.length];
  return `linear-gradient(160deg,${p[0]},${p[1]})`;
}

// CSS background built from a self-hosted poster URL (data: URI or /api/media),
// with the gradient kept underneath as a fallback.
export function bg(posterUrl, kind, i) {
  if (posterUrl) return `url("${posterUrl}"),${grad(kind, i)}`;
  return grad(kind, i);
}

// CSS `aspect-ratio` string from intrinsic media size, so the player fits the
// clip's original dimensions instead of a fixed box.
export function aspect(w, h, fallback = '9 / 16') {
  const W = Number(w);
  const H = Number(h);
  if (W > 0 && H > 0) return `${W} / ${H}`;
  return fallback;
}

export function fmtLikes(n) {
  const v = Number(n) || 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, '')}m`;
  if (v >= 1000) return `${Math.round(v / 1000)}k`;
  return String(v);
}

export function initials(name) {
  return (name || '?').trim().charAt(0).toUpperCase();
}
