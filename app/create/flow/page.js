import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/user';
import FlowCanvas from './FlowCanvas';

// AI workflow canvas (React Flow). Protected, like the rest of /create.
export const dynamic = 'force-dynamic';

export default async function FlowPage({ searchParams }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/create');

  const sp = await searchParams;
  const prompt = typeof sp?.prompt === 'string' ? sp.prompt : '';
  const model = typeof sp?.model === 'string' ? sp.model : '';

  return <FlowCanvas prompt={prompt} model={model} />;
}
