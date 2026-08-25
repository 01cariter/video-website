import type { StudioGenerativeKind } from './types';

export interface StudioGenerationResponsePayload {
  text?: string;
  url?: string;
  urls?: string[];
  error?: string;
  balance?: number;
  code?: string;
  status?: 'processing';
  retryAfterMs?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readableKind(kind: StudioGenerativeKind) {
  return `${kind[0].toUpperCase()}${kind.slice(1)}`;
}

function plainTextError(raw: string) {
  const value = raw.replace(/\s+/g, ' ').trim();
  if (!value || /<\/?[a-z][\s\S]*>/i.test(value)) return undefined;
  return value.slice(0, 240);
}

export async function parseStudioGenerationResponse(
  response: Response,
  kind: StudioGenerativeKind,
): Promise<StudioGenerationResponsePayload> {
  const raw = await response.text();
  let parsed: unknown;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    if (response.status === 504) {
      throw new Error(
        `${readableKind(kind)} generation timed out before the provider finished. The unfinished request will be refunded automatically.`,
      );
    }
    if (!response.ok) {
      throw new Error(
        plainTextError(raw) ||
          `${readableKind(kind)} generation failed with HTTP ${response.status}.`,
      );
    }
    throw new Error(
      `${readableKind(kind)} generation returned an invalid server response.`,
    );
  }

  if (!isRecord(parsed)) {
    throw new Error(
      `${readableKind(kind)} generation returned an invalid server response.`,
    );
  }
  const payload = parsed as StudioGenerationResponsePayload;
  if (!response.ok) {
    throw new Error(
      typeof payload.error === 'string' && payload.error.trim()
        ? payload.error
        : `${readableKind(kind)} generation failed with HTTP ${response.status}.`,
    );
  }
  return payload;
}
