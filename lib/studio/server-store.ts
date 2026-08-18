import 'server-only';

import { sql } from '@/lib/db';
import { normalizeStudioProject } from './store';
import type { StudioProject } from './types';

interface StudioProjectRow extends Record<string, unknown> {
  id: string;
  title: string;
  document: {
    nodes?: unknown[];
    viewport?: Record<string, unknown>;
  };
  messages: unknown[];
  cover_urls: string[];
  pending_prompt: string | null;
  agent_open: boolean;
  created_at: string | Date;
  updated_at: string | Date;
}

function iso(value: string | Date) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function fromRow(row: StudioProjectRow): StudioProject {
  const project = normalizeStudioProject({
    id: row.id,
    title: row.title,
    nodes: row.document?.nodes || [],
    viewport: row.document?.viewport || undefined,
    messages: Array.isArray(row.messages) ? row.messages : [],
    coverUrls: Array.isArray(row.cover_urls) ? row.cover_urls : [],
    pendingPrompt: row.pending_prompt || undefined,
    agentOpen: row.agent_open,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  });
  if (!project) throw new Error('Stored Studio project is invalid.');
  return project;
}

function projectDocument(project: StudioProject) {
  return JSON.stringify({
    nodes: project.nodes,
    viewport: project.viewport,
  });
}

export async function listStudioProjectsForUser(userId: string) {
  const rows = await sql<StudioProjectRow[]>`
    SELECT
      id, title, document, messages, cover_urls, pending_prompt, agent_open,
      created_at, updated_at
    FROM public.studio_projects
    WHERE owner_id = ${userId}
    ORDER BY updated_at DESC
  `;
  return rows.map(fromRow);
}

export async function getStudioProjectForUser(userId: string, id: string) {
  const [row] = await sql<StudioProjectRow[]>`
    SELECT
      id, title, document, messages, cover_urls, pending_prompt, agent_open,
      created_at, updated_at
    FROM public.studio_projects
    WHERE owner_id = ${userId} AND id = ${id}
  `;
  return row ? fromRow(row) : null;
}

export async function saveStudioProjectForUser(
  userId: string,
  input: StudioProject,
) {
  const project = normalizeStudioProject(input);
  if (!project) throw new Error('Invalid Studio project.');
  const covers = project.nodes
    .map((node) => node.data.src)
    .filter((src): src is string => Boolean(src))
    .slice(0, 4);
  const coverUrls = covers.length ? covers : project.coverUrls;
  const [row] = await sql<StudioProjectRow[]>`
    INSERT INTO public.studio_projects (
      id,
      owner_id,
      title,
      document,
      messages,
      cover_urls,
      pending_prompt,
      agent_open,
      created_at,
      updated_at
    )
    VALUES (
      ${project.id},
      ${userId},
      ${project.title.trim() || 'Untitled project'},
      ${projectDocument(project)}::jsonb,
      ${JSON.stringify(project.messages)}::jsonb,
      ${coverUrls},
      ${project.pendingPrompt || null},
      ${project.agentOpen},
      ${project.createdAt},
      now()
    )
    ON CONFLICT (id) DO UPDATE SET
      title = excluded.title,
      document = excluded.document,
      messages = excluded.messages,
      cover_urls = excluded.cover_urls,
      pending_prompt = excluded.pending_prompt,
      agent_open = excluded.agent_open,
      updated_at = now()
    WHERE public.studio_projects.owner_id = excluded.owner_id
    RETURNING
      id, title, document, messages, cover_urls, pending_prompt, agent_open,
      created_at, updated_at
  `;
  if (!row) throw new Error('Project id belongs to another account.');
  return fromRow(row);
}

export async function deleteStudioProjectForUser(userId: string, id: string) {
  const rows = await sql<{ id: string }[]>`
    DELETE FROM public.studio_projects
    WHERE owner_id = ${userId} AND id = ${id}
    RETURNING id
  `;
  return rows.length > 0;
}
