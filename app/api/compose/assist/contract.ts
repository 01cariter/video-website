import { z } from 'zod';

export const COMPOSE_ASSIST_MAX_OUTPUT_TOKENS = 768;
const MAX_CONTEXT_BODY_LENGTH = 2_400;

export const composeCopySchema = z.object({
  title: z
    .string()
    .min(1)
    .max(120)
    .describe('A specific, natural headline with no hashtags.'),
  body: z
    .string()
    .min(1)
    .max(1_800)
    .describe('Polished post copy that preserves the source language.'),
});

export interface ComposeAssistBody {
  mode?: 'quote' | 'generate';
  title?: unknown;
  body?: unknown;
  imageCount?: unknown;
  videoCount?: unknown;
  expectedCredits?: unknown;
  requestId?: unknown;
}

export function normalizeComposeSource(body: ComposeAssistBody) {
  return {
    title:
      typeof body.title === 'string' ? body.title.trim().slice(0, 120) : '',
    body:
      typeof body.body === 'string'
        ? body.body.trim().slice(0, MAX_CONTEXT_BODY_LENGTH)
        : '',
    imageCount: safeCount(body.imageCount),
    videoCount: safeCount(body.videoCount),
  };
}

export function buildComposePrompt(
  source: ReturnType<typeof normalizeComposeSource>,
) {
  const media = [
    source.imageCount ? `${source.imageCount} image(s)` : '',
    source.videoCount ? `${source.videoCount} video(s)` : '',
  ]
    .filter(Boolean)
    .join(' and ');

  return [
    'Create an editable social post draft from the supplied creator context.',
    'Keep the source language. Preserve concrete names, claims, and intent; do not invent facts.',
    'Write a specific title (maximum 120 characters) and a concise body (maximum 1,800 characters).',
    'Avoid generic AI phrasing, clickbait, markdown headings, and unnecessary hashtags.',
    media ? `Attached media: ${media}.` : 'This is a text-only post.',
    source.title ? `Current title: ${source.title}` : '',
    source.body
      ? `Source notes:\n${source.body}`
      : 'No source notes were supplied.',
  ]
    .filter(Boolean)
    .join('\n');
}

export function boundedComposeUsage(
  reported: number | undefined,
  reserved: number,
) {
  if (typeof reported !== 'number' || !Number.isFinite(reported)) {
    return reserved;
  }
  return Math.min(reserved, Math.max(0, Math.ceil(reported)));
}

/** AI Gateway reports the amount charged in USD on the final provider step.
 * Keep this parser deliberately narrow because provider metadata is untrusted
 * JSON and may be absent when a non-Gateway provider is used in development. */
export function gatewayCostUsdMicros(providerMetadata: unknown) {
  if (!isRecord(providerMetadata)) return undefined;
  const gateway = providerMetadata.gateway;
  if (!isRecord(gateway)) return undefined;
  const rawCost = gateway.cost;
  const cost =
    typeof rawCost === 'number'
      ? rawCost
      : typeof rawCost === 'string' && rawCost.trim()
        ? Number(rawCost)
        : Number.NaN;
  if (!Number.isFinite(cost) || cost < 0) return undefined;
  return Math.ceil(cost * 1_000_000);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function safeCount(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(20, Math.max(0, Math.round(value)))
    : 0;
}
