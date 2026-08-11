export function getSupabaseUrl() {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  if (!value) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set. Pull it from the Vercel Supabase integration.');
  }
  // A trailing slash here becomes `//storage/v1/...`, which Storage rejects.
  return value.replace(/\/+$/, '');
}

export function getSupabasePublishableKey() {
  const value =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY;
  if (!value) {
    throw new Error('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not set. Pull it from the Vercel Supabase integration.');
  }
  return value;
}

export function getPostgresUrl() {
  // Prefer the Supabase Postgres URLs (VIDEO_WEB_*) over leftover Neon
  // POSTGRES_URL values from other integrations.
  const value =
    process.env.VIDEO_WEB_POSTGRES_URL_NON_POOLING ||
    process.env.VIDEO_WEB_POSTGRES_URL ||
    process.env.SUPABASE_DATABASE_URL ||
    process.env.SUPABASE_DB_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.POSTGRES_URL;
  if (!value) {
    throw new Error('POSTGRES_URL is not set. Pull it from the Vercel Supabase integration or add SUPABASE_DATABASE_URL.');
  }
  return value;
}
