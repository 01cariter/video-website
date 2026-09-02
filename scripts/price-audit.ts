/**
 * Prints the Studio credit economics so pricing can be reviewed as a whole:
 * upstream cost, credits charged, and what the reader actually paid for those
 * credits at each pack. Run with `npm run audit:pricing`.
 */
import {
  DEFAULT_STUDIO_MARKUP_BPS,
  DEFAULT_STUDIO_RUNTIME_CONFIG,
  USD_MICROS_PER_CREDIT,
  estimateStudioCredits,
} from '@/lib/studio/pricing';
import { STUDIO_MODEL_SPECS, STUDIO_MODELS } from '@/lib/studio/model-catalog';
import { customCreditPriceCents } from '@/lib/credits/packages';
import { CREDIT_COSTS, WELCOME_CREDITS } from '@/lib/credits/config';
import type { StudioGenerativeKind } from '@/lib/studio/types';

const PACKS = [
  { id: 'credits-10 (Light)', credits: 10, cents: 99 },
  { id: 'credits-100 (Start)', credits: 100, cents: 299 },
  { id: 'credits-1000 (Create)', credits: 1000, cents: 1799 },
  { id: 'credits-5000 (Studio)', credits: 5000, cents: 6999 },
];
const perCredit = (p: { credits: number; cents: number }) =>
  p.cents / 100 / p.credits;
const CHEAPEST = perCredit(PACKS[3]);
const DEAREST = perCredit(PACKS[0]);

function quote(
  kind: StudioGenerativeKind,
  modelId: string,
  parameters: Record<string, unknown>,
) {
  return estimateStudioCredits({
    kind,
    modelId: modelId as never,
    parameters,
    prompt: 'A cinematic shot of a red fox in snow at dawn',
    runtime: DEFAULT_STUDIO_RUNTIME_CONFIG,
  });
}

function row(cells: Array<string | number>) {
  console.log(cells.join('\t'));
}

console.log(
  `\n1 credit face value $${USD_MICROS_PER_CREDIT / 1e6} · default markup ${
    DEFAULT_STUDIO_MARKUP_BPS / 100
  }% · welcome grant ${WELCOME_CREDITS} credits\n`,
);

console.log('== PACKS ==');
row(['pack', 'credits', 'price', '$/credit', 'x face', 'same credits via slider']);
for (const pack of PACKS) {
  row([
    pack.id,
    pack.credits,
    `$${(pack.cents / 100).toFixed(2)}`,
    `$${perCredit(pack).toFixed(4)}`,
    `${(perCredit(pack) / 0.01).toFixed(2)}x`,
    pack.credits >= 100
      ? `$${(customCreditPriceCents(pack.credits) / 100).toFixed(2)}`
      : 'n/a',
  ]);
}

console.log('\n== PER JOB, EACH MODEL AT ITS OWN DEFAULTS ==');
row([
  'kind',
  'model',
  'defaults',
  'upstream$',
  'credits',
  'paid@Studio',
  'paid@Light',
  'margin@Studio',
  'welcome grant buys',
]);
for (const [id, spec] of Object.entries(STUDIO_MODEL_SPECS)) {
  const kind = spec.kind as StudioGenerativeKind;
  if (kind !== 'image' && kind !== 'video' && kind !== 'text') continue;
  const q = quote(kind, id, spec.defaults);
  const upstream = q.upstreamUsdMicros / 1e6;
  const paid = q.credits * CHEAPEST;
  row([
    kind,
    `${spec.label}${STUDIO_MODELS[kind].id === id ? ' *' : ''}`,
    Object.entries(spec.defaults)
      .filter(([key]) => key !== 'aspect')
      .map(([key, value]) => `${key}=${value}`)
      .join(' '),
    `$${upstream.toFixed(4)}`,
    q.credits,
    `$${paid.toFixed(3)}`,
    `$${(q.credits * DEAREST).toFixed(3)}`,
    `${(((paid - upstream) / paid) * 100).toFixed(0)}%`,
    Math.floor(WELCOME_CREDITS / q.credits),
  ]);
}

console.log('\n== VIDEO: CREDITS PER SECOND ==');
row(['model', 'resolution', 'audio', 'upstream$/s', 'credits/s', 'clip', 'reader pays (Studio–Light)']);
for (const [id, spec] of Object.entries(STUDIO_MODEL_SPECS)) {
  if (spec.kind !== 'video') continue;
  const resolutions =
    (spec.fields.find((f) => f.key === 'videoResolution') as
      | { options: Array<{ id: string }> }
      | undefined)?.options.map((option) => option.id) ?? [];
  const supportsAudio = spec.fields.some((f) => f.key === 'generateAudio');
  const durationField = spec.fields.find((f) => f.key === 'duration') as
    | { min: number; max: number }
    | undefined;
  const shortest = durationField?.min ?? 8;
  for (const resolution of resolutions) {
    for (const audio of supportsAudio ? [false, true] : [false]) {
      // 8s where the model allows it, so every row compares like for like.
      let seconds = 8;
      let clip;
      try {
        clip = quote('video', id, {
          ...spec.defaults,
          duration: seconds,
          videoResolution: resolution,
          generateAudio: audio,
        });
      } catch {
        seconds = shortest;
        try {
          clip = quote('video', id, {
            ...spec.defaults,
            duration: seconds,
            videoResolution: resolution,
            generateAudio: audio,
          });
        } catch (error) {
          row([spec.label, resolution, String(audio), `— ${(error as Error).message}`]);
          continue;
        }
      }
      row([
        spec.label,
        resolution,
        supportsAudio ? (audio ? 'audio' : 'silent') : '—',
        `$${(clip.upstreamUsdMicros / 1e6 / seconds).toFixed(3)}`,
        (clip.credits / seconds).toFixed(1),
        `${seconds}s: ${clip.credits} cr`,
        `$${(clip.credits * CHEAPEST).toFixed(2)} – $${(clip.credits * DEAREST).toFixed(2)}`,
      ]);
    }
  }
}

console.log('\n== CREDITS PAGE HEADLINE FIGURES vs THE REAL QUOTE ==');
row(['headline', 'advertised', 'actual']);
row([
  'agent step',
  CREDIT_COSTS.agent,
  CREDIT_COSTS.agent,
]);
row([
  'text block',
  CREDIT_COSTS.text,
  quote('text', STUDIO_MODELS.text.id, STUDIO_MODELS.text.defaults).credits,
]);
row([
  'image',
  CREDIT_COSTS.image,
  quote('image', STUDIO_MODELS.image.id, { ...STUDIO_MODELS.image.defaults, n: 1 })
    .credits,
]);
const defaultClip = quote(
  'video',
  STUDIO_MODELS.video.id,
  STUDIO_MODELS.video.defaults,
);
row([
  `video /s (${CREDIT_COSTS.videoModelLabel} ${CREDIT_COSTS.videoResolution})`,
  CREDIT_COSTS.videoPerSecond,
  (defaultClip.credits / Number(STUDIO_MODELS.video.defaults.duration)).toFixed(1),
]);
row(['default clip', CREDIT_COSTS.videoClip, defaultClip.credits]);
row([
  'welcome grant buys',
  `${WELCOME_CREDITS} cr`,
  `${Math.floor(WELCOME_CREDITS / CREDIT_COSTS.image)} images · ${Math.floor(
    WELCOME_CREDITS / CREDIT_COSTS.videoClip,
  )} clips`,
]);
