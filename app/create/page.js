import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/user';
import { getProjects } from '@/lib/videos';
import CreateStudio from './CreateStudio';

// Protected route (middleware also guards it). Loads the user's projects.
export const dynamic = 'force-dynamic';

export default async function CreatePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/create');

  const projects = await getProjects(user.id);
  return <CreateStudio user={user} projects={projects} />;
}
