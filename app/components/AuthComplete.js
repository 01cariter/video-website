'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

// Runs after the middleware has exchanged the OAuth verifier for a session
// cookie. We only need to forward the now-signed-in user to their destination.
export default function AuthComplete() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const raw = params.get('next') || '/';
    // Only allow internal paths to avoid open-redirects.
    const next = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/';
    router.replace(next);
    router.refresh();
  }, [params, router]);

  return (
    <div className="auth">
      <div className="auth-card">
        <p className="lead">Finishing sign-in…</p>
      </div>
    </div>
  );
}
