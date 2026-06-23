// Shared visual helpers (client-safe — no server-only imports).
// Mirrors the gradients + Unsplash CDN sizing used in the original static design.

const palettes = {
  study: [['#3f6b78', '#2e5562'], ['#4a7a6a', '#37604f'], ['#52708f', '#3c5470'], ['#5f7d78', '#445b56']],
  play: [['#a8542f', '#7e3c20'], ['#b06a3a', '#8a4e25'], ['#a85f4f', '#7e4135'], ['#b07f3f', '#85591f']],
};

export function grad(kind, i) {
  const set = palettes[kind] || palettes.study;
  const p = set[i % set.length];
  return `linear-gradient(160deg,${p[0]},${p[1]})`;
}

// Real Unsplash photo, sized via CDN params; gradient stays as a fallback.
export function ux(id, w) {
  return `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w || 640}&q=70`;
}

export function bg(imageId, kind, i, w) {
  return `url('${ux(imageId, w)}'),${grad(kind, i)}`;
}

export function fmtLikes(n) {
  const v = Number(n) || 0;
  if (v >= 1000) return `${Math.round(v / 1000)}k`;
  return String(v);
}

export function initials(name) {
  return (name || '?').trim().charAt(0).toUpperCase();
}
