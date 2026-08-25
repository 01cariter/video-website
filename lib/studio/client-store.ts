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

interface StudioProjectSaveOptions {
  keepalive?: boolean;
}

export async function listStudioProjectsSynced() {
  const local = listStudioProjects();
  try {
    const response = await fetch('/api/studio/projects', { cache: 'no-store' });
    if (response.status === 401) return local;
    if (response.ok) {
      const payload = await jsonOrNull(response);
      const remote = Array.isArray(payload?.projects)
        ? payload.projects
            .map(normalizeStudioProject)
            .filter((project): project is StudioProject => Boolean(project))
        : [];
      const localById = new Map(local.map((project) => [project.id, project]));
      const merged = remote.map((project) => {
        const cached = localById.get(project.id);
        localById.delete(project.id);
        if (cached && isNewerProject(cached, project)) {
          void saveStudioProjectSynced(cached);
          return cached;
        }
        return cacheStudioProject(project);
      });
      merged.push(...localById.values());
      return merged.toSorted(
        (a, b) => projectUpdatedAt(b) - projectUpdatedAt(a),
      );
    }
  } catch {
    // A real network failure keeps offline drafts available.
  }
  return local;
}

export async function getStudioProjectSynced(id: string) {
  const cached = getStudioProject(id);
  try {
    const response = await fetch(`/api/studio/projects/${encodeURIComponent(id)}`, {
      cache: 'no-store',
    });
    if (response.ok) {
      const payload = await jsonOrNull(response);
      const project = normalizeStudioProject(payload?.project);
      if (project) {
        if (cached && isNewerProject(cached, project)) {
          void saveStudioProjectSynced(cached);
          return cached;
        }
        return cacheStudioProject(project);
      }
    }
  } catch {
    // Fall back to local cache.
  }
  return cached;
}

export async function createStudioProjectSynced(input: {
  title?: string;
  pendingPrompt?: string;
  pendingGeneration?: StudioPendingGeneration;
  templateId?: string;
  blank?: boolean;
}) {
  const draft = saveStudioProject(createStudioProjectDraft(input));
  try {
    const response = await fetch('/api/studio/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project: draft }),
    });
    if (response.ok) {
      const payload = await jsonOrNull(response);
      const project = normalizeStudioProject(payload?.project);
      if (project) return cacheStudioProject(project);
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
  const local = saveStudioProject(project);
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
        const latest = getStudioProject(project.id);
        if (latest && isNewerProject(latest, remote)) return latest;
        return cacheStudioProject(remote);
      }
    }
  } catch {
    // Local save is the offline fallback.
  }
  return local;
}

export async function deleteStudioProjectSynced(id: string) {
  deleteStudioProject(id);
  try {
    await fetch(`/api/studio/projects/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  } catch {
    // The local delete still succeeds offline.
  }
}

export async function renameStudioProjectSynced(id: string, title: string) {
  const current = getStudioProject(id);
  if (!current) return null;
  return saveStudioProjectSynced({
    ...current,
    title: title.trim() || 'Untitled project',
  });
}
