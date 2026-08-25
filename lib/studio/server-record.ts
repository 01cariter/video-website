import {
  STUDIO_PERSISTENCE_VERSION,
  type StudioProject,
} from './types';
export { decodeJsonb as decodeStudioJsonb } from '@/lib/jsonb';

export function studioProjectJsonFields(project: StudioProject) {
  return {
    document: {
      nodes: project.nodes,
      viewport: project.viewport,
      revision: project.revision,
      persistenceVersion: STUDIO_PERSISTENCE_VERSION,
      appliedToolCallIds: project.appliedToolCallIds || [],
      pendingGeneration: project.pendingGeneration,
      pendingAgentAttachmentIds: project.pendingAgentAttachmentIds || [],
    },
    messages: project.messages,
  };
}
