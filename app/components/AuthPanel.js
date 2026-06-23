'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { authClient } from '@/lib/auth/client';

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

function MicrosoftIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path fill="#F25022" d="M1 1h10.4v10.4H1z" />
      <path fill="#7FBA00" d="M12.6 1H23v10.4H12.6z" />
      <path fill="#00A4EF" d="M1 12.6h10.4V23H1z" />
      <path fill="#FFB900" d="M12.6 12.6H23V23H12.6z" />
    </svg>
  );
}

export default function AuthPanel({ mode = 'login' }) {
  const isLogin = mode === 'login';
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || '/';
  const initialError = params.get('error');

  const [error, setError] = useState(initialError ? 'Sign-in failed. Please try again.' : '');
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  function goNext() {
    router.push(next);
    router.refresh();
  }

  async function startSocial(provider) {
    setError('');
    setLoading(true);
    try {
      // Neon Auth redirects to the provider, then back to callbackURL.
      const callbackURL = `${window.location.origin}${next}`;
      const { error: err } = await authClient.signIn.social({ provider, callbackURL });
      if (err) {
        setError(err.message || `Could not sign in with ${provider}.`);
        setLoading(false);
      }
      // On success the browser is redirected by the SDK.
    } catch {
      setError('Something went wrong starting social sign-in.');
      setLoading(false);
    }
  }

  async function submitEmail(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { error: err } = isLogin
        ? await authClient.signIn.email({
            email: form.email,
            password: form.password,
          })
        : await authClient.signUp.email({
            email: form.email,
            password: form.password,
            name: form.name || form.email.split('@')[0],
          });

      if (err) {
        setError(err.message || (isLogin ? 'Invalid email or password.' : 'Could not create account.'));
        return;
      }
      goNext();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth">
      <div className="auth-card">
        <div className="auth-logo">
          <span className="mark" />
          <span>Snackd</span>
        </div>
        <h1>{isLogin ? 'Welcome back' : 'Create your account'}</h1>
        <p className="lead">
          {isLogin
            ? 'Sign in to like shorts and open the studio.'
            : 'Join to like shorts, follow creators, and create.'}
        </p>

        {error && <div className="err">{error}</div>}

        <div className="social-row">
          <button type="button" className="social-btn" onClick={() => startSocial('google')} disabled={loading}>
            <GoogleIcon />
            <span>Continue with Google</span>
          </button>
          <button type="button" className="social-btn" onClick={() => startSocial('microsoft')} disabled={loading}>
            <MicrosoftIcon />
            <span>Continue with Microsoft</span>
          </button>
        </div>

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
              placeholder={isLogin ? '••••••••' : 'At least 8 characters'}
              required
            />
          </div>
          <button className="submit" type="submit" disabled={loading}>
            {loading ? 'Please wait…' : isLogin ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p className="alt">
          {isLogin ? (
            <>New here? <Link href="/register">Create an account</Link></>
          ) : (
            <>Already have an account? <Link href="/login">Sign in</Link></>
          )}
        </p>
        <Link className="home-link" href="/">← Back to feed</Link>
      </div>
    </div>
  );
}
