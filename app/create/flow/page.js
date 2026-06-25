import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/user';
import { getCanvas, getOrCreateCanvas, getMessages } from '@/lib/canvas';
import { aiConfigured } from '@/lib/ai';
import FlowCanvas from './FlowCanvas';

// AI canvas. Protected, like the rest of /create.
export const dynamic = 'force-dynamic';

export default async function FlowPage({ searchParams }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/create');

  const sp = await searchParams;
  const initialPrompt = typeof sp?.prompt === 'string' ? sp.prompt : '';
  const initialModel = typeof sp?.model === 'string' ? sp.model : '';
  const pid = sp?.project ? Number(sp.project) : null;

  const canvas = pid ? await getCanvas(user.id, pid) : await getOrCreateCanvas(user.id);
  if (!canvas) redirect('/create');

  const messages = await getMessages(user.id, canvas.id);

  return (
    <FlowCanvas
      projectId={canvas.id}
      name={canvas.name}
      initialNodes={canvas.nodes || []}
      initialEdges={canvas.edges || []}
      initialMessages={messages}
      initialPrompt={initialPrompt}
      initialModel={initialModel}
      aiReady={aiConfigured()}
    />
  );
}
