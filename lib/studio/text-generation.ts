const MAX_STUDIO_TEXT_LENGTH = 20_000;
const MAX_STUDIO_IDENTIFIER_LENGTH = 160;

export class StudioTextValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StudioTextValidationError';
  }
}

export interface StudioTextRequest {
  prompt: string;
  current: string;
  requestId: string;
  projectId?: string;
  nodeId?: string;
  modelId?: string;
  reasoningEffort: 'low' | 'medium' | 'high';
  expectedCredits: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function optionalString(
  value: unknown,
  label: string,
  maximum: number,
) {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') {
    throw new StudioTextValidationError(`Invalid ${label}.`);
  }
  if (value.length > maximum) {
    throw new StudioTextValidationError(`${label} is too long.`);
  }
  return value.trim() || undefined;
}

export function normalizeStudioTextRequest(value: unknown): StudioTextRequest {
  if (!isRecord(value)) {
    throw new StudioTextValidationError('Invalid text generation request.');
  }

  if (typeof value.prompt !== 'string') {
    throw new StudioTextValidationError('Add a prompt first.');
  }
  if (value.prompt.length > MAX_STUDIO_TEXT_LENGTH) {
    throw new StudioTextValidationError('Text generation input is too long.');
  }
  const prompt = value.prompt.trim();
  if (!prompt) {
    throw new StudioTextValidationError('Add a prompt first.');
  }

  const current =
    optionalString(value.current, 'current text', MAX_STUDIO_TEXT_LENGTH) ?? '';
  const requestId = optionalString(
    value.requestId,
    'request identifier',
    MAX_STUDIO_IDENTIFIER_LENGTH,
  );
  if (!requestId) {
    throw new StudioTextValidationError('Invalid request identifier.');
  }

  const projectId = optionalString(
    value.projectId,
    'project identifier',
    MAX_STUDIO_IDENTIFIER_LENGTH,
  );
  const nodeId = optionalString(
    value.nodeId,
    'node identifier',
    MAX_STUDIO_IDENTIFIER_LENGTH,
  );
  const modelId = optionalString(
    value.modelId,
    'text model',
    MAX_STUDIO_IDENTIFIER_LENGTH,
  );
  const reasoningEffort =
    value.reasoningEffort === 'low' || value.reasoningEffort === 'medium'
      ? value.reasoningEffort
      : 'high';

  return {
    prompt,
    current,
    requestId,
    projectId,
    nodeId,
    modelId,
    reasoningEffort,
    expectedCredits: value.expectedCredits,
  };
}
