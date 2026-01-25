
// app/auth/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

const AUTH_COOKIE = 'canfs_auth';

function hasAuthCookie() {
  if (typeof document === 'undefined') return false;
  return document.cookie
    .split('; ')
    .some((c) => c.startsWith(`${AUTH_COOKIE}=true`));
}

function setAuthCookie() {
  if (typeof document === 'undefined') return;
  const secure =
    typeof window !== 'undefined' && window.location?.protocol === 'https:'
      ? '; secure'
      : '';
  document.cookie = `${AUTH_COOKIE}=true; path=/; max-age=86400; samesite=lax${secure}`;
}

// ✅ FIX: Financial Need Analysis should navigate to Dashboard, not /fna.
const DESTINATIONS = [
  { value: 'dashboard', label: 'Dashboard', path: '/dashboard' },
  { value: 'fna', label: 'Financial Need Analysis', path: '/fna' }, // <-- FIXED
  { value: 'prospect', label: 'Prospect List', path: '/prospect' },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [destination, setDestination] = useState('dashboard');
  const [error, setError] = useState<string | null>(null);

  // Read ?next=/... only on client (safe for builds)
  const [nextPath, setNextPath] = useState<string | null>(null);

  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const n = sp.get('next');
      setNextPath(n && n.startsWith('/') ? n : null);
    } catch {
      setNextPath(null);
    }
  }, []);

  const selectedPath = useMemo(() => {
    // ✅ Safety guard: even if destination is 'fna', always go to dashboard
    if (destination === 'fna') return '/dashboard';

    const dest = DESTINATIONS.find((d) => d.value === destination);
    return dest?.path ?? '/dashboard';
  }, [destination]);

  useEffect(() => {
    // ✅ If cookie exists, respect next (if provided). Otherwise default to dashboard.
    if (hasAuthCookie()) {
      router.replace(nextPath ?? '/dashboard');
    }
  }, [router, nextPath]);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError('Please enter email and password');
      return;
    }

    // Set cookie auth
    setAuthCookie();

    // ✅ After login, prefer next when present; otherwise go to chosen destination
    // (FNA now routes to dashboard)
    router.replace(nextPath ?? selectedPath);
  };

  return (
    <>
      <div>
        CAN Financial Solutions
        <div>Protecting Your Tomorrow</div>
        <h3>### Admin Login</h3>

        {error && (
          <div>
            {error}
          </div>
        )}

        <form onSubmit={signIn}>
          <div>
            Email{' '}
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              autoComplete="username"
            />
          </div>

          <div>
            Password{' '}
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          <div>
            Go to{' '}
            <select
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
            >
              {DESTINATIONS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>

          <button type="submit">
            Sign In →{' '}
            {DESTINATIONS.find((d) => d.value === destination)?.label ??
              'Dashboard'}
          </button>
        </form>

        <div>CAN Financial Solutions — Protecting Your Tomorrow</div>
      </div>
    </>
  );
}
