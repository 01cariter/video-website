export function normalizeCanvasList(value) {
  if (Array.isArray(value)) return value;

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Invalid legacy state is treated like an empty canvas.
    }
  }

  return [];
}

export function normalizeCanvas(row) {
  if (!row) return row;

  return {
    ...row,
    nodes: normalizeCanvasList(row.nodes),
    edges: normalizeCanvasList(row.edges),
  };
}

export function asCanvasJson(sql, value) {
  return sql.json(normalizeCanvasList(value));
}
