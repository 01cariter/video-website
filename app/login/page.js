import { Suspense } from 'react';
import AuthPanel from '@/app/components/AuthPanel';

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <AuthPanel mode="login" />
    </Suspense>
  );
}
