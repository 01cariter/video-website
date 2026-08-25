import {
  STUDIO_PERSISTENCE_VERSION,
  type StudioProject,
} from './types';

export function decodeStudioJsonb<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string') return (value ?? fallback) as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function studioProjectJsonFields(project: StudioProject) {
  return {
    document: {
      nodes: project.nodes,
      viewport: project.viewport,
      revision: project.revision,
      persistenceVersion: STUDIO_PERSISTENCE_VERSION,
      appliedToolCallIds: project.appliedToolCallIds || [],
    },
    messages: project.messages,
  };
}
