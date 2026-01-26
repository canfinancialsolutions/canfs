// app/dashboard/page.tsx
"use client";

/** 
 * CAN Financial Solutions – Dashboard
 * With fixed authentication and logout behavior
 */

import React, { useEffect, useMemo, useRef, useState } from "react"; 
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx"; 
import { 
  addDays, 
  addMonths, 
  format, 
  isValid, 
  parseISO, 
  startOfMonth, 
  subMonths, 
  subDays, 
  endOfMonth, 
} from "date-fns"; 
import { 
  ResponsiveContainer, 
  XAxis, 
  YAxis, 
  Tooltip, 
  BarChart, 
  Bar, 
  LabelList, 
} from "recharts"; 
import { getSupabase } from "@/lib/supabaseClient"; 
import { Button, Card } from "@/components/ui"; 
import { logout, hasAuthCookie } from "@/lib/auth";

export const dynamic = "force-dynamic"; 

type Row = Record<string, any>; 
type SortKey = 
  | "client" 
  | "created_at" 
  | "BOP_Date" 
  | "BOP_Status" 
  | "Followup_Date" 
  | "status" 
  | "CalledOn" 
  | "Issued"; 
type SortDir = "asc" | "desc"; 
type ProgressSortKey = 
  | "client_name" 
  | "last_call_date" 
  | "call_attempts" 
  | "last_bop_date" 
  | "bop_attempts" 
  | "last_followup_date" 
  | "followup_attempts"; 
const ALL_PAGE_SIZE = 10; 
const PROGRESS_PAGE_SIZE = 10;

const READONLY_LIST_COLS = new Set([ 
  "interest_type", 
  "business_opportunities", 
  "wealth_solutions", 
  "preferred_days", 
]); 

const DATE_TIME_KEYS = new Set([ 
  "BOP_Date", 
  "CalledOn", 
  "Followup_Date", 
  "FollowUp_Date", 
  "Issued", 
]); 
const DATE_ONLY_KEYS = new Set(["date_of_birth"]);

function dateOnOrAfterToday(dateVal: any): boolean { 
  if (!dateVal) return false; 
  const d = new Date(dateVal); 
  if (Number.isNaN(d.getTime())) return false; 
  const today = new Date(); 
  const dOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate()); 
  const tOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate()); 
  return dOnly.getTime() >= tOnly.getTime(); 
} 

const HIGHLIGHT_DATE_KEYS = new Set(["BOP_Date", "Followup_Date", "FollowUp_Date"]); 

const LABEL_OVERRIDES: Record<string, string> = { 
  client_name: "Client Name", 
  last_call_date: "Last Call On", 
  call_attempts: "No of Calls", 
  last_bop_date: "Last/Next BOP Call On", 
  bop_attempts: "No of BOP Calls", 
  last_followup_date: "Last/Next FollowUp On", 
  followup_attempts: "No of FollowUp Calls", 
  created_at: "Created Date", 
  interest_type: "Interest Type", 
  business_opportunities: "Business Opportunities", 
  wealth_solutions: "Wealth Solutions", 
  preferred_days: "Preferred Days", 
  preferred_time: "Preferred Time", 
  referred_by: "Referred By", 
  Profession: "Profession", 
  Product: "Products Sold", 
  Comment: "Comment", 
  Remark: "Remark", 
  CalledOn: "Called On", 
  BOP_Date: "BOP Date", 
  BOP_Status: "BOP Status", 
  Followup_Date: "Follow-Up Date", 
  FollowUp_Status: "Follow-Up Status", 
  spouse_name: "Spouse Name", 
  date_of_birth: "Date Of Birth", 
  children: "Children", 
  city: "City", 
  state: "State", 
  immigration_status: "Immigration Status", 
  work_details: "Work Details", 
}; 

function labelFor(key: string) { 
  if (LABEL_OVERRIDES[key]) return LABEL_OVERRIDES[key]; 
  const s = key.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").trim(); 
  const acronyms = new Set(["BOP", "ID", "API", "URL", "CAN"]); 
  return s 
    .split(/\s+/) 
    .map((w) => 
      acronyms.has(w.toUpperCase()) 
        ? w.toUpperCase() 
        : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() 
    ) 
    .join(" "); 
} 

