import StudioWorkspaceLoader from '../../../components/studio/canvas/StudioWorkspaceLoader';
import { getStudioRuntimeConfig } from '@/flags';
import { getCurrentUser } from '@/lib/user';

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
  return (
    <StudioWorkspaceLoader
      projectId={id}
      runtimeConfig={runtimeConfig}
      user={user}
    />
  );
}
