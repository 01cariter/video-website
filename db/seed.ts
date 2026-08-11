import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sql } from './_client';
import { authors, videos, type SeedVideo } from './mock-data';

function svgPoster({ w, h, c }: SeedVideo['poster'], title: string, badge: string) {
  const [from, to] = c;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="0.4" y2="1">` +
    `<stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs>` +
    `<rect width="${w}" height="${h}" fill="url(#g)"/>` +
    `<text x="${w * 0.06}" y="${h * 0.1}" fill="rgba(255,255,255,0.92)" font-family="Inter,system-ui,sans-serif" font-size="${Math.round(w * 0.035)}" font-weight="700" letter-spacing="3">${badge}</text>` +
    `<text x="${w * 0.06}" y="${h * 0.9}" fill="#fff" font-family="Georgia,'Fraunces',serif" font-size="${Math.round(w * 0.06)}" font-weight="700">${escapeXml(title)}</text>` +
    '</svg>';
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function escapeXml(value: string) {
  const entities: Record<string, string> = {
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    "'": '&apos;',
    '"': '&quot;',
  };
  return value.replace(/[<>&'"]/g, (character) => entities[character] || character);
}

export async function seed() {
  console.log('  Clearing existing rows...');
  await sql`
    TRUNCATE comments, video_saves, video_likes, follows, videos, media, profiles
    RESTART IDENTITY CASCADE
  `;

  console.log(`  Inserting ${authors.length} author profiles...`);
  const handleToUserId: Record<string, string> = {};
  for (const author of authors) {
    const userId = `seed_${author.handle.replace(/^@/, '')}`;
    await sql`
      INSERT INTO profiles (user_id, handle, display_name, bio, avatar_color)
      VALUES (${userId}, ${author.handle}, ${author.display_name}, ${author.bio}, ${author.avatar_color})
    `;
    handleToUserId[author.handle] = userId;
  }

  console.log(`  Inserting ${videos.length} videos and posters...`);
  for (const [index, video] of videos.entries()) {
    const badge = video.label || (video.category === 'study' ? 'STUDY' : 'FUN');
    const posterUrl = svgPoster(video.poster, video.title, badge);
    const [media] = await sql<{ id: number }[]>`
      INSERT INTO media (kind, mime, url, width, height)
      VALUES ('image', 'image/svg+xml', ${posterUrl}, ${video.poster.w}, ${video.poster.h})
      RETURNING id
    `;
    if (!media) throw new Error(`Could not create poster for ${video.title}.`);

    const authorId = handleToUserId[video.author];
    if (!authorId) throw new Error(`Missing seed author ${video.author}.`);
    const likes = (index + 3) * 7000;
    const [row] = await sql<{ id: number }[]>`
      INSERT INTO videos
        (title, description, category, label, size, author_id, poster_media_id, duration, likes_count, views_count)
      VALUES (
        ${video.title}, ${video.description}, ${video.category}, ${video.label ?? null}, ${video.size},
        ${authorId}, ${media.id}, ${video.duration}, ${likes}, ${likes * 4}
      )
      RETURNING id
    `;
    if (row) {
      await sql`
        INSERT INTO video_assets (video_id, media_id, position)
        VALUES (${row.id}, ${media.id}, 0)
        ON CONFLICT DO NOTHING
      `;
    }
  }

  console.log('  Seed complete.\n');
}

if (fileURLToPath(import.meta.url) === resolve(process.argv[1] || '')) {
  seed()
    .then(() => process.exit(0))
    .catch((error: unknown) => {
      console.error('  Seed failed:', error);
      process.exit(1);
    });
}