function clientName(r: Row) { 
  return `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim(); 
} 

function toLocalInput(value: any) { 
  if (!value) return ""; 
  const d = new Date(value); 
  if (Number.isNaN(d.getTime())) return ""; 
  const pad = (n: number) => String(n).padStart(2, "0"); 
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad( 
    d.getHours() 
  )}:${pad(d.getMinutes())}`; 
} 

function toLocalDateInput(value: any) { 
  if (!value) return ""; 
  const d = new Date(value); 
  if (Number.isNaN(d.getTime())) return ""; 
  const pad = (n: number) => String(n).padStart(2, "0"); 
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; 
} 

function fromLocalInput(value: string) { 
  if (!value?.trim()) return null; 
  const d = new Date(value); 
  if (Number.isNaN(d.getTime())) return null; 
  return d.toISOString(); 
} 

function fromLocalDate(value: string) { 
  if (!value?.trim()) return null; 
  const parts = value.split("-"); 
  if (parts.length !== 3) return null; 
  const [y, m, d] = parts.map((x) => Number(x)); 
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1); 
  if (Number.isNaN(dt.getTime())) return null; 
  return dt.toISOString(); 
} 

function asListItems(value: any): string[] { 
  if (value == null) return []; 
  if (Array.isArray(value)) return value.map((v) => String(v)).filter(Boolean); 
  const s = String(value).trim(); 
  if (!s) return []; 
  if (s.includes(",")) return s.split(",").map((x) => x.trim()).filter(Boolean); 
  return [s]; 
} 

function toggleSort(cur: { key: SortKey; dir: SortDir }, k: SortKey) { 
  const DESC_FIRST = new Set<SortKey>(["CalledOn", "BOP_Date", "Followup_Date"]); 
  if (cur.key !== k) { 
    return { key: k, dir: (DESC_FIRST.has(k) ? "desc" : "asc") as SortDir }; 
  } 
  return { key: k, dir: cur.dir === "asc" ? ("desc" as SortDir) : ("asc" as SortDir) }; 
} 

function toggleProgressSort( 
  cur: { key: ProgressSortKey; dir: SortDir }, 
  k: ProgressSortKey 
) { 
  const DESC_FIRST = new Set<ProgressSortKey>([ 
    "last_call_date", 
    "last_bop_date", 
    "last_followup_date", 
  ]); 
  if (cur.key !== k) { 
    return { key: k, dir: (DESC_FIRST.has(k) ? "desc" : "asc") as SortDir }; 
  } 
  return { key: k, dir: cur.dir === "asc" ? ("desc" as SortDir) : ("asc" as SortDir) }; 
} 

function useColumnResizer() { 
  const [widths, setWidths] = useState<Record<string, number>>({}); 
  const resizeRef = useRef<{ 
    colId: string; 
    startX: number; 
    startW: number; 
    minW: number; 
  } | null>(null); 
  const startResize = ( 
    e: React.MouseEvent, 
    colId: string, 
    curWidth: number, 
    minW = 70 
  ) => { 
    e.preventDefault(); 
    e.stopPropagation(); 
    resizeRef.current = { colId, startX: e.clientX, startW: curWidth, minW }; 
    const onMove = (ev: MouseEvent) => { 
      if (!resizeRef.current) return; 
      const dx = ev.clientX - resizeRef.current.startX; 
      const next = Math.max(resizeRef.current.minW, resizeRef.current.startW + dx); 
      setWidths((prev) => ({ ...prev, [resizeRef.current!.colId]: next })); 
    }; 
    const onUp = () => { 
      resizeRef.current = null; 
      window.removeEventListener("mousemove", onMove); 
      window.removeEventListener("mouseup", onUp); 
    }; 
    window.addEventListener("mousemove", onMove); 
    window.addEventListener("mouseup", onUp); 
  }; 
  return { widths, setWidths, startResize }; 
} 

