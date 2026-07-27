import { Suspense } from 'react';
import AuthPanel from '@/app/components/AuthPanel';

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <AuthPanel mode="register" />
    </Suspense>
  );
}
