import StudioWorkspaceLoader from '../../../components/studio/canvas/StudioWorkspaceLoader';
import { getStudioRuntimeConfig } from '@/flags';
import { getCurrentUser } from '@/lib/user';
import { redirect } from 'next/navigation';

export default async function StudioProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ id }, runtimeConfig, user] = await Promise.all([
    params,
    getStudioRuntimeConfig(),
    getCurrentUser(),
  ]);
  if (!user) redirect(`/login?next=/studio/${encodeURIComponent(id)}`);
  return (
    <StudioWorkspaceLoader
      projectId={id}
      runtimeConfig={runtimeConfig}
      user={user}
    />
  );
}
