// app/prospect/page.tsx
'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';

// Auth cookie utilities
const AUTH_COOKIE = 'canfs_auth';

function hasAuthCookie(): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie.split('; ').some((c) => c.startsWith(`${AUTH_COOKIE}=true`));
}

function clearAuthCookie(): void {
  if (typeof document === 'undefined') return;
  const secure =
    typeof window !== 'undefined' && window.location?.protocol === 'https:' ? '; secure' : '';
  document.cookie = `${AUTH_COOKIE}=; path=/; max-age=0; samesite=lax${secure}`;
}

import { createClient } from '@supabase/supabase-js';

type Prospect = {
  id: number;
  first_name: string; // NOT NULL
  last_name: string | null;
  spouse_name: string | null;
  relation_type: string | null; // Friend / Relative / Acquaintance / Referral/Others
  phone: string | null;
  city: string | null;
  state: string | null; // two-letter abbreviation
  top25: string | null; // Y / N
  immigration: string | null;
  age25plus: string | null; // Y / N
  married: string | null; // Y / N
  children: string | null; // Y / N
  homeowner: string | null; // Y / N
  good_career: string | null; // Y / N
  income_60k: string | null; // Y / N
  dissatisfied: string | null; // Y / N
  ambitious: string | null; // Y / N
  contact_date: string | null; // YYYY-MM-DD
  result: string | null; // Business / Both / Client Solution / In-Progress / Called / Not Interested / Others
  next_steps: string | null;
  comments: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type ProspectForm = {
  first_name: string;
  last_name: string;
  spouse_name: string;
  relation_type: string;
  phone: string;
  city: string;
  state: string;
  top25: string;
  immigration: string;
  age25plus: string;
  married: string;
  children: string;
  homeowner: string;
  good_career: string;
  income_60k: string;
  dissatisfied: string;
  ambitious: string;
  contact_date: string;
  result: string;
  next_steps: string;
  comments: string;
};

type SortConfig = {
  key: keyof Prospect | null;
  direction: 'asc' | 'desc';
};

const PAGE_SIZE = 10;

const RELATION_OPTIONS = ['', 'Friend', 'Relative', 'Acquaintance', 'Referral/Others'] as const;
const RESULT_OPTIONS = ['Business', 'Both', 'Client Solution', 'In-Progress', 'Called', 'Not Interested', 'Others'] as const;

const IMMIGRATION_STATUS_OPTIONS: string[] = [
  '',
  'U.S. Citizen',
  'U.S.Green Card',
  'H-1B',
  'H-1B/I-140 Approved',
  'L-1A',
  'L-1B',
  'F-1 Student',
  'F-1 OPT',
  'F-1 STEM OPT',
  'H-4 EAD',
  'E-3',
  'I-485 Pending',
  'I-485 EAD/AP',
  'Other Visa Status',
];

const STATES = [
  { abbr: 'AL', name: 'Alabama' },
  { abbr: 'AK', name: 'Alaska' },
  { abbr: 'AZ', name: 'Arizona' },
  { abbr: 'AR', name: 'Arkansas' },
  { abbr: 'CA', name: 'California' },
  { abbr: 'CO', name: 'Colorado' },
  { abbr: 'CT', name: 'Connecticut' },
  { abbr: 'DE', name: 'Delaware' },
  { abbr: 'DC', name: 'District of Columbia' },
  { abbr: 'FL', name: 'Florida' },
  { abbr: 'GA', name: 'Georgia' },
  { abbr: 'HI', name: 'Hawaii' },
  { abbr: 'ID', name: 'Idaho' },
  { abbr: 'IL', name: 'Illinois' },
  { abbr: 'IN', name: 'Indiana' },
  { abbr: 'IA', name: 'Iowa' },
  { abbr: 'KS', name: 'Kansas' },
  { abbr: 'KY', name: 'Kentucky' },
  { abbr: 'LA', name: 'Louisiana' },
  { abbr: 'ME', name: 'Maine' },
  { abbr: 'MD', name: 'Maryland' },
  { abbr: 'MA', name: 'Massachusetts' },
  { abbr: 'MI', name: 'Michigan' },
  { abbr: 'MN', name: 'Minnesota' },
  { abbr: 'MS', name: 'Mississippi' },
  { abbr: 'MO', name: 'Missouri' },
  { abbr: 'MT', name: 'Montana' },
  { abbr: 'NE', name: 'Nebraska' },
  { abbr: 'NV', name: 'Nevada' },
  { abbr: 'NH', name: 'New Hampshire' },
  { abbr: 'NJ', name: 'New Jersey' },
  { abbr: 'NM', name: 'New Mexico' },
  { abbr: 'NY', name: 'New York' },
  { abbr: 'NC', name: 'North Carolina' },
  { abbr: 'ND', name: 'North Dakota' },
  { abbr: 'OH', name: 'Ohio' },
  { abbr: 'OK', name: 'Oklahoma' },
  { abbr: 'OR', name: 'Oregon' },
  { abbr: 'PA', name: 'Pennsylvania' },
  { abbr: 'RI', name: 'Rhode Island' },
  { abbr: 'SC', name: 'South Carolina' },
  { abbr: 'SD', name: 'South Dakota' },
  { abbr: 'TN', name: 'Tennessee' },
  { abbr: 'TX', name: 'Texas' },
  { abbr: 'UT', name: 'Utah' },
  { abbr: 'VT', name: 'Vermont' },
  { abbr: 'VA', name: 'Virginia' },
  { abbr: 'WA', name: 'Washington' },
  { abbr: 'WV', name: 'West Virginia' },
  { abbr: 'WI', name: 'Wisconsin' },
  { abbr: 'WY', name: 'Wyoming' },
] as const;

const STATE_NAME_OPTIONS = STATES.map((s) => s.name);

const stateToName = (v?: string | null): string => {
  const raw = (v || '').trim();
  if (!raw) return '';

  // Handles legacy values like "TX - Texas" or "TX-Texas"
  if (raw.includes('-')) {
    const part = raw.split('-').slice(-1)[0]?.trim();
    if (part) return part;
  }

  const abbr = raw.toUpperCase();
  const found = STATES.find((s) => s.abbr === abbr);
  if (found) return found.name;

  // Assume it is already a state name
  return raw;
};

const yesNoNormalize = (v?: string | null): string => {
  const raw = (v || '').trim();
  const s = raw.toLowerCase();
  if (!s) return '';
  if (s === 'y' || s === 'yes' || s === 'true') return 'Yes';
  if (s === 'n' || s === 'no' || s === 'false') return 'No';
  // If already stored as 'Yes' / 'No' (any case), normalize capitalization
  if (s === 'yes') return 'Yes';
  if (s === 'no') return 'No';
  return raw;
};

const normText = (s: string): string =>
  s.trim().toLowerCase().replace(/[\u2010-\u2015\u2212]/g, "-");

const toNull = (s: string | null | undefined): string | null => {
  const v = (s ?? '').trim();
  return v.length ? v : null;
};

const emptyForm = (): ProspectForm => ({
  first_name: '',
  last_name: '',
  spouse_name: '',
  relation_type: '',
  phone: '',
  city: '',
  state: '',
  top25: '',
  immigration: '',
  age25plus: '',
  married: '',
  children: '',
  homeowner: '',
  good_career: '',
  income_60k: '',
  dissatisfied: '',
  ambitious: '',
  contact_date: '',
  result: '',
  next_steps: '',
  comments: '',
});

const toProspectForm = (p: Prospect): ProspectForm => ({
  first_name: p.first_name ?? '',
  last_name: p.last_name ?? '',
  spouse_name: p.spouse_name ?? '',
  relation_type: p.relation_type ?? '',
  phone: p.phone ?? '',
  city: p.city ?? '',
  state: stateToName(p.state),
  top25: yesNoNormalize(p.top25),
  immigration: p.immigration ?? '',
  age25plus: yesNoNormalize(p.age25plus),
  married: yesNoNormalize(p.married),
  children: yesNoNormalize(p.children),
  homeowner: yesNoNormalize(p.homeowner),
  good_career: yesNoNormalize(p.good_career),
  income_60k: yesNoNormalize(p.income_60k),
  dissatisfied: yesNoNormalize(p.dissatisfied),
  ambitious: yesNoNormalize(p.ambitious),
  contact_date: p.contact_date ?? '',
  result: p.result ?? '',
  next_steps: p.next_steps ?? '',
  comments: p.comments ?? '',
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Column configuration for resizing
type ColumnConfig = {
  key: string;
  label: string;
  defaultWidth: number;
};

const COLUMNS: ColumnConfig[] = [
  { key: 'first_name', label: 'First Name', defaultWidth: 120 },
  { key: 'last_name', label: 'Last Name', defaultWidth: 120 },
  { key: 'spouse_name', label: 'Spouse Name', defaultWidth: 120 },
  { key: 'relation_type', label: 'Relation Type', defaultWidth: 130 },
  { key: 'phone', label: 'Phone', defaultWidth: 130 },
  { key: 'city', label: 'City', defaultWidth: 100 },
  { key: 'state', label: 'State', defaultWidth: 100 },
  { key: 'top25', label: 'Top 25', defaultWidth: 80 },
  { key: 'immigration', label: 'Immigration', defaultWidth: 150 },
  { key: 'age25plus', label: 'Age 25+', defaultWidth: 80 },
  { key: 'married', label: 'Married', defaultWidth: 80 },
  { key: 'children', label: 'Children', defaultWidth: 80 },
  { key: 'homeowner', label: 'Homeowner', defaultWidth: 100 },
  { key: 'good_career', label: 'Good Career', defaultWidth: 110 },
  { key: 'income_60k', label: 'Income 60K', defaultWidth: 100 },
  { key: 'dissatisfied', label: 'Dissatisfied', defaultWidth: 100 },
  { key: 'ambitious', label: 'Ambitious', defaultWidth: 90 },
  { key: 'contact_date', label: 'Contact Date', defaultWidth: 120 },
  { key: 'result', label: 'Result', defaultWidth: 130 },
  { key: 'next_steps', label: 'Next Steps', defaultWidth: 150 },
];

// Simple UI components
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col">
      <label className="mb-1 text-xs font-semibold text-slate-700">{label}</label>
      {children}
    </div>
  );
}

function TextInput({
  compact,
  placeholder,
  value,
  onChange,
  disabled,
}: {
  compact?: boolean;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const h = compact ? 'h-9' : 'h-10';
  return (
    <input
      type="text"
      className={`${h} w-full rounded-lg border border-slate-200 px-2 text-xs`}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
    />
  );
}

function DateInput({
  compact,
  value,
  onChange,
  disabled,
}: {
  compact?: boolean;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const h = compact ? 'h-9' : 'h-10';
  return (
    <input
      type="date"
      className={`${h} w-full rounded-lg border border-slate-200 px-2 text-xs`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
    />
  );
}

function YesNoCheckbox({
  compact,
  value,
  onChange,
  disabled,
}: {
  compact?: boolean;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const h = compact ? 'h-9' : 'h-10';
  return (
    <select
      className={`${h} w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-900`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
    >
      <option value=""></option>
      <option value="Yes">Yes</option>
      <option value="No">No</option>
    </select>
  );
}

function CommentsEditor({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <textarea
      className="min-h-[80px] w-full resize-y rounded-lg border border-slate-200 px-2 py-2 text-xs"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
    />
  );
}

function SubCard({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-4">{children}</div>;
}

export default function ProspectPage() {
  const router = useRouter();
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [mode, setMode] = useState<'new' | 'edit'>('new');
  const [showCard, setShowCard] = useState(false);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [original, setOriginal] = useState<Prospect | null>(null);
  const [form, setForm] = useState<ProspectForm>(emptyForm());

  const [search, setSearch] = useState('');
  const [resultFilter, setResultFilter] = useState('ALL');
  const [page, setPage] = useState(1);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // NEW: Sorting state
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: null, direction: 'asc' });

  // NEW: Column widths state
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    COLUMNS.forEach(col => {
      initial[col.key] = col.defaultWidth;
    });
    return initial;
  });

  // NEW: Column resize functionality
  const [resizing, setResizing] = useState<{ key: string; startX: number; startWidth: number } | null>(null);

  useEffect(() => {
    if (!resizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizing) return;
      const diff = e.clientX - resizing.startX;
      const newWidth = Math.max(50, resizing.startWidth + diff);
      setColumnWidths(prev => ({ ...prev, [resizing.key]: newWidth }));
    };

    const handleMouseUp = () => {
      setResizing(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizing]);

  const startResize = (e: React.MouseEvent, key: string) => {
    e.preventDefault();
    e.stopPropagation();
    setResizing({
      key,
      startX: e.clientX,
      startWidth: columnWidths[key],
    });
  };

  // NEW: Sort handler
  const handleSort = (key: keyof Prospect) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const setToast = (type: 'success' | 'error', msg: string) => {
    if (type === 'error') {
      setErrorMsg(msg);
      setSuccessMsg(null);
    } else {
      setSuccessMsg(msg);
      setErrorMsg(null);
    }
    setTimeout(() => {
      setErrorMsg(null);
      setSuccessMsg(null);
    }, 5000);
  };

  // Auth
  useEffect(() => {
    if (!hasAuthCookie()) {
      router.push('/auth');
    }
  }, [router]);

  const logout = () => {
    clearAuthCookie();
    router.push('/auth');
  };

  // Load prospects on mount
  useEffect(() => {
    void loadProspects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ensure form is updated when entering edit mode with a selected prospect
  useEffect(() => {
    if (mode === 'edit' && activeId && showCard) {
      const p = prospects.find((x) => x.id === activeId);
      if (p && JSON.stringify(toProspectForm(p)) !== JSON.stringify(form)) {
        setForm(toProspectForm(p));
        setOriginal(p);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, activeId, showCard, prospects]);

  const loadProspects = async () => {
    setLoading(true);
    setErrorMsg(null);

    const { data, error } = await supabase.from('prospects').select('*').order('id', { ascending: false });

    if (error) {
      setToast('error', `Error loading prospects: ${error.message}`);
      setProspects([]);
    } else {
      setProspects(data || []);
    }
    setLoading(false);
  };

  // Filter and sort prospects
  const filtered = useMemo(() => {
    let arr = prospects.slice();

    // Filter by text search
    if (search.trim()) {
      const norm = normText(search);
      arr = arr.filter((p) => {
        const fname = normText(p.first_name ?? '');
        const lname = normText(p.last_name ?? '');
        const spouse = normText(p.spouse_name ?? '');
        const phone = normText(p.phone ?? '');
        return fname.includes(norm) || lname.includes(norm) || spouse.includes(norm) || phone.includes(norm);
      });
    }

    // Filter by result
    if (resultFilter !== 'ALL') {
      arr = arr.filter((p) => {
        const res = (p.result ?? '').trim();
        return res === resultFilter;
      });
    }

    // NEW: Apply sorting
    if (sortConfig.key) {
      arr.sort((a, b) => {
        const aVal = a[sortConfig.key!];
        const bVal = b[sortConfig.key!];
        
        // Handle null/undefined
        if (aVal === null || aVal === undefined) return sortConfig.direction === 'asc' ? 1 : -1;
        if (bVal === null || bVal === undefined) return sortConfig.direction === 'asc' ? -1 : 1;
        
        // Compare values
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          const comparison = aVal.localeCompare(bVal);
          return sortConfig.direction === 'asc' ? comparison : -comparison;
        }
        
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
        }
        
        // Default string comparison
        const comparison = String(aVal).localeCompare(String(bVal));
        return sortConfig.direction === 'asc' ? comparison : -comparison;
      });
    } else {
      // Default: Sort by ID descending (newest first)
      arr.sort((a, b) => (b.id ?? 0) - (a.id ?? 0));
    }

    return arr;
  }, [prospects, search, resultFilter, sortConfig]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  const pageRows = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, safePage]);

  const requiredFilled = !!form.first_name.trim() && !!form.last_name.trim() && !!form.phone.trim();

  const dirty = useMemo(() => {
    if (!original) return false;
    const orig = toProspectForm(original);
    return JSON.stringify(form) !== JSON.stringify(orig);
  }, [form, original]);

  // Actions
  const beginNewProspect = () => {
    if (saving) return;
    setMode('new');
    setActiveId(null);
    setOriginal(null);
    setForm(emptyForm());
    setShowCard(true);
  };

  const handleSelectRow = (p: Prospect) => {
    if (saving) return;
    setActiveId(p.id);
  };

  const handleShowProspect = () => {
    if (saving) return;
    if (!activeId) {
      setToast('error', 'Select a row first.');
      return;
    }
    const p = prospects.find((x) => x.id === activeId);
    if (!p) {
      setToast('error', 'Row not found.');
      return;
    }

    setOriginal(p);
    setForm(toProspectForm(p));
    setMode('edit');
    setShowCard(true);
  };

  const handleTopAction = async () => {
    if (saving) return;

    // Edit mode => save
    if (showCard && mode === 'edit') {
      await saveEdit();
      return;
    }

    // Otherwise => begin editing the selected row
    if (!activeId) {
      setToast('error', 'Select a row first.');
      return;
    }
    const p = prospects.find((x) => x.id === activeId);
    if (!p) {
      setToast('error', 'Row not found.');
      return;
    }

    setOriginal(p);
    setForm(toProspectForm(p));
    setMode('edit');
    setShowCard(true);
  };

  const saveNew = async () => {
    if (saving) return;
    if (!requiredFilled) {
      setToast('error', 'Missing required fields (First Name, Last Name, Phone).');
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    const { error } = await supabase.from('prospects').insert([
      {
        first_name: form.first_name.trim(),
        last_name: toNull(form.last_name),
        spouse_name: toNull(form.spouse_name),
        relation_type: toNull(form.relation_type),
        phone: toNull(form.phone),
        city: toNull(form.city),
        state: toNull(form.state),
        top25: toNull(form.top25),
        immigration: toNull(form.immigration),
        age25plus: toNull(form.age25plus),
        married: toNull(form.married),
        children: toNull(form.children),
        homeowner: toNull(form.homeowner),
        good_career: toNull(form.good_career),
        income_60k: toNull(form.income_60k),
        dissatisfied: toNull(form.dissatisfied),
        ambitious: toNull(form.ambitious),
        contact_date: toNull(form.contact_date),
        result: toNull(form.result),
        next_steps: toNull(form.next_steps),
        comments: toNull(form.comments),
      },
    ]);

    setSaving(false);

    if (error) {
      setToast('error', `Error saving: ${error.message}`);
      return;
    }

    setToast('success', 'Saved.');
    setShowCard(false);
    setMode('new');
    setActiveId(null);
    setOriginal(null);
    setForm(emptyForm());
    await loadProspects();
  };

  const saveEdit = async () => {
    if (saving) return;
    if (!requiredFilled) {
      setToast('error', 'Missing required fields (First Name, Last Name, Phone).');
      return;
    }
    if (!activeId) return;

    setSaving(true);
    setErrorMsg(null);

    const { error } = await supabase
      .from('prospects')
      .update({
        first_name: form.first_name.trim(),
        last_name: toNull(form.last_name),
        spouse_name: toNull(form.spouse_name),
        relation_type: toNull(form.relation_type),
        phone: toNull(form.phone),
        city: toNull(form.city),
        state: toNull(form.state),
        top25: toNull(form.top25),
        immigration: toNull(form.immigration),
        age25plus: toNull(form.age25plus),
        married: toNull(form.married),
        children: toNull(form.children),
        homeowner: toNull(form.homeowner),
        good_career: toNull(form.good_career),
        income_60k: toNull(form.income_60k),
        dissatisfied: toNull(form.dissatisfied),
        ambitious: toNull(form.ambitious),
        contact_date: toNull(form.contact_date),
        result: toNull(form.result),
        next_steps: toNull(form.next_steps),
        comments: toNull(form.comments),
      })
      .eq('id', activeId);

    setSaving(false);

    if (error) {
      setToast('error', `Error updating: ${error.message}`);
      return;
    }

    setToast('success', 'Updated.');
    await loadProspects();
    setShowCard(false);
  };

  const handleCloseEdit = () => {
    if (saving) return;
    setShowCard(false);
    setActiveId(null);
    setOriginal(null);
    setForm(emptyForm());
  };

  const handleDelete = async () => {
    if (saving) return;
    if (!activeId) {
      setToast('error', 'Select a row first.');
      return;
    }

    const confirmed = confirm('Delete this prospect?');
    if (!confirmed) return;

    setSaving(true);
    setErrorMsg(null);

    const { error } = await supabase.from('prospects').delete().eq('id', activeId);

    setSaving(false);

    if (error) {
      setToast('error', `Error deleting: ${error.message}`);
      return;
    }

    setToast('success', 'Deleted.');
    setShowCard(false);
    setActiveId(null);
    setOriginal(null);
    setForm(emptyForm());
    await loadProspects();
  };

  const handleRefresh = async () => {
    if (saving) return;
    setSearch('');
    setResultFilter('ALL');
    setPage(1);
    setActiveId(null);
    setOriginal(null);
    setForm(emptyForm());
    setMode('new');
    setShowCard(false);
    await loadProspects();
  };

  const topActionLabel = showCard && mode === 'edit' ? 'Save' : 'Edit Prospect';
  const canTopAction = showCard && mode === 'edit' ? requiredFilled && dirty && !saving : !!activeId && !saving;

  const bottomPrimaryLabel = !showCard ? 'New Prospect' : 'Save New Prospect';
  const canBottomAction = !showCard ? !saving : mode === 'new' ? requiredFilled && !saving : false;

  const selected = prospects.find((p) => p.id === activeId);

  // NEW: Sort indicator component
  const SortIndicator = ({ columnKey }: { columnKey: string }) => {
    if (sortConfig.key !== columnKey) {
      return <span className="ml-1 text-slate-400">⇅</span>;
    }
    return <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>;
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-[1400px] mx-auto p-6 space-y-6">
        {/* Header - Matching FNA page style */}
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <img src="/acn-logo.png" alt="ACN Advancement & Care Network" className="h-10 w-auto" />
              <div>
                <div className="text-1x3 font-bold text-[#1E5AA8]">Prospect List Tracking</div>
                 <div className="text-sm font-semibold text-[#FFD700]">Advancing Careers, Caring for Families</div>
              </div>
            </div>
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition-colors border border-slate-300 bg-transparent text-slate-700"
              onClick={logout}
            >
              Logout ➜
            </button>
          </div>

          {/* Toasts */}
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

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="px-6 py-5 space-y-4">
            {/* Controls */}
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-1 flex-col gap-2 md:flex-row md:items-center">
                <input
                  type="text"
                  placeholder="Search by first name, last name, spouse name, or phone..."
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm md:w-96"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                />

                <select
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm md:w-56"
                  value={resultFilter}
                  onChange={(e) => {
                    setResultFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="ALL">All Results</option>
                  {RESULT_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Show button - always visible, displays selected prospect */}
                <button
                  type="button"
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-60"
                  disabled={!activeId || saving}
                  onClick={handleShowProspect}
                  title={!activeId ? 'Select a row to view' : undefined}
                >
                  Show
                </button>

                <button
                  type="button"
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 hover:bg-slate-50"
                  onClick={handleRefresh}
                  disabled={saving}
                >
                  Refresh
                </button>

                <div className="text-sm text-slate-500">
                  Showing {filtered.length} of {prospects.length} {filtered.length === 1 ? 'prospect' : 'prospects'}
                </div>
              </div>
            </div>

            {/* Table with Excel-like features */}
            <div className="rounded-xl border border-slate-300 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full w-full text-sm border-collapse" style={{ tableLayout: 'fixed' }}>
                  <thead className="bg-slate-100 text-slate-700">
                    <tr>
                      {COLUMNS.map((col) => (
                        <th
                          key={col.key}
                          className="border border-slate-300 px-2 py-2 text-left font-semibold cursor-pointer hover:bg-slate-200 relative select-none"
                          style={{ width: `${columnWidths[col.key]}px`, minWidth: `${columnWidths[col.key]}px` }}
                          onClick={() => handleSort(col.key as keyof Prospect)}
                        >
                          <div className="flex items-center justify-between">
                            <span className="truncate">{col.label}</span>
                            <SortIndicator columnKey={col.key} />
                          </div>
                          {/* Resize handle */}
                          <div
                            className="absolute top-0 right-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 bg-slate-400"
                            onMouseDown={(e) => startResize(e, col.key)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={COLUMNS.length} className="border border-slate-300 px-3 py-6 text-center text-slate-500">
                          Loading...
                        </td>
                      </tr>
                    ) : pageRows.length === 0 ? (
                      <tr>
                        <td colSpan={COLUMNS.length} className="border border-slate-300 px-3 py-6 text-center text-slate-500">
                          No prospects found.
                        </td>
                      </tr>
                    ) : (
                      pageRows.map((p) => {
                        const isActive = p.id === activeId;
                        return (
                          <tr
                            key={p.id}
                            onClick={() => handleSelectRow(p)}
                            className={`cursor-pointer ${
                              isActive ? 'bg-emerald-50' : 'hover:bg-slate-50'
                            }`}
                          >
                            <td className="border border-slate-300 px-2 py-2 text-xs text-slate-900 font-semibold truncate" style={{ width: `${columnWidths['first_name']}px` }}>{p.first_name}</td>
                            <td className="border border-slate-300 px-2 py-2 text-xs text-slate-700 truncate" style={{ width: `${columnWidths['last_name']}px` }}>{p.last_name}</td>
                            <td className="border border-slate-300 px-2 py-2 text-xs text-slate-700 truncate" style={{ width: `${columnWidths['spouse_name']}px` }}>{p.spouse_name}</td>
                            <td className="border border-slate-300 px-2 py-2 text-xs text-slate-700 truncate" style={{ width: `${columnWidths['relation_type']}px` }}>{p.relation_type}</td>
                            <td className="border border-slate-300 px-2 py-2 text-xs text-slate-700 truncate" style={{ width: `${columnWidths['phone']}px` }}>{p.phone}</td>
                            <td className="border border-slate-300 px-2 py-2 text-xs text-slate-700 truncate" style={{ width: `${columnWidths['city']}px` }}>{p.city}</td>
                            <td className="border border-slate-300 px-2 py-2 text-xs text-slate-700 truncate" style={{ width: `${columnWidths['state']}px` }}>{p.state}</td>
                            <td className={`border border-slate-300 px-2 py-2 text-xs truncate ${p.top25 === 'Yes' || p.top25 === 'Y' ? 'text-emerald-700 font-semibold' : 'text-slate-700'}`} style={{ width: `${columnWidths['top25']}px` }}>{yesNoNormalize(p.top25)}</td>
                            <td className="border border-slate-300 px-2 py-2 text-xs text-slate-600 truncate" style={{ width: `${columnWidths['immigration']}px` }}>{p.immigration}</td>
                            <td className={`border border-slate-300 px-2 py-2 text-xs truncate ${p.age25plus === 'Yes' || p.age25plus === 'Y' ? 'text-emerald-700 font-semibold' : 'text-slate-700'}`} style={{ width: `${columnWidths['age25plus']}px` }}>{yesNoNormalize(p.age25plus)}</td>
                            <td className={`border border-slate-300 px-2 py-2 text-xs truncate ${p.married === 'Yes' || p.married === 'Y' ? 'text-emerald-700 font-semibold' : 'text-slate-700'}`} style={{ width: `${columnWidths['married']}px` }}>{yesNoNormalize(p.married)}</td>
                            <td className={`border border-slate-300 px-2 py-2 text-xs truncate ${p.children === 'Yes' || p.children === 'Y' ? 'text-emerald-700 font-semibold' : 'text-slate-700'}`} style={{ width: `${columnWidths['children']}px` }}>{yesNoNormalize(p.children)}</td>
                            <td className={`border border-slate-300 px-2 py-2 text-xs truncate ${p.homeowner === 'Yes' || p.homeowner === 'Y' ? 'text-emerald-700 font-semibold' : 'text-slate-700'}`} style={{ width: `${columnWidths['homeowner']}px` }}>{yesNoNormalize(p.homeowner)}</td>
                            <td className={`border border-slate-300 px-2 py-2 text-xs truncate ${p.good_career === 'Yes' || p.good_career === 'Y' ? 'text-emerald-700 font-semibold' : 'text-slate-700'}`} style={{ width: `${columnWidths['good_career']}px` }}>{yesNoNormalize(p.good_career)}</td>
                            <td className={`border border-slate-300 px-2 py-2 text-xs truncate ${p.income_60k === 'Yes' || p.income_60k === 'Y' ? 'text-emerald-700 font-semibold' : 'text-slate-700'}`} style={{ width: `${columnWidths['income_60k']}px` }}>{yesNoNormalize(p.income_60k)}</td>
                            <td className={`border border-slate-300 px-2 py-2 text-xs truncate ${p.dissatisfied === 'Yes' || p.dissatisfied === 'Y' ? 'text-emerald-700 font-semibold' : 'text-slate-700'}`} style={{ width: `${columnWidths['dissatisfied']}px` }}>{yesNoNormalize(p.dissatisfied)}</td>
                            <td className={`border border-slate-300 px-2 py-2 text-xs truncate ${p.ambitious === 'Yes' || p.ambitious === 'Y' ? 'text-emerald-700 font-semibold' : 'text-slate-700'}`} style={{ width: `${columnWidths['ambitious']}px` }}>{yesNoNormalize(p.ambitious)}</td>
                            <td className="border border-slate-300 px-2 py-2 text-xs text-slate-600 truncate" style={{ width: `${columnWidths['contact_date']}px` }}>{p.contact_date}</td>
                            <td className="border border-slate-300 px-2 py-2 text-xs text-slate-900 font-medium truncate" style={{ width: `${columnWidths['result']}px` }}>{p.result}</td>
                            <td className="border border-slate-300 px-2 py-2 text-xs text-slate-700 truncate" style={{ width: `${columnWidths['next_steps']}px` }}>{p.next_steps}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between">
              <button
                type="button"
                className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-50"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1 || saving}
              >
                Previous
              </button>
              <div className="text-sm text-slate-600">
                Page {safePage} of {totalPages}
              </div>
              <button
                type="button"
                className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-50"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages || saving}
              >
                Next
              </button>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 border-t border-slate-200 pt-4">
              <button
                type="button"
                className="inline-flex h-10 items-center justify-center rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                onClick={!showCard ? beginNewProspect : saveNew}
                disabled={!canBottomAction}
              >
                {bottomPrimaryLabel}
              </button>

              <button
                type="button"
                className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-50"
                onClick={handleTopAction}
                disabled={!canTopAction}
              >
                {topActionLabel}
              </button>

              <button
                type="button"
                className="inline-flex h-10 items-center justify-center rounded-lg border border-red-200 bg-white px-4 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                onClick={handleDelete}
                disabled={!activeId || saving}
              >
                Delete
              </button>
            </div>
          </div>

          {/* Edit/New Form Card */}
          {showCard && (
            <div className="border-t border-slate-200 bg-slate-50 px-6 py-5">
              <div className="flex items-start justify-between gap-2 mb-4">
                <div className="text-base font-bold text-slate-900">
                  {mode === 'edit' && selected ? `Editing: ${selected.first_name} ${selected.last_name ?? ''}`.trim() : 'New Prospect'}
                </div>
                {mode === 'edit' && (
                  <button
                    type="button"
                    className="inline-flex h-10 items-center justify-center rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                    onClick={saveEdit}
                    disabled={saving || !requiredFilled}
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                )}
                <button
                  type="button"
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-50"
                  onClick={handleCloseEdit}
                  disabled={saving}
                >
                  Close
                </button>
              </div>

              {/* Form layout */}
              <div className="space-y-3">
                <SubCard>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
                    <Field label="First Name *">
                      <TextInput
                        compact
                        placeholder="First Name"
                        value={form.first_name}
                        onChange={(v: string) => setForm((p) => ({ ...p, first_name: v }))}
                        disabled={saving}
                      />
                    </Field>

                    <Field label="Last Name *">
                      <TextInput
                        compact
                        placeholder="Last Name"
                        value={form.last_name}
                        onChange={(v: string) => setForm((p) => ({ ...p, last_name: v }))}
                        disabled={saving}
                      />
                    </Field>

                    <Field label="Spouse Name">
                      <TextInput
                        compact
                        placeholder="Spouse Name"
                        value={form.spouse_name}
                        onChange={(v: string) => setForm((p) => ({ ...p, spouse_name: v }))}
                        disabled={saving}
                      />
                    </Field>

                    <Field label="Relation Type">
                      <select
                        className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-900"
                        value={form.relation_type}
                        onChange={(e) => setForm((p) => ({ ...p, relation_type: e.target.value }))}
                        disabled={saving}
                      >
                        {RELATION_OPTIONS.map((o) => (
                          <option key={o} value={o}>
                            {o || 'Select...'}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                </SubCard>

                <SubCard>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
                    <Field label="Phone *">
                      <TextInput
                        compact
                        placeholder="Phone"
                        value={form.phone}
                        onChange={(v: string) => setForm((p) => ({ ...p, phone: v }))}
                        disabled={saving}
                      />
                    </Field>

                    <Field label="City">
                      <TextInput
                        compact
                        placeholder="City"
                        value={form.city}
                        onChange={(v: string) => setForm((p) => ({ ...p, city: v }))}
                        disabled={saving}
                      />
                    </Field>

                    <Field label="State">
                      <select
                        className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-900"
                        value={form.state}
                        onChange={(e) => setForm((p) => ({ ...p, state: e.target.value }))}
                        disabled={saving}
                      >
                        <option value=""></option>
                        {STATE_NAME_OPTIONS.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field label="Immigration">
                      <select
                        className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-900"
                        value={form.immigration}
                        onChange={(e) => setForm((p) => ({ ...p, immigration: e.target.value }))}
                        disabled={saving}
                      >
                        {IMMIGRATION_STATUS_OPTIONS.map((o) => (
                          <option key={o} value={o}>
                            {o || 'Select...'}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                </SubCard>

                <SubCard>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9">
                    <Field label="Top 25">
                      <YesNoCheckbox compact value={form.top25} onChange={(v: string) => setForm((p) => ({ ...p, top25: v }))} disabled={saving} />
                    </Field>

                    <Field label="Age 25+">
                      <YesNoCheckbox compact value={form.age25plus} onChange={(v: string) => setForm((p) => ({ ...p, age25plus: v }))} disabled={saving} />
                    </Field>

                    <Field label="Married">
                      <YesNoCheckbox compact value={form.married} onChange={(v: string) => setForm((p) => ({ ...p, married: v }))} disabled={saving} />
                    </Field>

                    <Field label="Children">
                      <YesNoCheckbox compact value={form.children} onChange={(v: string) => setForm((p) => ({ ...p, children: v }))} disabled={saving} />
                    </Field>

                    <Field label="Homeowner">
                      <YesNoCheckbox compact value={form.homeowner} onChange={(v: string) => setForm((p) => ({ ...p, homeowner: v }))} disabled={saving} />
                    </Field>

                    <Field label="Good Career">
                      <YesNoCheckbox compact value={form.good_career} onChange={(v: string) => setForm((p) => ({ ...p, good_career: v }))} disabled={saving} />
                    </Field>

                    <Field label="Income 60K">
                      <YesNoCheckbox compact value={form.income_60k} onChange={(v: string) => setForm((p) => ({ ...p, income_60k: v }))} disabled={saving} />
                    </Field>

                    <Field label="Dissatisfied">
                      <YesNoCheckbox compact value={form.dissatisfied} onChange={(v: string) => setForm((p) => ({ ...p, dissatisfied: v }))} disabled={saving} />
                    </Field>

                    <Field label="Ambitious">
                      <YesNoCheckbox compact value={form.ambitious} onChange={(v: string) => setForm((p) => ({ ...p, ambitious: v }))} disabled={saving} />
                    </Field>
                  </div>
                </SubCard>

                <SubCard>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <Field label="Contact Date">
                      <DateInput
                        compact
                        value={form.contact_date}
                        onChange={(v: string) => setForm((p) => ({ ...p, contact_date: v }))}
                        disabled={saving}
                      />
                    </Field>

                    <Field label="Result">
                      <select
                        className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-900"
                        value={form.result}
                        onChange={(e) => setForm((p) => ({ ...p, result: e.target.value }))}
                        disabled={saving}
                      >
                        {RESULT_OPTIONS.map((o) => (
                          <option key={o} value={o}>
                            {o || 'Select...'}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field label="Next Steps">
                      <TextInput
                        compact
                        placeholder="Next Steps"
                        value={form.next_steps}
                        onChange={(v: string) => setForm((p) => ({ ...p, next_steps: v }))}
                        disabled={saving}
                      />
                    </Field>
                  </div>
                </SubCard>

                <SubCard>
                  <Field label="Comments">
                    <CommentsEditor value={form.comments} onChange={(v: string) => setForm((p) => ({ ...p, comments: v }))} disabled={saving} />
                  </Field>
                </SubCard>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
