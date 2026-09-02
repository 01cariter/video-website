import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/user';
import { getTranslate } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const [user, t] = await Promise.all([getCurrentUser(), getTranslate()]);
  if (!user) {
    return (
      <section className="x-empty">
        <h1>{t('profile.title')}</h1>
        <p>{t('profile.signInPrompt')}</p>
        <Link href="/login?next=/profile">{t('common.signIn')}</Link>
      </section>
    );
  }

  if (!user.handle) {
    return (
      <section className="x-empty">
        <h1>{t('profile.finishTitle')}</h1>
        <p>{t('profile.finishLead')}</p>
        <Link href="/auth/complete">{t('common.continue')}</Link>
      </section>
    );
  }

  redirect(`/u/${encodeURIComponent(user.handle.replace(/^@+/, ''))}`);
}
