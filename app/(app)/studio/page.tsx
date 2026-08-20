import StudioHome from '../../components/studio/StudioHome';
import { getStudioRuntimeConfig } from '@/flags';
import { getAuthUser } from '@/lib/supabase/server';

export default async function StudioPage() {
  const [user, runtimeConfig] = await Promise.all([
    getAuthUser(),
    getStudioRuntimeConfig(),
  ]);
  return (
    <StudioHome
      authenticated={Boolean(user)}
      runtimeConfig={runtimeConfig}
    />
  );
}
