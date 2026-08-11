import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/user';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <section className="x-empty">
        <h1>Profile</h1>
        <p>Sign in to view your profile.</p>
        <Link href="/login?next=/profile">Sign in</Link>
      </section>
    );
  }

  if (!user.handle) {
    return (
      <section className="x-empty">
        <h1>Finish your account</h1>
        <p>Choose a handle to open your profile.</p>
        <Link href="/auth/complete">Continue</Link>
      </section>
    );
  }

  redirect(`/u/${encodeURIComponent(user.handle.replace(/^@+/, ''))}`);
}
