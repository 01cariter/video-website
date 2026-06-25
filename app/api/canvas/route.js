import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user';
import { getCanvas, getOrCreateCanvas, saveCanvas } from '@/lib/canvas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/canvas[?project=ID] — load a canvas (latest if no id).
export async function GET(request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const pid = searchParams.get('project');

  const canvas = pid ? await getCanvas(user.id, Number(pid)) : await getOrCreateCanvas(user.id);
  if (!canvas) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  return NextResponse.json({ canvas });
}

// PUT /api/canvas — save nodes/edges (and optional name) for a project.
export async function PUT(request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { projectId, nodes, edges, name } = body;
  if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 });

  const ok = await saveCanvas(user.id, Number(projectId), { nodes, edges, name });
  if (!ok) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  return NextResponse.json({ ok: true });
}
