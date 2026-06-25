import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user';
import { addMessage, getMessages } from '@/lib/canvas';
import { agentChat, agentPipeline, agentStyles, aiConfigured } from '@/lib/ai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// GET /api/agent?project=ID — load conversation history.
export async function GET(request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const pid = Number(searchParams.get('project'));
  if (!pid) return NextResponse.json({ messages: [] });

  const messages = await getMessages(user.id, pid);
  return NextResponse.json({ messages, configured: aiConfigured() });
}

// POST /api/agent — run an agent action. Persists user + assistant turns.
// body: { projectId, action, input, context }
//   action: chat | prompt | brainstorm | styles | pipeline
export async function POST(request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { projectId, action = 'chat', input = '', context } = body;
  const pid = Number(projectId);
  if (!pid) return NextResponse.json({ error: 'projectId required' }, { status: 400 });

  // Persist the user turn (skip for the empty greeting bootstrap).
  if (input) await addMessage(user.id, pid, 'user', input);

  let result;
  if (action === 'styles') {
    result = await agentStyles({ input, context });
  } else if (action === 'pipeline') {
    result = await agentPipeline({ input, context });
  } else {
    result = await agentChat({ action, input, context });
  }

  const reply = result.reply || 'Done.';
  const saved = await addMessage(user.id, pid, 'assistant', reply);

  return NextResponse.json({
    message: { id: saved.id, role: 'assistant', content: reply, created_at: saved.created_at },
    scenes: result.scenes || null,
    styles: result.styles || null,
    source: result.source || 'ai',
  });
}
