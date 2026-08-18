import StudioHome from '../../components/studio/StudioHome';
import { getAuthUser } from '@/lib/supabase/server';

export default async function StudioPage() {
  const user = await getAuthUser();
  return <StudioHome authenticated={Boolean(user)} />;
}
