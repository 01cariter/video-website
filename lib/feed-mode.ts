import type { VideoCategory } from './types';

export type ApiFeedMode = 'foryou' | 'following';

export function parseFeedQuery(input: {
  mode: string | null;
  category: string | null;
}): { mode: ApiFeedMode; category: VideoCategory | null } {
  const mode = input.mode === 'following' ? 'following' : 'foryou';
  const category =
    input.category === 'study' || input.category === 'play' ? input.category : null;
  // Following ignores category.
  if (mode === 'following') return { mode, category: null };
  return { mode, category };
}
