// FNA Page Header - Fixed to match Prospect page styling
// This component should replace the header section in your FNA page

import { useRouter } from 'next/navigation';

interface FNAHeaderProps {
  onLogout?: () => void;
  errorMsg?: string | null;
  successMsg?: string | null;
}

export default function FNAHeader({ onLogout, errorMsg, successMsg }: FNAHeaderProps) {
  const router = useRouter();

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    } else {
      // Default logout behavior
      router.push('/');
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <img src="/can-logo.png" alt="CAN Financial Solutions" className="h-10 w-auto" />
          <div>
            <div className="text-xl font-bold text-blue-800">Financial Needs Analysis</div>
            <div className="text-sm text-slate-600">Select a client and complete all six sections of the FNA.</div>
          </div>
        </div>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition-colors border border-slate-300 bg-transparent hover:bg-slate-50 text-slate-700"
          onClick={handleLogout}
        >
          Logout ➜]
        </button>
      </div>

      {/* Toast Messages */}
      {errorMsg && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {successMsg}
        </div>
      )}
    </div>
  );
}
