const DEFAULT_HISTORY_LIMIT = 50;

export function getSelectedNode(nodes, selectedId) {
  if (!selectedId || !Array.isArray(nodes)) return null;
  return nodes.find((node) => node.id === selectedId) || null;
}

export function getIncomingRefs(nodes, edges, selectedId) {
  if (!selectedId || !Array.isArray(nodes) || !Array.isArray(edges)) return [];

  const nodesById = new Map(nodes.map((node) => [node.id, node]));

  return edges
    .filter((edge) => edge.target === selectedId)
    .map((edge) => nodesById.get(edge.source))
    .filter(Boolean)
    .map((node) => ({
      id: node.id,
      poster: node.data?.poster || null,
      prompt: node.data?.prompt || '',
      title: node.data?.title || node.id,
    }));
}

export function createCanvasSnapshot(nodes, edges) {
  return {
    nodes: nodes.map((node) => ({
      ...node,
      position: { ...node.position },
      data: { ...node.data },
    })),
    edges: edges.map((edge) => ({ ...edge })),
  };
}

export function appendHistory(history, snapshot, limit = DEFAULT_HISTORY_LIMIT) {
  return [...history, snapshot].slice(-limit);
}

export function takeUndo(history) {
  if (!history.length) return { previous: null, history: [] };
  return {
    previous: history[history.length - 1],
    history: history.slice(0, -1),
  };
}

export async function persistCanvas(fetcher, payload) {
  const response = await fetcher('/api/canvas', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Canvas save failed: ${response.status}`);
  }

  return 'saved';
}
