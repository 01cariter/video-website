import StudioHome from '../../components/studio/StudioHome';
import { freeCreditModelsOnly } from '@/flags';
import { getAuthUser } from '@/lib/supabase/server';

export default async function StudioPage() {
  const [user, restrictToFreeCreditModels] = await Promise.all([
    getAuthUser(),
    freeCreditModelsOnly(),
  ]);
  return (
    <StudioHome
      authenticated={Boolean(user)}
      freeCreditModelsOnly={restrictToFreeCreditModels}
    />
  );
}
