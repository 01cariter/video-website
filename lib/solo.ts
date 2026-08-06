// The Solo studio URL, resolved the same way for the /create page and for the
// overlay the feed opens. Client-safe: NEXT_PUBLIC_ vars are inlined at build.

export const DEFAULT_SOLO_URL = 'https://work-solo.ai/';

export function getSoloUrl() {
  return process.env.NEXT_PUBLIC_SOLO_URL || DEFAULT_SOLO_URL;
}
