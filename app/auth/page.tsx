
// app/auth/page.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
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

/**
 * ✅ FIX:
 * Financial Need Analysis should route to Dashboard instead of /fna.
 * So we map it to /dashboard.
 */
const DESTINATIONS = [
  { value: 'dashboard', label: 'Dashboard', path: '/dashboard' },
  { value: 'fna', label: 'Financial Need Analysis', path: '/dashboard' }, // <-- FIXED
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
    // ✅ Extra safety:
    // If destination is 'fna', always send to dashboard
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
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow p-8">
        <div className="text-center mb-6">
          <div className="text-xl font-semibold">CAN Financial Solutions</div>
          <div className="text-sm text-slate-500">Protecting Your Tomorrow</div>
        </div>

        <h3 className="text-lg font-semibold mb-4">Admin Login</h3>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={signIn} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Email
            </label>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              autoComplete="username"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Password
            </label>
            <input
              type="password"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Go to
            </label>
            <select
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
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
            className="w-full rounded-lg bg-slate-900 text-white py-2.5 font-medium hover:bg-slate-800 transition"
          >
            Sign In →{' '}
            {DESTINATIONS.find((d) => d.value === destination)?.label ??
              'Dashboard'}
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-slate-500">
          CAN Financial Solutions — Protecting Your Tomorrow
        </div>
      </div>
    </div>
  );
}
