import StudioWorkspaceLoader from '../../../components/studio/canvas/StudioWorkspaceLoader';
import { freeCreditModelsOnly } from '@/flags';
import { getCurrentUser } from '@/lib/user';

export default async function StudioProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ id }, restrictToFreeCreditModels, user] = await Promise.all([
    params,
    freeCreditModelsOnly(),
    getCurrentUser(),
  ]);
  return (
    <StudioWorkspaceLoader
      projectId={id}
      freeCreditModelsOnly={restrictToFreeCreditModels}
      user={user}
    />
  );
}
