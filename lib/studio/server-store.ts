import 'server-only';

import { sql, sqlJson } from '@/lib/db';
import { normalizeStudioProject } from './store';
import { decodeStudioJsonb, studioProjectJsonFields } from './server-record';
import type { StudioProject } from './types';

interface StudioProjectRow extends Record<string, unknown> {
  id: string;
  title: string;
  document: {
    nodes?: unknown[];
    viewport?: Record<string, unknown>;
    revision?: number;
    appliedToolCallIds?: unknown[];
  } | string;
  messages: unknown[] | string;
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
  const document = decodeStudioJsonb<Exclude<StudioProjectRow['document'], string>>(
    row.document,
    {},
  );
  const messages = decodeStudioJsonb<unknown[]>(row.messages, []);
  const storedToolReceipts = Array.isArray(document.appliedToolCallIds)
    ? {
        appliedToolCallIds: document.appliedToolCallIds.filter(
          (id): id is string => typeof id === 'string',
        ),
      }
    : {};
  const project = normalizeStudioProject({
    id: row.id,
    title: row.title,
    nodes: document.nodes || [],
    viewport: document.viewport || undefined,
    ...storedToolReceipts,
    messages: Array.isArray(messages) ? messages : [],
    coverUrls: Array.isArray(row.cover_urls) ? row.cover_urls : [],
    pendingPrompt: row.pending_prompt || undefined,
    agentOpen: row.agent_open,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    revision: document.revision,
  });
  if (!project) throw new Error('Stored Studio project is invalid.');
  return project;
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
  const jsonFields = studioProjectJsonFields(project);
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
      ${sqlJson(jsonFields.document)},
      ${sqlJson(jsonFields.messages)},
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
    WHERE
      public.studio_projects.owner_id = excluded.owner_id
      AND COALESCE(
        (public.studio_projects.document ->> 'revision')::bigint,
        0
      ) < ${project.revision}
    RETURNING
      id, title, document, messages, cover_urls, pending_prompt, agent_open,
      created_at, updated_at
  `;
  if (!row) {
    const current = await getStudioProjectForUser(userId, project.id);
    if (current) return current;
    throw new Error('Project id belongs to another account.');
  }
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
