// ============================================================================
// Seed the Neon database with the migrated mock data.
// Usage:  npm run db:seed     (assumes the schema already exists)
//         npm run db:setup    (creates the schema first, then seeds)
//
// NOTE: users are managed by Neon Auth (the `neon_auth` schema), so this script
// only seeds business content (creators + videos). Likes and projects start
// empty and are created by real signed-in users at runtime.
// ============================================================================
import { sql } from './_client.mjs';
import { creators, videos } from './mock-data.mjs';

export async function seed() {
  console.log('  • Clearing existing rows…');
  await sql`TRUNCATE video_likes, projects, videos, creators, profiles RESTART IDENTITY CASCADE`;

  // ---- creators ----
  console.log(`  • Inserting ${creators.length} creators…`);
  const handleToId = {};
  for (const c of creators) {
    const [row] = await sql`
      INSERT INTO creators (handle, display_name)
      VALUES (${c.handle}, ${c.display_name})
      RETURNING id, handle
    `;
    handleToId[row.handle] = row.id;
  }

  // ---- videos ----
  console.log(`  • Inserting ${videos.length} videos…`);
  let i = 0;
  for (const v of videos) {
    const likes = (i + 3) * 7 * 1000; // mirrors the old "(idx+3)*7k" label
    await sql`
      INSERT INTO videos (title, category, label, size, creator_id, image_id, duration, likes_count)
      VALUES (
        ${v.title}, ${v.category}, ${v.label ?? null}, ${v.size ?? ''},
        ${handleToId[v.creator]}, ${v.image_id}, ${v.duration}, ${likes}
      )
    `;
    i++;
  }

  console.log('  ✓ Seed complete. Sign up via Neon Auth to start liking & creating.\n');
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
