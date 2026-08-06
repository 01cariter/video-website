import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/user';
import CreateWorkspace from './CreateWorkspace';

export const dynamic = 'force-dynamic';

const DEFAULT_SOLO_URL = 'https://work-solo.ai/';

export default async function CreatePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/create');

  const soloUrl = process.env.NEXT_PUBLIC_SOLO_URL || DEFAULT_SOLO_URL;
  return <CreateWorkspace user={user} soloUrl={soloUrl} />;
}