const US_STATE_OPTIONS: string[] = [ 
  "", 
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware", 
  "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", 
  "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota", "Mississippi", "Missouri", 
  "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey", "New Mexico", "New York", "North Carolina", 
  "North Dakota", "Ohio", "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota", 
  "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming", 
]; 

const IMMIGRATION_STATUS_OPTIONS: string[] = [ 
  "", 
  "U.S. Citizen", "U.S.Green Card", "H-1B", "H-1B/I-140 Approved", "L-1A", "L-1B", "F-1 Student", 
  "F-1 OPT", "F-1 STEM OPT", "H-4 EAD", "E-3", "I-485 Pending", "I-485 EAD/AP", "Other Visa Status", 
]; 

const STATUS_OPTIONS: Record<string, string[]> = { 
  status: ["", "Prospect Client", "New Client",  "Existing Client", "Referral Client", "Initiated", "In-Progress", "On-Hold", "Closed", "Completed"], 
  followup_status: ["", "Open", "In-Progress", "Follow-Up", "Follow-Up 2", "On Hold", "Completed"], 
  "follow-up_status": ["", "Open", "In-Progress", "Follow-Up", "Follow-Up 2", "On Hold", "Completed"], 
  client_status: ["", "New Client", "Initiated", "Interested", "In-Progress", "Closed", "On Hold", "Purchased", "Re-Opened", "Completed"],
  bop_status: ["", "Presented", "Business", "Client", "In-Progress", "On-Hold", "Clarification", "Not Interested", "Completed", "Closed"], 
  state: US_STATE_OPTIONS, 
  immigration_status: IMMIGRATION_STATUS_OPTIONS, 
}; 

function optionsForKey(k: string): string[] | null { 
  const lk = k.toLowerCase().replace(/\s+/g, "_"); 
  if (lk in STATUS_OPTIONS) return STATUS_OPTIONS[lk]; 
  return null; 
} 

