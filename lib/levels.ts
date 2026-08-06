// What a level on Snackd actually means.
//
// `profiles.level` was a column nothing ever wrote to, so every account showed
// "Lvl 1" no matter what it had done. XP is counted from real rows instead —
// posts you published, and what other people did with them — and the level
// falls out of the XP.
//
// Client-safe: no server-only imports, so the profile can explain itself.

export const XP_PER_POST = 10;
export const XP_PER_LIKE = 2;
export const XP_PER_SAVE = 3;

// Level n starts at 25 * n * (n - 1) XP: 0, 50, 150, 300, 500, 750 ...
// Each level costs 50 XP more than the one before it, so early levels come
// quickly and later ones need a body of work rather than a single hit.
const STEP = 25;

export function levelFromXp(xp: number) {
  const safe = Math.max(0, Math.floor(xp) || 0);
  // Invert 25n(n-1) <= xp for the largest whole n.
  return Math.floor((1 + Math.sqrt(1 + (4 * safe) / STEP)) / 2);
}

export function xpForLevel(level: number) {
  const n = Math.max(1, Math.floor(level) || 1);
  return STEP * n * (n - 1);
}

export function levelProgress(xp: number) {
  const level = levelFromXp(xp);
  const floor = xpForLevel(level);
  const ceiling = xpForLevel(level + 1);
  return {
    level,
    xp,
    into: xp - floor,
    needed: ceiling - floor,
    remaining: ceiling - xp,
    fraction: (xp - floor) / (ceiling - floor),
  };
}

export const LEVEL_RULE =
  `${XP_PER_POST} XP a post, ${XP_PER_LIKE} XP a like, ${XP_PER_SAVE} XP a save`;
