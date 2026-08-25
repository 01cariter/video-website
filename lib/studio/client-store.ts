'use client';

import {
  cacheStudioProject,
  createStudioProjectDraft,
  deleteStudioProject,
  getStudioProject,
  listStudioProjects,
  normalizeStudioProject,
  saveStudioProject,
} from './store';
import type { StudioPendingGeneration, StudioProject } from './types';
import { STUDIO_PERSISTENCE_VERSION } from './types';

async function jsonOrNull(response: Response) {
  return response.json().catch(() => null) as Promise<Record<string, unknown> | null>;
}

function projectUpdatedAt(project: StudioProject) {
  const value = Date.parse(project.updatedAt);
  return Number.isFinite(value) ? value : 0;
}

function isNewerProject(candidate: StudioProject, baseline: StudioProject) {
  if (candidate.revision !== baseline.revision) {
    return candidate.revision > baseline.revision;
  }
  return projectUpdatedAt(candidate) > projectUpdatedAt(baseline);
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .toSorted(([left], [right]) => left.localeCompare(right));
    return `{${entries
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

function sameProjectContent(left: StudioProject, right: StudioProject) {
  const content = (project: StudioProject) => {
    const normalized = normalizeStudioProject(project) ?? project;
    return {
      title: normalized.title,
      coverUrls: normalized.coverUrls,
      nodes: normalized.nodes,
      viewport: normalized.viewport,
      messages: normalized.messages,
      appliedToolCallIds: normalized.appliedToolCallIds,
      pendingPrompt: normalized.pendingPrompt,
      pendingGeneration: normalized.pendingGeneration,
      pendingAgentAttachmentIds: normalized.pendingAgentAttachmentIds,
      agentOpen: normalized.agentOpen,
    };
  };
  return stableJson(content(left)) === stableJson(content(right));
}

function hasProjectContent(project: StudioProject) {
  return Boolean(
    project.nodes.length ||
      project.messages.length ||
      project.pendingPrompt ||
      project.pendingGeneration,
  );
}

function shouldRecoverLegacyLocal(
  local: StudioProject,
  remote: StudioProject,
) {
  return (
    remote.persistenceVersion !== STUDIO_PERSISTENCE_VERSION &&
    hasProjectContent(local) &&
    !hasProjectContent(remote)
  );
}

function recoverLegacyLocal(
  local: StudioProject,
  remote: StudioProject,
  storageScope?: string,
) {
  const rebased = {
    ...local,
    revision: Math.max(local.revision, remote.revision),
    persistenceVersion: STUDIO_PERSISTENCE_VERSION,
  };
  void saveStudioProjectSynced(rebased, { storageScope });
  return getStudioProject(local.id, storageScope) ?? rebased;
}

interface StudioProjectSaveOptions {
  keepalive?: boolean;
  storageScope?: string;
  throwOnRemoteFailure?: boolean;
  conflictRetries?: number;
}

interface StudioProjectListOptions {
  onRemoteFailure?: (error: StudioProjectSyncError) => void;
}

interface StudioProjectGetOptions {
  throwOnRemoteFailure?: boolean;
}

export class StudioProjectSyncError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'StudioProjectSyncError';
  }
}

export async function listStudioProjectsSynced(
  storageScope?: string,
  options: StudioProjectListOptions = {},
) {
  const local = listStudioProjects(storageScope);
  try {
    const response = await fetch('/api/studio/projects', { cache: 'no-store' });
    if (response.status === 401) {
      options.onRemoteFailure?.(
        new StudioProjectSyncError('Your session expired. Sign in again.', 401),
      );
      return local;
    }
    if (response.ok) {
      const payload = await jsonOrNull(response);
      if (!Array.isArray(payload?.projects)) {
        throw new StudioProjectSyncError(
          'The cloud returned an invalid project list. Your local projects are unchanged.',
          502,
        );
      }
      const normalized = payload.projects.map(normalizeStudioProject);
      if (normalized.some((project) => !project)) {
        throw new StudioProjectSyncError(
          'One or more cloud projects could not be read. Your local projects are unchanged.',
          502,
        );
      }
      const remote = normalized as StudioProject[];
      const localById = new Map(local.map((project) => [project.id, project]));
      const merged = remote.map((project) => {
        const cached = localById.get(project.id);
        localById.delete(project.id);
        if (cached && shouldRecoverLegacyLocal(cached, project)) {
          return recoverLegacyLocal(cached, project, storageScope);
        }
        if (cached && isNewerProject(cached, project)) {
          void saveStudioProjectSynced(cached, { storageScope });
          return cached;
        }
        return cacheStudioProject(project, storageScope);
      });
      for (const project of localById.values()) {
        void saveStudioProjectSynced(project, { storageScope });
        merged.push(project);
      }
      return merged.toSorted(
        (a, b) => projectUpdatedAt(b) - projectUpdatedAt(a),
      );
    }
    const payload = await jsonOrNull(response);
    throw new StudioProjectSyncError(
      typeof payload?.error === 'string'
        ? payload.error
        : 'Cloud projects are temporarily unavailable.',
      response.status,
    );
  } catch (error) {
    options.onRemoteFailure?.(
      error instanceof StudioProjectSyncError
        ? error
        : new StudioProjectSyncError(
            'Cloud projects are temporarily unavailable. Your local projects are unchanged.',
          ),
    );
    // A real network failure keeps offline drafts available.
  }
  return local;
}

export async function getStudioProjectSynced(
  id: string,
  storageScope?: string,
  options: StudioProjectGetOptions = {},
) {
  const cached = getStudioProject(id, storageScope);
  try {
    const response = await fetch(`/api/studio/projects/${encodeURIComponent(id)}`, {
      cache: 'no-store',
    });
    if (response.ok) {
      const payload = await jsonOrNull(response);
      const project = normalizeStudioProject(payload?.project);
      if (project) {
        if (cached && shouldRecoverLegacyLocal(cached, project)) {
          return recoverLegacyLocal(cached, project, storageScope);
        }
        if (cached && isNewerProject(cached, project)) {
          void saveStudioProjectSynced(cached, { storageScope });
          return cached;
        }
        return cacheStudioProject(project, storageScope);
      }
      throw new StudioProjectSyncError(
        'The cloud returned invalid canvas data. Your local copy is unchanged.',
        502,
      );
    }
    if (response.status === 404 && cached) {
      void saveStudioProjectSynced(cached, { storageScope });
      return cached;
    }
    if (response.status === 404) return null;
    const payload = await jsonOrNull(response);
    throw new StudioProjectSyncError(
      typeof payload?.error === 'string'
        ? payload.error
        : 'This canvas could not be loaded from the cloud.',
      response.status,
    );
  } catch (error) {
    if (cached) return cached;
    if (options.throwOnRemoteFailure) {
      if (error instanceof StudioProjectSyncError) throw error;
      throw new StudioProjectSyncError(
        'This canvas could not be loaded from the cloud. Try again.',
      );
    }
    // Fall back to local cache.
  }
  return cached;
}

export async function createStudioProjectSynced(input: {
  title?: string;
  pendingPrompt?: string;
  pendingGeneration?: StudioPendingGeneration;
  pendingAgentAttachmentIds?: string[];
  initialNodes?: StudioProject['nodes'];
  templateId?: string;
  blank?: boolean;
}, storageScope?: string) {
  const draft = saveStudioProject(
    createStudioProjectDraft(input),
    storageScope,
  );
  try {
    const response = await fetch('/api/studio/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project: draft }),
    });
    if (response.ok) {
      const payload = await jsonOrNull(response);
      const project = normalizeStudioProject(payload?.project);
      if (project) return cacheStudioProject(project, storageScope);
    }
  } catch {
    // Local draft remains available.
  }
  return draft;
}

export async function saveStudioProjectSynced(
  project: StudioProject,
  options: StudioProjectSaveOptions = {},
) {
  const local = saveStudioProject(project, options.storageScope);
  try {
    const response = await fetch(
      `/api/studio/projects/${encodeURIComponent(project.id)}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project: local }),
        keepalive: options.keepalive,
      },
    );
    if (response.ok) {
      const payload = await jsonOrNull(response);
      const remote = normalizeStudioProject(payload?.project);
      if (remote) {
        const latest = getStudioProject(project.id, options.storageScope);
        const contentMatches = latest
          ? sameProjectContent(latest, remote)
          : false;
        const explicitConflict = payload?.accepted === false;
        const legacyConflict =
          payload?.accepted === undefined &&
          latest?.revision === remote.revision &&
          !contentMatches;
        if (explicitConflict && contentMatches) {
          return cacheStudioProject(remote, options.storageScope);
        }
        if (latest && (explicitConflict || legacyConflict)) {
          if ((options.conflictRetries ?? 0) < 2) {
            return saveStudioProjectSynced({
              ...latest,
              revision: Math.max(latest.revision, remote.revision),
            }, {
              ...options,
              conflictRetries: (options.conflictRetries ?? 0) + 1,
            });
          }
          if (options.throwOnRemoteFailure) {
            throw new StudioProjectSyncError(
              'This canvas changed on another device. Retrying shortly.',
              409,
            );
          }
          return latest;
        }
        if (latest && isNewerProject(latest, remote)) return latest;
        return cacheStudioProject(remote, options.storageScope);
      }
    }
    if (options.throwOnRemoteFailure) {
      const payload = await jsonOrNull(response);
      throw new StudioProjectSyncError(
        typeof payload?.error === 'string'
          ? payload.error
          : 'The project could not be saved to the cloud.',
        response.status,
      );
    }
  } catch (error) {
    if (options.throwOnRemoteFailure) {
      if (error instanceof StudioProjectSyncError) throw error;
      throw new StudioProjectSyncError(
        'The project is saved locally but could not reach the cloud.',
      );
    }
    // Local save is the offline fallback.
  }
  return local;
}

export async function deleteStudioProjectSynced(
  id: string,
  storageScope?: string,
) {
  try {
    const response = await fetch(`/api/studio/projects/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!response.ok && response.status !== 404) {
      const payload = await jsonOrNull(response);
      throw new StudioProjectSyncError(
        typeof payload?.error === 'string'
          ? payload.error
          : 'The project could not be deleted from the cloud.',
        response.status,
      );
    }
    deleteStudioProject(id, storageScope);
  } catch (error) {
    if (error instanceof StudioProjectSyncError) throw error;
    throw new StudioProjectSyncError(
      'The project could not be deleted. Check your connection and try again.',
    );
  }
}

export async function renameStudioProjectSynced(
  id: string,
  title: string,
  storageScope?: string,
) {
  const current = getStudioProject(id, storageScope);
  if (!current) return null;
  return saveStudioProjectSynced({
    ...current,
    title: title.trim() || 'Untitled project',
  }, { storageScope });
}
