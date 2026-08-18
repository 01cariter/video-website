import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/supabase/server';
import {
  deleteStudioProjectForUser,
  getStudioProjectForUser,
  saveStudioProjectForUser,
} from '@/lib/studio/server-store';
import { normalizeStudioProject } from '@/lib/studio/store';

export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: '请先登录。' }, { status: 401 });
  }
  const { id } = await context.params;
  const project = await getStudioProjectForUser(user.id, id);
  if (!project) {
    return NextResponse.json({ error: '项目不存在。' }, { status: 404 });
  }
  return NextResponse.json({ project });
}

export async function PUT(request: Request, context: RouteContext) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: '请先登录。' }, { status: 401 });
  }
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as {
    project?: unknown;
  } | null;
  const project = normalizeStudioProject(body?.project);
  if (!project || project.id !== id) {
    return NextResponse.json({ error: '项目数据无效。' }, { status: 400 });
  }
  const saved = await saveStudioProjectForUser(user.id, project);
  return NextResponse.json({ project: saved });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: '请先登录。' }, { status: 401 });
  }
  const { id } = await context.params;
  const deleted = await deleteStudioProjectForUser(user.id, id);
  return deleted
    ? new NextResponse(null, { status: 204 })
    : NextResponse.json({ error: '项目不存在。' }, { status: 404 });
}
