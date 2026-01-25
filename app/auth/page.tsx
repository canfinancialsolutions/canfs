
// app/auth/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const AUTH_COOKIE = 'canfs_auth';

function hasAuthCookie() {
  if (typeof document === 'undefined') return false;
  return document.cookie.split('; ').some((c) => c.startsWith(`${AUTH_COOKIE}=true`));
}

function setAuthCookie() {
  if (typeof document === 'undefined') return;
  const secure =
    typeof window !== 'undefined' && window.location?.protocol === 'https:' ? '; secure' : '';
  document.cookie = `${AUTH_COOKIE}=true; path=/; max-age=86400; samesite=lax${secure}`;
}

const DESTINATIONS = [
  { value: 'dashboard', label: 'Dashboard', path: '/dashboard' },
  { value: 'fna', label: 'Financial Need Analysis', path: '/fna' },
  { value: 'prospect', label: 'Prospect List', path: '/prospect' },
];

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [destination, setDestination] = useState<string>('dashboard');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // If already logged in (cookie present), go straight to dashboard
    if (hasAuthCookie()) {
      router.replace('/dashboard');
    }
  }, [router]);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // TODO: replace with real auth; for now, accept any non-empty credentials
    if (!email || !password) {
      setError('Please enter email and password');
      return;
    }

    // Set simple auth cookie – used by dashboard guard
    setAuthCookie();

    const dest = DESTINATIONS.find((d) => d.value === destination);
    const redirectTo = dest?.path ?? '/dashboard';

    router.replace(redirectTo);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 border border-slate-200">
        <div className="flex flex-col items-center mb-6">
          <div className="text-2xl font-bold text-slate-900">CAN Financial Solutions</div>
          <div className="text-xs text-slate-500 mt-1">Protecting Your Tomorrow</div>
        </div>

        <h2 className="text-lg font-semibold text-slate-800 mb-4 text-center">Admin Login</h2>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
            {error}
          </div>
        )}

        <form onSubmit={signIn} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              autoComplete="username"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Password</label>
            <input
              type="password"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Go to</label>
            <select
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400"
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

          <button
            type="submit"
            className="mt-2 w-full rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 text-sm"
          >
            Sign In → {DESTINATIONS.find((d) => d.value === destination)?.label ?? 'Dashboard'}
          </button>
        </form>

        <div className="mt-6 text-center text-[11px] text-slate-500">
          CAN Financial Solutions &mdash; Protecting Your Tomorrow
        </div>
      </div>
    </div>
  );
}
``
