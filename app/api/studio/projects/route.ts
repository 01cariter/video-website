import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/supabase/server';
import {
  listStudioProjectsForUser,
  saveStudioProjectForUser,
} from '@/lib/studio/server-store';
import { normalizeStudioProject } from '@/lib/studio/store';

export const runtime = 'nodejs';

export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  }
  const projects = await listStudioProjectsForUser(user.id);
  return NextResponse.json({ projects });
}

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as {
    project?: unknown;
  } | null;
  const project = normalizeStudioProject(body?.project);
  if (!project) {
    return NextResponse.json({ error: 'Invalid project data.' }, { status: 400 });
  }
  const saved = await saveStudioProjectForUser(user.id, project);
  return NextResponse.json({ project: saved }, { status: 201 });
}
