'use client';

import {
  createStudioProjectDraft,
  deleteStudioProject,
  getStudioProject,
  listStudioProjects,
  normalizeStudioProject,
  saveStudioProject,
} from './store';
import type { StudioProject } from './types';

async function jsonOrNull(response: Response) {
  return response.json().catch(() => null) as Promise<Record<string, unknown> | null>;
}

export async function listStudioProjectsSynced() {
  try {
    const response = await fetch('/api/studio/projects', { cache: 'no-store' });
    if (response.status === 401) return [];
    if (response.ok) {
      const payload = await jsonOrNull(response);
      const remote = Array.isArray(payload?.projects)
        ? payload.projects
            .map(normalizeStudioProject)
            .filter((project): project is StudioProject => Boolean(project))
        : [];
      for (const project of remote) saveStudioProject(project);
      return remote;
    }
  } catch {
    // A real network failure keeps offline drafts available.
  }
  return listStudioProjects();
}

export async function getStudioProjectSynced(id: string) {
  try {
    const response = await fetch(`/api/studio/projects/${encodeURIComponent(id)}`, {
      cache: 'no-store',
    });
    if (response.ok) {
      const payload = await jsonOrNull(response);
      const project = normalizeStudioProject(payload?.project);
      if (project) return saveStudioProject(project);
    }
  } catch {
    // Fall back to local cache.
  }
  return getStudioProject(id);
}

export async function createStudioProjectSynced(input: {
  title?: string;
  pendingPrompt?: string;
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
      if (project) return saveStudioProject(project);
    }
  } catch {
    // Local draft remains available.
  }
  return draft;
}

export async function saveStudioProjectSynced(project: StudioProject) {
  const local = saveStudioProject(project);
  try {
    const response = await fetch(
      `/api/studio/projects/${encodeURIComponent(project.id)}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project: local }),
      },
    );
    if (response.ok) {
      const payload = await jsonOrNull(response);
      const remote = normalizeStudioProject(payload?.project);
      return remote ? saveStudioProject(remote) : local;
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
