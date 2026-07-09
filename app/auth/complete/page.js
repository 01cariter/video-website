import { Suspense } from 'react';
import AuthComplete from '@/app/components/AuthComplete';

// Legacy OAuth landing page. New Supabase OAuth uses /auth/callback.
export default function AuthCompletePage() {
  return (
    <Suspense fallback={null}>
      <AuthComplete />
    </Suspense>
  );
}
