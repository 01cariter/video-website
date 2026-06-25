import 'server-only';
import { sql } from './db';

// ============================================================================
// Canvas persistence (Neon Postgres).
//
// A "canvas" is a row in `projects` whose `nodes` / `edges` JSONB columns hold
// the React Flow state. The agent conversation lives in `agent_messages`.
// ============================================================================

// Get the user's most recent project, or create a fresh untitled one.
export async function getOrCreateCanvas(userId, { name } = {}) {
  const existing = await sql`
    SELECT id, name, status, nodes, edges
    FROM projects
    WHERE user_id = ${userId}
    ORDER BY updated_at DESC, created_at DESC
    LIMIT 1
  `;
  if (existing.length) return existing[0];

  const [created] = await sql`
    INSERT INTO projects (user_id, name, status)
    VALUES (${userId}, ${name || '未命名项目'}, 'draft')
    RETURNING id, name, status, nodes, edges
  `;
  return created;
}

export async function getCanvas(userId, projectId) {
  const [row] = await sql`
    SELECT id, name, status, nodes, edges
    FROM projects
    WHERE id = ${projectId} AND user_id = ${userId}
    LIMIT 1
  `;
  return row || null;
}

// Replace the whole canvas state for a project (used by debounced autosave).
export async function saveCanvas(userId, projectId, { nodes, edges, name }) {
  const [row] = await sql`
    UPDATE projects
    SET nodes = ${JSON.stringify(nodes ?? [])}::jsonb,
        edges = ${JSON.stringify(edges ?? [])}::jsonb,
        name  = COALESCE(${name ?? null}, name),
        updated_at = now()
    WHERE id = ${projectId} AND user_id = ${userId}
    RETURNING id
  `;
  return Boolean(row);
}

export async function renameCanvas(userId, projectId, name) {
  await sql`
    UPDATE projects SET name = ${name}, updated_at = now()
    WHERE id = ${projectId} AND user_id = ${userId}
  `;
}

// ---- agent conversation -------------------------------------------------

export async function getMessages(userId, projectId, limit = 100) {
  return sql`
    SELECT id, role, content, created_at
    FROM agent_messages
    WHERE project_id = ${projectId} AND user_id = ${userId}
    ORDER BY id ASC
    LIMIT ${limit}
  `;
}

export async function addMessage(userId, projectId, role, content) {
  const [row] = await sql`
    INSERT INTO agent_messages (project_id, user_id, role, content)
    VALUES (${projectId}, ${userId}, ${role}, ${content})
    RETURNING id, role, content, created_at
  `;
  return row;
}