export default function Dashboard() {
  const router = useRouter(); 
  const [authChecked, setAuthChecked] = useState(false);
  const [error, setError] = useState<string | null>(null); 
  const [daily60, setDaily60] = useState<{ day: string; calls?: number; bops?: number; followups?: number }[]>([]); 
  const [monthly12, setMonthly12] = useState<{ month: string; calls?: number; bops?: number; followups?: number }[]>([]); 
  const [trendLoading, setTrendLoading] = useState(false); 
  const [rangeStart, setRangeStart] = useState(format(new Date(), "yyyy-MM-dd")); 
  const [rangeEnd, setRangeEnd] = useState(format(addDays(new Date(), 30), "yyyy-MM-dd")); 
  const [upcoming, setUpcoming] = useState<Row[]>([]); 
  const [upcomingLoading, setUpcomingLoading] = useState(false); 
  const [sortUpcoming, setSortUpcoming] = useState<{ key: SortKey; dir: SortDir }>({ key: "BOP_Date", dir: "desc" }); 
  const [progressRows, setProgressRows] = useState<Row[]>([]); 
  const [progressLoading, setProgressLoading] = useState(false); 
  const [progressFilter, setProgressFilter] = useState(""); 
  const [progressSort, setProgressSort] = useState<{ key: ProgressSortKey; dir: SortDir }>({ key: "last_call_date", dir: "desc" }); 
  const [progressPage, setProgressPage] = useState(0); 
  const [q, setQ] = useState(""); 
  const [records, setRecords] = useState<Row[]>([]); 
  const [total, setTotal] = useState(0); 
  const [page, setPage] = useState(0); 
  const [pageJump, setPageJump] = useState("1"); 
  const [loading, setLoading] = useState(true); 
  const [savingId, setSavingId] = useState<string | null>(null); 
  const [sortAll, setSortAll] = useState<{ key: SortKey; dir: SortDir }>({ key: "created_at", dir: "desc" }); 
  const [recordsVisible, setRecordsVisible] = useState(false);  
  const [trendsVisible, setTrendsVisible] = useState(false);
  const [upcomingVisible, setUpcomingVisible] = useState(false);
  const [progressVisible, setProgressVisible] = useState(false);
 
  // Auth check on mount
  useEffect(() => {
    (async () => {
      try {
        // Check cookie-based auth first
        const cookieOk = hasAuthCookie();
        if (!cookieOk) {
          // Fallback to Supabase session check
          const supabase = getSupabase();
          const { data } = await supabase.auth.getSession();
          if (!data.session) {
            router.replace("/auth?next=/dashboard");
            return;
          }
        }
        setAuthChecked(true);
        await Promise.all([fetchTrends(), fetchProgressSummary(), loadPage(0)]);
      } catch (e: any) {
        setError(e?.message ?? "Failed to initialize");
        router.replace("/auth?next=/dashboard");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]); 
  
  useEffect(() => { 
    if (authChecked) loadPage(0); 
  }, [sortAll.key, sortAll.dir, authChecked]); 
  
  useEffect(() => { 
    if (authChecked && upcoming.length) fetchUpcoming(); 
  }, [sortUpcoming.key, sortUpcoming.dir, authChecked]); 
  
  useEffect(() => { 
    if (!authChecked) return;
    const id = setTimeout(() => { 
      loadPage(0); 
      setRecordsVisible(true); 
    }, 300); 
    return () => clearTimeout(id); 
  }, [q, authChecked]); 
  
  function applySort(query: any, sort: { key: SortKey; dir: SortDir }) { 
    const ascending = sort.dir === "asc"; 
    if (sort.key === "client") return query.order("first_name", { ascending }).order("last_name", { ascending }); 
    return query.order(sort.key, { ascending }); 
  } 
  
  async function fetchTrends() { 
    setTrendLoading(true); 
    setError(null); 
    try { 
      const supabase = getSupabase(); 
      const today = new Date(); 
      const startDaily = subDays(today, 59); 
      const [{ data: callsRows }, { data: bopsRows }, { data: fuRows }] = await Promise.all([ 
        supabase.from("client_registrations").select("CalledOn").gte("CalledOn", startDaily.toISOString()).order("CalledOn", { ascending: true }).limit(50000), 
        supabase.from("client_registrations").select("BOP_Date").gte("BOP_Date", startDaily.toISOString()).order("BOP_Date", { ascending: true }).limit(50000), 
        supabase.from("client_registrations").select("Followup_Date").gte("Followup_Date", startDaily.toISOString()).order("Followup_Date", { ascending: true }).limit(50000), 
      ]); 
      const days: string[] = []; 
      const callsDay = new Map<string, number>(); 
      const bopsDay = new Map<string, number>(); 
      const fuDay = new Map<string, number>(); 
      for (let i = 0; i < 60; i++) { 
        const d = addDays(startDaily, i); 
        const key = format(d, "yyyy-MM-dd"); 
        days.push(key); 
        callsDay.set(key, 0); 
        bopsDay.set(key, 0); 
        fuDay.set(key, 0); 
      } 
      const bumpDay = (dateVal: any, map: Map<string, number>) => { 
        if (!dateVal) return; 
        const d = parseISO(String(dateVal)); 
        if (!isValid(d)) return; 
        const k = format(d, "yyyy-MM-dd"); 
        if (map.has(k)) map.set(k, (map.get(k) ?? 0) + 1); 
      }; 
      (callsRows ?? []).forEach((r: any) => bumpDay(r.CalledOn, callsDay)); 
      (bopsRows ?? []).forEach((r: any) => bumpDay(r.BOP_Date, bopsDay)); 
      (fuRows ?? []).forEach((r: any) => bumpDay(r.Followup_Date, fuDay)); 
      const nz = (n: number | undefined) => (n && n !== 0 ? n : undefined); 
      setDaily60(days.map((day) => ({ day, calls: nz(callsDay.get(day) ?? 0), bops: nz(bopsDay.get(day) ?? 0), followups: nz(fuDay.get(day) ?? 0) }))); 
      const startMonth = startOfMonth(subMonths(today, 11)); 
      const months: string[] = []; 
      const callsMonth = new Map<string, number>(); 
      const bopsMonth = new Map<string, number>(); 
      const fuMonth = new Map<string, number>(); 
      for (let i = 0; i < 12; i++) { 
        const mDate = addMonths(startMonth, i); 
        const key = format(mDate, "yyyy-MM"); 
        months.push(key); 
        callsMonth.set(key, 0); 
        bopsMonth.set(key, 0); 
        fuMonth.set(key, 0); 
      } 
      const [{ data: callsY }, { data: bopsY }, { data: fuY }] = await Promise.all([ 
        supabase.from("client_registrations").select("CalledOn").gte("CalledOn", startMonth.toISOString()).lt("CalledOn", addMonths(endOfMonth(today), 1).toISOString()).order("CalledOn", { ascending: true }).limit(200000), 
        supabase.from("client_registrations").select("BOP_Date").gte("BOP_Date", startMonth.toISOString()).lt("BOP_Date", addMonths(endOfMonth(today), 1).toISOString()).order("BOP_Date", { ascending: true }).limit(200000), 
        supabase.from("client_registrations").select("Followup_Date").gte("Followup_Date", startMonth.toISOString()).lt("Followup_Date", addMonths(endOfMonth(today), 1).toISOString()).order("Followup_Date", { ascending: true }).limit(200000), 
      ]); 
      const bumpMonth = (dateVal: any, map: Map<string, number>) => { 
        if (!dateVal) return; 
        const d = parseISO(String(dateVal)); 
        if (!isValid(d)) return; 
        const k = format(d, "yyyy-MM"); 
        if (map.has(k)) map.set(k, (map.get(k) ?? 0) + 1); 
      }; 
      (callsY ?? []).forEach((r: any) => bumpMonth(r.CalledOn, callsMonth)); 
      (bopsY ?? []).forEach((r: any) => bumpMonth(r.BOP_Date, bopsMonth)); 
      (fuY ?? []).forEach((r: any) => bumpMonth(r.Followup_Date, fuMonth)); 
      setMonthly12(months.map((month) => ({ month, calls: nz(callsMonth.get(month) ?? 0), bops: nz(bopsMonth.get(month) ?? 0), followups: nz(fuMonth.get(month) ?? 0) }))); 
    } catch (e: any) { 
      setError(e?.message ?? "Failed to load trends"); 
    } finally { 
      setTrendLoading(false); 
    } 
  } 
  
  async function fetchUpcoming() { 
    setUpcomingLoading(true); 
    setError(null); 
    try { 
      const supabase = getSupabase(); 
      const start = new Date(rangeStart); 
      const end = new Date(rangeEnd); 
      const startIso = start.toISOString(); 
      const endIso = new Date(end.getTime() + 24 * 60 * 60 * 1000).toISOString(); 
      const { data: bopRows, error: bopErr } = await supabase.from("client_registrations").select("*").gte("BOP_Date", startIso).lt("BOP_Date", endIso).limit(5000); 
      if (bopErr) throw bopErr; 
      const { data: fuRows, error: fuErr } = await supabase.from("client_registrations").select("*").gte("Followup_Date", startIso).lt("Followup_Date", endIso).limit(5000); 
      if (fuErr) throw fuErr; 
      const map = new Map<string, any>(); 
      for (const r of bopRows ?? []) map.set(String((r as any).id), r); 
      for (const r of fuRows ?? []) map.set(String((r as any).id), r); 
      let merged = Array.from(map.values()); 
      const asc = sortUpcoming.dir === "asc"; 
      const key = sortUpcoming.key; 
      const getVal = (r: any) => { 
        if (key === "client") return `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim(); 
        return r[key]; 
      }; 
      merged.sort((a: any, b: any) => { 
        const av = getVal(a); 
        const bv = getVal(b); 
        if (key === "created_at" || key === "BOP_Date" || key === "Followup_Date" || key === "CalledOn" || key === "Issued") { 
          const at = av ? new Date(av).getTime() : 0; 
          const bt = bv ? new Date(bv).getTime() : 0; 
          return asc ? at - bt : bt - at; 
        } 
        return asc ? String(av ?? "").localeCompare(String(bv ?? "")) : String(bv ?? "").localeCompare(String(av ?? "")); 
      }); 
      setUpcoming(merged); 
      setUpcomingVisible(true); 
    } catch (e: any) { 
      setError(e?.message ?? "Failed to load upcoming meetings"); 
    } finally { 
      setUpcomingLoading(false); 
    } 
  } 
  
  async function fetchProgressSummary() { 
    setProgressLoading(true); 
    setError(null); 
    try { 
      const supabase = getSupabase(); 
      const { data, error } = await supabase 
        .from("v_client_progress_summary") 
        .select("clientid, first_name, last_name, phone, email, last_call_date, call_attempts, last_bop_date, bop_attempts, last_followup_date, followup_attempts") 
        .order("clientid", { ascending: false }) 
        .limit(10000); 
      if (error) throw error; 
      const rows = (data ?? []).map((r: any) => ({ 
        clientid: r.clientid, 
        client_name: `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim(), 
        first_name: r.first_name, 
        last_name: r.last_name, 
        phone: r.phone, 
        email: r.email, 
        last_call_date: r.last_call_date, 
        call_attempts: r.call_attempts, 
        last_bop_date: r.last_bop_date, 
        bop_attempts: r.bop_attempts, 
        last_followup_date: r.last_followup_date, 
        followup_attempts: r.followup_attempts, 
      })); 
      setProgressRows(rows); 
      setProgressPage(0); 
    } catch (e: any) { 
      setError(e?.message ?? "Failed to load Client Progress Summary"); 
    } finally { 
      setProgressLoading(false); 
    } 
  } 
  
  async function loadPage(nextPage: number) { 
    setError(null); 
    setLoading(true); 
    try { 
      const supabase = getSupabase(); 
      const search = q.trim(); 
      let countQuery = supabase.from("client_registrations").select("id", { count: "exact", head: true }); 
      if (search) countQuery = countQuery.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,phone.ilike.%${search}%`); 
      const { count, error: cErr } = await countQuery; 
      if (cErr) throw cErr; 
      setTotal(count ?? 0); 
      const from = nextPage * ALL_PAGE_SIZE; 
      const to = from + ALL_PAGE_SIZE - 1; 
      let dataQuery = supabase.from("client_registrations").select("*").range(from, to); 
      if (search) dataQuery = dataQuery.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,phone.ilike.%${search}%`); 
      dataQuery = applySort(dataQuery, sortAll); 
      const { data, error } = await dataQuery; 
      if (error) throw error; 
      setRecords(data ?? []); 
      setPage(nextPage); 
      setPageJump(String(nextPage + 1)); 
    } catch (e: any) { 
      setError(e?.message ?? "Failed to load records"); 
    } finally { 
      setLoading(false); 
    } 
  } 
  
  async function updateCell(id: string, key: string, rawValue: string) { 
    setSavingId(id); 
    setError(null); 
    try { 
      const supabase = getSupabase(); 
      const payload: any = {}; 
      const isDateOnly = DATE_ONLY_KEYS.has(key); 
      const isDateTime = DATE_TIME_KEYS.has(key); 
      payload[key] = isDateTime ? fromLocalInput(rawValue) : isDateOnly ? fromLocalDate(rawValue) : rawValue?.trim() ? rawValue : null; 
      const { error } = await supabase.from("client_registrations").update(payload).eq("id", id); 
      if (error) throw error; 
      const patch = (prev: Row[]) => prev.map((r) => (String(r.id) === String(id) ? { ...r, [key]: payload[key] } : r)); 
      setRecords(patch); 
      setUpcoming(patch); 
    } catch (e: any) { 
      setError(e?.message ?? "Update failed"); 
      throw e; 
    } finally { 
      setSavingId(null); 
    } 
  } 
  
  const
