import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user';
import { generateNode } from '@/lib/ai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// POST /api/generate — generate a single node's result.
// body: { prompt, model, mode, ratio, duration, resolution }
export async function POST(request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { prompt, model, mode, ratio, duration } = body;
  if (!prompt || !prompt.trim()) {
    return NextResponse.json({ error: 'prompt required' }, { status: 400 });
  }

  const result = await generateNode({ prompt, model, mode, ratio, duration });
  return NextResponse.json({ result });
}
