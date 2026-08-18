import StudioWorkspaceLoader from '../../../components/studio/canvas/StudioWorkspaceLoader';
import { freeCreditModelsOnly } from '@/flags';

export default async function StudioProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, restrictToFreeCreditModels] = await Promise.all([
    params,
    freeCreditModelsOnly(),
  ]);
  return (
    <StudioWorkspaceLoader
      projectId={id}
      freeCreditModelsOnly={restrictToFreeCreditModels}
    />
  );
}
