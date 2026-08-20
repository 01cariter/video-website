export const WELCOME_CREDITS = 50;

// Representative default-model estimates for the Credits page only. Studio
// generation routes use the exact per-model quote in lib/studio/pricing.ts.
export const CREDIT_COSTS = {
  agent: 5,
  text: 1,
  image: 9,
  video480PerSecond: 16,
  video720PerSecond: 35,
  videoAudioPerSecond: 0,
} as const;

export type MeteredAiKind = 'agent' | 'text' | 'image' | 'video';

export function imageCreditCost(count: number) {
  return CREDIT_COSTS.image * Math.min(4, Math.max(1, Math.round(count)));
}

export function videoCreditCost(input: {
  duration: number;
  resolution: '480p' | '720p';
  generateAudio: boolean;
}) {
  const seconds = Math.min(30, Math.max(4, Math.round(input.duration)));
  const perSecond =
    input.resolution === '480p'
      ? CREDIT_COSTS.video480PerSecond
      : CREDIT_COSTS.video720PerSecond;
  return (
    seconds * perSecond +
    (input.generateAudio ? seconds * CREDIT_COSTS.videoAudioPerSecond : 0)
  );
}
