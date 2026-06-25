// ============================================================================
// Seed the Neon database with the migrated mock data.
// Usage:  npm run db:seed     (assumes the schema already exists)
//         npm run db:setup    (creates the schema first, then seeds)
//
// NOTE: users are managed by Neon Auth (the `neon_auth` schema). This script
// seeds business content only:
//   • demo author profiles (synthetic `seed_*` user ids)
//   • self-hosted SVG poster media (no Unsplash)
//   • videos authored by those profiles
// Likes / saves / follows / comments / projects start empty and are created by
// real signed-in users at runtime.
// ============================================================================
import { sql } from './_client.mjs';
import { authors, videos } from './mock-data.mjs';

// Build a self-contained SVG poster and return it as a `data:` URI so the image
// lives entirely inside our own database (no external CDN). Real uploads will
// replace these via POST /api/media.
function svgPoster({ w, h, c }, title, badge) {
  const [from, to] = c;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="0.4" y2="1">` +
    `<stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs>` +
    `<rect width="${w}" height="${h}" fill="url(#g)"/>` +
    `<circle cx="${w / 2}" cy="${h * 0.42}" r="${Math.min(w, h) * 0.13}" fill="rgba(255,255,255,0.92)"/>` +
    `<path d="M${w / 2 - 22} ${h * 0.42 - 30} L${w / 2 - 22} ${h * 0.42 + 30} L${w / 2 + 34} ${h * 0.42} Z" fill="${to}"/>` +
    (badge
      ? `<text x="${w * 0.06}" y="${h * 0.1}" fill="rgba(255,255,255,0.92)" font-family="Inter,system-ui,sans-serif" font-size="${Math.round(w * 0.035)}" font-weight="700" letter-spacing="3">${badge}</text>`
      : '') +
    `<text x="${w * 0.06}" y="${h * 0.9}" fill="#fff" font-family="Georgia,'Fraunces',serif" font-size="${Math.round(w * 0.06)}" font-weight="700">${escapeXml(title)}</text>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function escapeXml(s) {
  return String(s).replace(/[<>&'"]/g, (ch) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[ch])
  );
}

export async function seed() {
  console.log('  • Clearing existing rows…');
  await sql`
    TRUNCATE comments, video_saves, video_likes, follows, projects, videos, media, profiles
    RESTART IDENTITY CASCADE
  `;

  // ---- author profiles (real-user identities) ----
  console.log(`  • Inserting ${authors.length} author profiles…`);
  const handleToUserId = {};
  for (const a of authors) {
    const userId = `seed_${a.handle.replace(/^@/, '')}`;
    await sql`
      INSERT INTO profiles (user_id, handle, display_name, bio, avatar_color)
      VALUES (${userId}, ${a.handle}, ${a.display_name}, ${a.bio}, ${a.avatar_color})
    `;
    handleToUserId[a.handle] = userId;
  }

  // ---- videos (+ self-hosted SVG poster media) ----
  console.log(`  • Inserting ${videos.length} videos + posters…`);
  let i = 0;
  for (const v of videos) {
    const badge = v.label || (v.category === 'study' ? 'STUDY' : 'FUN');
    const posterUrl = svgPoster(v.poster, v.title, badge);

    const [media] = await sql`
      INSERT INTO media (kind, mime, url, width, height)
      VALUES ('image', 'image/svg+xml', ${posterUrl}, ${v.poster.w}, ${v.poster.h})
      RETURNING id
    `;

    const likes = (i + 3) * 7 * 1000; // mirrors the old "(idx+3)*7k" label
    await sql`
      INSERT INTO videos
        (title, description, category, label, size, author_id, poster_media_id, duration, likes_count, views_count)
      VALUES (
        ${v.title}, ${v.description ?? null}, ${v.category}, ${v.label ?? null}, ${v.size ?? ''},
        ${handleToUserId[v.author]}, ${media.id}, ${v.duration}, ${likes}, ${likes * 4}
      )
    `;
    i++;
  }

  console.log('  ✓ Seed complete. Sign up via Neon Auth to like, save, follow & comment.\n');
}

// Run when invoked directly (node db/seed.mjs).
if (import.meta.url === `file://${process.argv[1]}`) {
  seed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('  ✗ Seed failed:', err);
      process.exit(1);
    });
}
