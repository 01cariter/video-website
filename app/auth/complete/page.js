import { Suspense } from 'react';
import AuthComplete from '@/app/components/AuthComplete';

// OAuth landing route.
//
// Social sign-in (Google/Microsoft) sends the browser back here. This path is
// covered by the middleware matcher (see proxy.js), so Neon Auth can exchange
// the one-time verifier token for a real session cookie on this domain. Once
// the session is set, this tiny client component forwards the user to `next`.
export default function AuthCompletePage() {
  return (
    <Suspense fallback={null}>
      <AuthComplete />
    </Suspense>
  );
}
