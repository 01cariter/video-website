'use client';

import { useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, LoaderCircle, X } from 'lucide-react';
import type { Provider } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';

interface AuthPanelProps {
  mode?: 'login' | 'register';
  presentation?: 'page' | 'modal';
  nextPath?: string;
  onClose?: () => void;
  onModeChange?: (mode: 'login' | 'register') => void;
  onAuthenticated?: () => void;
}

interface AuthForm {
  name: string;
  email: string;
  password: string;
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path fill="#4285F4" d="M23.04 12.26c0-.82-.07-1.6-.21-2.36H12v4.46h6.19a5.3 5.3 0 0 1-2.3 3.48v2.89h3.72c2.18-2 3.43-4.96 3.43-8.47z" />
      <path fill="#34A853" d="M12 24c3.1 0 5.7-1.03 7.6-2.79l-3.72-2.89c-1.03.69-2.35 1.1-3.88 1.1-2.98 0-5.5-2.01-6.4-4.72H1.75v2.98A11.99 11.99 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.6 14.7a7.2 7.2 0 0 1 0-4.6V7.12H1.75a12 12 0 0 0 0 10.76L5.6 14.7z" />
      <path fill="#EA4335" d="M12 4.77c1.68 0 3.2.58 4.39 1.72l3.29-3.29C17.69 1.2 15.1 0 12 0 7.31 0 3.26 2.69 1.75 6.62L5.6 9.9C6.5 7.19 9.02 4.77 12 4.77z" />
    </svg>
  );
}

export default function AuthPanel({
  mode = 'login',
  presentation = 'page',
  nextPath,
  onClose,
  onModeChange,
  onAuthenticated,
}: AuthPanelProps) {
  const isLogin = mode === 'login';
  const isModal = presentation === 'modal';
  const router = useRouter();
  const params = useSearchParams();
  const supabase = useMemo(() => createClient(), []);
  const rawNext = nextPath || params.get('next') || '/';
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/';
  const initialError = params.get('error');
  const [error, setError] = useState(initialError ? 'Sign-in failed. Please try again.' : '');
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<AuthForm>({ name: '', email: '', password: '' });

  function setField(key: keyof AuthForm) {
    return (event: ChangeEvent<HTMLInputElement>) => {
      setForm((current) => ({ ...current, [key]: event.target.value }));
    };
  }

  function goNext() {
    if (onAuthenticated) {
      onAuthenticated();
      router.refresh();
      return;
    }
    router.push(next);
    router.refresh();
  }

  async function startSocial(provider: Provider) {
    setError('');
    setLoading(true);
    try {
      const callbackUrl = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: callbackUrl },
      });
      if (authError) {
        setError(authError.message || `Could not sign in with ${provider}.`);
        setLoading(false);
      }
    } catch {
      setError('Something went wrong starting social sign-in.');
      setLoading(false);
    }
  }

  async function submitEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const emailRedirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
      const { data, error: authError } = isLogin
        ? await supabase.auth.signInWithPassword({ email: form.email, password: form.password })
        : await supabase.auth.signUp({
            email: form.email,
            password: form.password,
            options: {
              data: { name: form.name || form.email.split('@')[0] },
              emailRedirectTo,
            },
          });

      if (authError) {
        setError(authError.message || (isLogin ? 'Invalid email or password.' : 'Could not create account.'));
        return;
      }
      if (!isLogin && data.user && !data.session) {
        setError('Check your email to finish creating your account.');
        return;
      }
      goNext();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const panel = (
    <section className={`auth-card ${isModal ? 'auth-card-modal' : ''}`}>
      {isModal && onClose && (
        <button type="button" className="auth-close" onClick={onClose} aria-label="Close" autoFocus>
          <X aria-hidden="true" />
        </button>
      )}
      {isModal ? (
        <div className="auth-logo">
          <span className="mark" />
          <span>Snackd</span>
        </div>
      ) : (
        <Link className="auth-logo" href="/">
          <span className="mark" />
          <span>Snackd</span>
        </Link>
      )}
      <h1>{isLogin ? 'Welcome back' : 'Create your account'}</h1>
      <p className="lead">{isLogin ? 'Sign in to continue.' : 'Create an account to continue.'}</p>

      {error && <div className="err" role="alert">{error}</div>}

      <button
        type="button"
        className="social-btn"
        onClick={() => void startSocial('google')}
        disabled={loading}
      >
        <GoogleIcon />
        <span>Continue with Google</span>
      </button>

      <div className="divider"><span>or</span></div>

      <form onSubmit={submitEmail}>
        {!isLogin && (
          <div className="fld">
            <label htmlFor="name">Display name</label>
            <input id="name" type="text" value={form.name} onChange={setField('name')} placeholder="Alex" />
          </div>
        )}
        <div className="fld">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={setField('email')}
            placeholder="you@example.com"
            required
          />
        </div>
        <div className="fld">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete={isLogin ? 'current-password' : 'new-password'}
            value={form.password}
            onChange={setField('password')}
            placeholder={isLogin ? 'Enter your password' : 'At least 8 characters'}
            minLength={isLogin ? undefined : 8}
            required
          />
        </div>
        <button className="submit" type="submit" disabled={loading}>
          {loading && <LoaderCircle className="button-spinner" aria-hidden="true" />}
          {loading ? 'Please wait...' : isLogin ? 'Sign in' : 'Create account'}
        </button>
      </form>

      <p className="alt">
        {isLogin ? (
          <>
            New here?{' '}
            {isModal ? (
              <button type="button" onClick={() => onModeChange?.('register')}>Create an account</button>
            ) : (
              <Link href={`/register?next=${encodeURIComponent(next)}`}>Create an account</Link>
            )}
          </>
        ) : (
          <>
            Already have an account?{' '}
            {isModal ? (
              <button type="button" onClick={() => onModeChange?.('login')}>Sign in</button>
            ) : (
              <Link href={`/login?next=${encodeURIComponent(next)}`}>Sign in</Link>
            )}
          </>
        )}
      </p>
      {!isModal && (
        <Link className="home-link" href="/">
          <ArrowLeft aria-hidden="true" />
          Back to feed
        </Link>
      )}
    </section>
  );

  if (isModal) return panel;

  return (
    <main className="auth">
      {panel}
    </main>
  );
}
