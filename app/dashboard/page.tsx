// app/dashboard/page.tsx

"use client";

/** 
 * CAN Care & Advancement Network — Dashboard (page_0 (2).tsx) 
 * 
 * Minimal, scoped UI-layer changes only: 
 * - Added/kept new columns: spouse_name, date_of_birth, children, city, state, immigration_status, work_details. 
 * - Yellow highlight (no timestamp considered) for BOP Date & Follow-Up Date cells when ≥ today in Upcoming Meetings + All Records. 
 * - Upcoming Meetings: Refresh resets to default 30-day range; Show Results active green label. 
 * - Status columns render dropdown lists (incl. State). 
 * - Word-wrap + scrollable popups for Referred By, Product, Comment, Remark (and immigration_status, work_details). 
 * - Save button above table: disabled by default, enabled when data modified, disabled on refresh.
 * 
 * No backend changes (schema, procedures, routes, auth, Supabase policies). 
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

const AUTH_COOKIE = "canfs_auth";

function hasAuthCookie() {
  if (typeof document === "undefined") return false;
  return document.cookie.split("; ").some((c) => c.startsWith(`${AUTH_COOKIE}=true`));
}

function clearAuthCookie() {
  if (typeof document === "undefined") return;
  const secure =
    typeof window !== "undefined" && window.location?.protocol === "https:" ? "; secure" : "";
  document.cookie = `${AUTH_COOKIE}=; path=/; max-age=0; samesite=lax${secure}`;
}
 
const READONLY_LIST_COLS = new Set([ 
  "interest_type", 
  "business_opportunities", 
  "wealth_solutions", 
  "preferred_days", 
]); 
// Date & datetime keys (UI mapping only) 
const DATE_TIME_KEYS = new Set([ 
  "BOP_Date", 
  "CalledOn", 
  "Followup_Date", 
  "FollowUp_Date", 
  "Issued", 
]); 
const DATE_ONLY_KEYS = new Set(["date_of_birth"]); // calendar date without time 
/** ------- Yellow highlight helper (ignore timestamp) ------- */ 
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
const STATUS_OPTIONS = [ 
  "", "New Client", "Interested", "In-Progress", "Closed", "On Hold", "Completed" 
]; 
const BOP_STATUS_OPTIONS = ["", "Complete", "Call", "Meeting", "Closed"]; 
const FOLLOWUP_STATUS_OPTIONS = ["", "Complete", "Call", "Closed"]; 
const US_STATES = [ 
  "", "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA", 
  "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", 
  "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", 
  "WV", "WI", "WY", 
]; 
function optionsForKey(key: string): string[] | null { 
  if (key === "client_status" || key === "status") return STATUS_OPTIONS; 
  if (key === "BOP_Status") return BOP_STATUS_OPTIONS; 
  if (key === "FollowUp_Status") return FOLLOWUP_STATUS_OPTIONS; 
  if (key === "state") return US_STATES; 
  return null; 
} 
function asListItems(value: any): string[] { 
  if (!value) return []; 
  if (typeof value === "string") return value.split(",").map((s) => s.trim()).filter(Boolean); 
  if (Array.isArray(value)) return value.map(String).filter(Boolean); 
  return []; 
} 
const WRAP_KEYS = new Set([ 
  "Comment", "Remark", "Product", "referred_by", "immigration_status", "work_details" 
]); 
const viewOnlyPopupKeys = new Set(["Product", "referred_by", "immigration_status", "work_details"]); 
const SAVE_KEY_NORMALIZE: Record<string, string> = {}; 
const nonEditableKeys = new Set(["client_name", "email", "phone"]); 
function getCellValueForInput(r: Row, key: string): string { 
  const v = r[key]; 
  if (v == null) return ""; 
  if (DATE_TIME_KEYS.has(key) || DATE_ONLY_KEYS.has(key)) { 
    const d = new Date(v); 
    if (Number.isNaN(d.getTime())) return ""; 
    if (DATE_ONLY_KEYS.has(key)) { 
      const yyyy = d.getFullYear(); 
      const mm = String(d.getMonth() + 1).padStart(2, "0"); 
      const dd = String(d.getDate()).padStart(2, "0"); 
      return `${yyyy}-${mm}-${dd}`; 
    } 
    const yyyy = d.getFullYear(); 
    const mm = String(d.getMonth() + 1).padStart(2, "0"); 
    const dd = String(d.getDate()).padStart(2, "0"); 
    const HH = String(d.getHours()).padStart(2, "0"); 
    const MM = String(d.getMinutes()).padStart(2, "0"); 
    return `${yyyy}-${mm}-${dd}T${HH}:${MM}`; 
  } 
  return String(v); 
} 
async function callRPC<T = any>( 
  name: string, 
  params: Record<string, any> = {} 
): Promise<T | null> { 
  try { 
    const sb = getSupabase(); 
    const { data, error } = await sb.rpc(name, params); 
    if (error) { 
      console.error(`[callRPC] ${name}:`, error); 
      return null; 
    } 
    return data as T; 
  } catch (err) { 
    console.error("[callRPC] exception:", err); 
    return null; 
  } 
} 
/** ------- Reusable table with column resize, sort, sticky left, etc. ------- */ 
function shouldHighlight(key: string, row: Row): boolean { 
  if (!HIGHLIGHT_DATE_KEYS.has(key)) return false; 
  return dateOnOrAfterToday(row[key]); 
} 
function ResizableTable({ 
  rows, 
  columns, 
  stickyLeftCount = 0, 
  extraLeftCols = [], 
  drafts = {}, 
  setDrafts = () => {}, 
  savingId = null, 
  onUpdate = async () => {}, 
  onSort, 
  sortKey, 
  sortDir, 
  openCell, 
  setOpenCell = () => {}, 
}: { 
  rows: Row[]; 
  columns: { id: string; key?: string; kind?: string; defaultW?: number; sortable?: boolean }[]; 
  stickyLeftCount?: number; 
  extraLeftCols?: { render: (r: Row) => React.ReactNode; headerLabel: string }[]; 
  drafts?: Record<string, string>; 
  setDrafts?: React.Dispatch<React.SetStateAction<Record<string, string>>>; 
  savingId?: number | string | null; 
  onUpdate?: (rowId: string, key: string, value: string) => Promise<void>; 
  onSort?: (key: string) => void; 
  sortKey?: string; 
  sortDir?: "asc" | "desc"; 
  openCell?: string | null; 
  setOpenCell?: React.Dispatch<React.SetStateAction<string | null>>; 
}) { 
  const allColsString = columns.map((c) => c.id).join(","); 
  const containerRef = useRef<HTMLDivElement | null>(null); 
  const [widths, setWidths] = useState<Record<string, number>>({}); 
  useEffect(() => { 
    const stored = window.localStorage.getItem("dashTableWidths"); 
    if (stored) { 
      try { 
        const obj = JSON.parse(stored); 
        setWidths(obj ?? {}); 
      } catch { 
        setWidths({}); 
      } 
    } 
  }, [allColsString]); 
  const getW = (id: string, fallback = 160) => widths[id] ?? fallback; 
  const setW = (id: string, w: number) => { 
    setWidths((prev) => { 
      const next = { ...prev, [id]: w }; 
      window.localStorage.setItem("dashTableWidths", JSON.stringify(next)); 
      return next; 
    }); 
  }; 
  const startResize = (e: React.MouseEvent, colId: string, oldW: number) => { 
    e.preventDefault(); 
    const startX = e.clientX; 
    let latestW = oldW; 
    const onMove = (evt: MouseEvent) => { 
      const delta = evt.clientX - startX; 
      const newW = Math.max(50, oldW + delta); 
      latestW = newW; 
      setWidths((prev) => ({ ...prev, [colId]: newW })); 
    }; 
    const onUp = () => { 
      document.removeEventListener("mousemove", onMove); 
      document.removeEventListener("mouseup", onUp); 
      setW(colId, latestW); 
    }; 
    document.addEventListener("mousemove", onMove); 
    document.addEventListener("mouseup", onUp); 
  }; 
  const stickyLeftPx = (idx: number) => { 
    let acc = 0; 
    for (let i = 0; i < idx; i++) { 
      const c = columns[i]; 
      acc += getW(c.id, c.defaultW ?? 160); 
    } 
    return acc; 
  }; 
  const sortIcon = (sortable?: boolean) => { 
    if (!sortable) return null; 
    if (sortDir === "asc") return <span className="ml-1">▲</span>; 
    if (sortDir === "desc") return <span className="ml-1">▼</span>; 
    return <span className="ml-1 text-slate-400">⬍</span>; 
  }; 
  return ( 
    <div ref={containerRef} className="relative overflow-auto border border-slate-300" style={{ maxHeight: "70vh" }}> 
      <table className="border-collapse table-auto" style={{ borderSpacing: 0 }}> 
        <thead className="bg-slate-100 sticky top-0 z-20"> 
          <tr> 
            {(columns as any).map((c: any, idx: number) => { 
              const w = getW(c.id, c.defaultW ?? 160); 
              const isSticky = idx < stickyLeftCount; 
              const style: React.CSSProperties = { width: w, minWidth: w, maxWidth: w, position: isSticky ? "sticky" : undefined, left: isSticky ? stickyLeftPx(idx) : undefined, zIndex: isSticky ? 21 : 20, background: isSticky ? "#f1f5f9" : undefined }; 
              const headerLabel = (() => { 
                if (c.kind === "extra") { 
                  const eIdx = Number(String(c.id).split(":")[1] ?? "0"); 
                  return extraLeftCols[eIdx]?.headerLabel ?? ""; 
                } 
                if (c.key) return labelFor(c.key as string); 
                return String(c.id); 
              })(); 
              return ( 
                <th key={c.id} className="border border-slate-300 px-2 py-1 text-left font-semibold text-sm" style={style}> 
                  {c.sortable && onSort ? ( 
                    <button type="button" className="w-full text-left" onClick={() => onSort(c.key as string)}> 
                      {headerLabel} 
                      {sortIcon(c.sortable)} 
                    </button> 
                  ) : ( 
                    headerLabel 
                  )} 
                  <div className="absolute top-0 right-0 h-full w-2 cursor-col-resize select-none" onMouseDown={(e) => startResize(e, c.id, w)}> 
                    <div className="mx-auto h-full w-px bg-slate-300" /> 
                  </div> 
                </th> 
              ); 
            })} 
          </tr> 
        </thead> 
        <tbody> 
          {rows.map((r, ridx) => ( 
            <tr key={String(r.id ?? ridx)} className={`hover:bg-slate-50 ${r.client_status === "New Client" ? "bg-[#B1FB17]" : r.client_status === "Interested" ? "bg-[#728FCE]" : r.client_status === "In-Progress" ? "bg-[#ADDFFF]" : r.client_status === "Closed" ? "bg-[#E6BF83]" : r.client_status === "On Hold" ? "bg-[#C9BE62]" : r.client_status === "Completed" ? "bg-[#3CB371] text-black" : ""}`}> 
              {(columns as any).map((c: any, colIndex: number) => { 
                const w = getW(c.id, c.defaultW ?? 160); 
                const isSticky = colIndex < stickyLeftCount; 
                const style: React.CSSProperties = { width: w, minWidth: w, maxWidth: w, position: isSticky ? "sticky" : undefined, left: isSticky ? stickyLeftPx(colIndex) : undefined, zIndex: isSticky ? 10 : 1, background: isSticky ? "#ffffff" : undefined }; 
                if (c.kind === "extra") { 
                  const idx = Number(String(c.id).split(":")[1] ?? "0"); 
                  const colDef = extraLeftCols[idx]; 
                  const v = colDef?.render ? colDef.render(r) : ""; 
                  return (<td key={c.id} className={`border border-slate-300 px-2 py-2 whitespace-nowrap font-semibold text-black ${shouldHighlight(c.key as string, r) ? "bg-yellow-200" : ""}`} style={style}>{v}</td>); 
                } 
                const k = c.key as string; 
                if (k === "created_at") { 
                  const d = new Date(r.created_at); 
                  const v = Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(); 
                  return (<td key={c.id} className={`border border-slate-300 px-2 py-2 whitespace-nowrap ${shouldHighlight(k, r) ? "bg-yellow-200" : ""}`} style={style}>{v}</td>); 
                } 
                const cellId = `${r.id}:${k}`; 
                const statusOptions = optionsForKey(k); 
                if (statusOptions) { 
                  const value = drafts[cellId] !== undefined ? drafts[cellId] : String(getCellValueForInput(r, k)); 
                  return ( 
                    <td key={c.id} className={`border border-slate-300 px-2 py-2 ${shouldHighlight(k, r) ? "bg-yellow-200" : ""}`} style={style}> 
                      <select 
                        className="w-full bg-transparent border-0 outline-none text-sm" 
                        value={value ?? ""} 
                        onChange={(e) => setDrafts((prev) => ({ ...prev, [cellId]: e.target.value }))} 
                        onBlur={() => { const v = drafts[cellId] ?? value ?? ""; if (v !== undefined) onUpdate(String(r.id), k, String(v)); }} 
                        disabled={savingId != null && String(savingId) === String(r.id)} 
                      > 
                        {statusOptions.map((opt, idx) => (<option key={`${k}:${idx}:${opt}`} value={opt}>{opt || "—"}</option>))} 
                      </select> 
                    </td> 
                  ); 
                } 
                if (READONLY_LIST_COLS.has(k)) { 
                  const cellIdList = `${r.id}:${k}`; 
                  const items = asListItems(r[k]); 
                  const display = items.join(", "); 
                  const showPopup = openCell === cellIdList; 
                  return ( 
                    <td key={c.id} className={`border border-slate-300 px-2 py-2 align-top ${shouldHighlight(k, r) ? "bg-yellow-200" : ""}`} style={style}> 
                      <div className="relative"> 
                        <button type="button" className="w-full text-left text-black whitespace-normal break-words" onClick={() => setOpenCell((cur) => (cur === cellIdList ? null : cellIdList))}>{display || "—"}</button> 
                        {showPopup && ( 
                          <div className="absolute left-0 top-full mt-1 w-72 max-w-[70vw] bg-white border border-slate-500 shadow-lg z-30"> 
                            <div className="px-2 py-1 text-xs font-semibold text-black bg-slate-100 border-b border-slate-300">{labelFor(k)}</div> 
                            <ul className="max-h-48 overflow-auto"> 
                              {(items.length ? items : ["(empty)"]).map((x, i) => (<li key={i} className="px-2 py-1 text-sm border-b border-slate-100">{x}</li>))} 
                            </ul> 
                            <div className="p-2"><Button variant="secondary" onClick={() => setOpenCell(null)}>Close</Button></div> 
                          </div> 
                        )} 
                      </div> 
                    </td> 
                  ); 
                } 
                if (WRAP_KEYS.has(k) && viewOnlyPopupKeys.has(k)) { 
                  const cellIdView = `${r.id}:${k}`; 
                  const showPopup = openCell === cellIdView; 
                  const baseVal = String(getCellValueForInput(r, k)); 
                  return ( 
                    <td key={c.id} className={`border border-slate-300 px-2 py-2 align-top ${shouldHighlight(k, r) ? "bg-yellow-200" : ""}`} style={style}> 
                      <div className="relative"> 
                        <button type="button" className="w-full text-left text-black whitespace-normal break-words" onClick={() => setOpenCell((cur) => (cur === cellIdView ? null : cellIdView))}>{baseVal || "—"}</button> 
                        {showPopup && ( 
                          <div className="absolute left-0 top-full mt-1 w-80 max-w-[80vw] bg-white border border-slate-500 shadow-xl z-40"> 
                            <div className="px-2 py-1 text-xs font-semibold text-black bg-slate-100 border-b border-slate-300">{labelFor(k)}</div> 
                            <div className="p-2"> 
                              <textarea rows={5} readOnly className="w-full border border-slate-300 px-2 py-1 text-sm whitespace-pre-wrap break-words resize-none overflow-auto bg-slate-50" value={baseVal} /> 
                              <div className="mt-2"><Button variant="secondary" onClick={() => setOpenCell(null)}>Close</Button></div> 
                            </div> 
                          </div> 
                        )} 
                      </div> 
                    </td> 
                  ); 
                } 
                if (nonEditableKeys.has(k)) { 
                  const displayVal = DATE_ONLY_KEYS.has(k) ? (() => { const d = new Date(r[k]); return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString(); })() : String(getCellValueForInput(r, k)) || "—"; 
                  return (<td key={c.id} className={`border border-slate-300 px-2 py-2 whitespace-normal break-words ${shouldHighlight(k, r) ? "bg-yellow-200" : ""}`} style={style}>{displayVal}</td>); 
                } 
                if (WRAP_KEYS.has(k)) { 
                  const cellIdWrap = `${r.id}:${k}`; 
                  const showPopup = openCell === cellIdWrap; 
                  const baseVal = String(getCellValueForInput(r, k)); 
                  return ( 
                    <td key={c.id} className={`border border-slate-300 px-2 py-2 align-top ${shouldHighlight(k, r) ? "bg-yellow-200" : ""}`} style={style}> 
                      <div className="relative"> 
                        <button type="button" className="w-full text-left text-black whitespace-normal break-words" onClick={() => { setDrafts((prev) => ({ ...prev, [cellIdWrap]: drafts[cellIdWrap] ?? baseVal })); setOpenCell((cur) => (cur === cellIdWrap ? null : cellIdWrap)); }}>{baseVal || "—"}</button> 
                        {showPopup && ( 
                          <div className="absolute left-0 top-full mt-1 w-80 max-w-[80vw] bg-white border border-slate-500 shadow-xl z-40"> 
                            <div className="px-2 py-1 text-xs font-semibold text-black bg-slate-100 border-b border-slate-300">{labelFor(k)}</div> 
                            <div className="p-2"> 
                              <textarea rows={5} className="w-full border border-slate-300 px-2 py-1 text-sm whitespace-pre-wrap break-words resize-none overflow-auto" value={drafts[cellIdWrap] ?? ""} onChange={(e) => setDrafts((prev) => ({ ...prev, [cellIdWrap]: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.stopPropagation(); } }} /> 
                              <div className="mt-2 flex items-center gap-2"> 
                                <Button variant="secondary" onClick={async () => { const mappedKey = SAVE_KEY_NORMALIZE[k] ?? k; await onUpdate(String(r.id), mappedKey, drafts[cellIdWrap] ?? "" ); setOpenCell(null); setDrafts((prev) => { const next = { ...prev }; delete next[cellIdWrap]; return next; }); }} disabled={savingId != null && String(savingId) === String(r.id)}>Save</Button> 
                                <Button variant="secondary" onClick={() => { setOpenCell(null); setDrafts((prev) => { const next = { ...prev }; delete next[cellIdWrap]; return next; }); }}>Cancel</Button> 
                              </div> 
                            </div> 
                          </div> 
                        )} 
                      </div> 
                    </td> 
                  ); 
                } 
                const cellIdInput = `${r.id}:${k}`; 
                const isDateTime = DATE_TIME_KEYS.has(k); 
                const isDateOnly = DATE_ONLY_KEYS.has(k); 
                const value = drafts[cellIdInput] !== undefined ? drafts[cellIdInput] : String(getCellValueForInput(r, k)); 
                const inputType = isDateTime ? "datetime-local" : isDateOnly ? "date" : "text"; 
                return ( 
                  <td key={c.id} className={`border border-slate-300 px-2 py-2 ${shouldHighlight(k, r) ? "bg-yellow-200" : ""}`} style={style}> 
                    <input 
                      type={inputType} 
                      step={isDateTime ? 60 : undefined} 
                      className="w-full bg-transparent border-0 outline-none text-sm" 
                      value={value} 
                      onChange={(e) => setDrafts((prev) => ({ ...prev, [cellIdInput]: e.target.value }))} 
                      onBlur={() => { const v = drafts[cellIdInput] ?? value ?? ""; if (v !== undefined) onUpdate(String(r.id), k, String(v)); }} 
                      disabled={savingId != null && String(savingId) === String(r.id)} 
                    /> 
                  </td> 
                ); 
              })} 
            </tr> 
          ))} 
        </tbody> 
      </table> 
    </div> 
  ); 
} 
export default function DashboardPage() { 
  const router = useRouter(); 
  const [loading, setLoading] = useState(true); 
  const [error, setError] = useState(""); 
  // "upcoming" vs "progress" vs "all" 
  const [activeView, setActiveView] = useState<"upcoming" | "progress" | "all">("upcoming"); 
  // Upcoming Meetings 
  const [upcomingRows, setUpcomingRows] = useState<Row[]>([]); 
  const [upcomingSortKey, setUpcomingSortKey] = useState<SortKey>("BOP_Date"); 
  const [upcomingSortDir, setUpcomingSortDir] = useState<SortDir>("asc"); 
  const [upcomingDrafts, setUpcomingDrafts] = useState<Record<string, string>>({}); 
  const [upcomingSavingId, setUpcomingSavingId] = useState<number | string | null>(null); 
  const [upcomingOpenCell, setUpcomingOpenCell] = useState<string | null>(null); 
  // NEW: Track if upcoming data has been modified
  const [upcomingModified, setUpcomingModified] = useState(false);
  // Progress Monitoring 
  const [progressRows, setProgressRows] = useState<Row[]>([]); 
  const [progressSortKey, setProgressSortKey] = useState<ProgressSortKey>("client_name"); 
  const [progressSortDir, setProgressSortDir] = useState<SortDir>("asc"); 
  const [progressPage, setProgressPage] = useState(1); 
  const [progressTotal, setProgressTotal] = useState(0); 
  // All Records 
  const [allRows, setAllRows] = useState<Row[]>([]); 
  const [allSortKey, setAllSortKey] = useState<SortKey>("created_at"); 
  const [allSortDir, setAllSortDir] = useState<SortDir>("desc"); 
  const [allPage, setAllPage] = useState(1); 
  const [allTotal, setAllTotal] = useState(0); 
  const [allDrafts, setAllDrafts] = useState<Record<string, string>>({}); 
  const [allSavingId, setAllSavingId] = useState<number | string | null>(null); 
  const [allOpenCell, setAllOpenCell] = useState<string | null>(null); 
  // NEW: Track if all records data has been modified
  const [allModified, setAllModified] = useState(false);
  // Top-level stats 
  const [newClients, setNewClients] = useState(0); 
  const [bopToday, setBopToday] = useState(0); 
  const [followupToday, setFollowupToday] = useState(0); 
  const [completedToday, setCompletedToday] = useState(0); 
  // Charts 
  const [chartData, setChartData] = useState<any[]>([]); 
  const [callData, setCallData] = useState<any[]>([]); 
  // Range filter for Upcoming 
  const [startDateRaw, setStartDateRaw] = useState(""); 
  const [endDateRaw, setEndDateRaw] = useState(""); 
  const [showResultsActive, setShowResultsActive] = useState(false); 
  useEffect(() => { 
    if (!hasAuthCookie()) { 
      router.replace("/login"); 
    } else { 
      loadData(); 
    } 
  }, []); 
  async function loadData() { 
    setLoading(true); 
    setError(""); 
    try { 
      const statsData = await callRPC<any[]>("get_top_stats"); 
      if (statsData && statsData.length > 0) { 
        const s = statsData[0]; 
        setNewClients(s.new_clients ?? 0); 
        setBopToday(s.bop_today ?? 0); 
        setFollowupToday(s.followup_today ?? 0); 
        setCompletedToday(s.completed_today ?? 0); 
      } 
      const cData = await callRPC<any[]>("get_bop_followup_completion_chart"); 
      if (cData && cData.length > 0) { 
        const transformed = cData.map((x: any) => ({ 
          date: x.date_label ?? "", 
          "BOP Calls": x.bop_count ?? 0, 
          "Follow-Up Calls": x.followup_count ?? 0, 
          Completed: x.completed_count ?? 0, 
        })); 
        setChartData(transformed); 
      } 
      const callDataRaw = await callRPC<any[]>("get_call_status_chart"); 
      if (callDataRaw && callDataRaw.length > 0) { 
        const labeled = callDataRaw.map((x: any) => ({ 
          status: x.status_label ?? "Unknown", 
          count: x.count ?? 0, 
        })); 
        setCallData(labeled); 
      } 
      await fetchUpcomingMeetings("", ""); 
      await fetchProgressMonitoring(); 
      await fetchAllRecords(); 
    } catch (err) { 
      console.error(err); 
      setError("Error loading data. Please try again."); 
    } finally { 
      setLoading(false); 
    } 
  } 
  async function fetchUpcomingMeetings(startDate: string, endDate: string) { 
    const data = await callRPC<any[]>("get_upcoming_meetings", { 
      p_start_date: startDate || null, 
      p_end_date: endDate || null, 
    }); 
    if (data) { 
      setUpcomingRows(data); 
    } else { 
      setUpcomingRows([]); 
    } 
    // Reset modification tracking when data is refreshed
    setUpcomingModified(false);
  } 
  async function fetchProgressMonitoring() { 
    const limit = PROGRESS_PAGE_SIZE; 
    const offset = (progressPage - 1) * limit; 
    const data = await callRPC<any[]>("get_progress_monitoring", { 
      p_limit: limit, 
      p_offset: offset, 
      p_sort_column: progressSortKey, 
      p_sort_direction: progressSortDir, 
    }); 
    if (data) { 
      setProgressRows(data); 
      if (data.length > 0 && data[0].total_count !== undefined) { 
        setProgressTotal(data[0].total_count); 
      } 
    } else { 
      setProgressRows([]); 
      setProgressTotal(0); 
    } 
  } 
  async function fetchAllRecords() { 
    const limit = ALL_PAGE_SIZE; 
    const offset = (allPage - 1) * limit; 
    const data = await callRPC<any[]>("get_all_records", { 
      p_limit: limit, 
      p_offset: offset, 
      p_sort_column: allSortKey, 
      p_sort_direction: allSortDir, 
    }); 
    if (data) { 
      setAllRows(data); 
      if (data.length > 0 && data[0].total_count !== undefined) { 
        setAllTotal(data[0].total_count); 
      } 
    } else { 
      setAllRows([]); 
      setAllTotal(0); 
    } 
    // Reset modification tracking when data is refreshed
    setAllModified(false);
  } 
  useEffect(() => { 
    if (!loading) fetchProgressMonitoring(); 
  }, [progressPage, progressSortKey, progressSortDir]); 
  useEffect(() => { 
    if (!loading) fetchAllRecords(); 
  }, [allPage, allSortKey, allSortDir]); 
  async function handleUpdateRow(rowId: string, key: string, value: string) { 
    const numId = Number(rowId); 
    if (Number.isNaN(numId)) return; 
    
    // Determine which view we're updating and set modified flag
    if (activeView === "upcoming") {
      setUpcomingSavingId(numId);
      setUpcomingModified(true);
    } else if (activeView === "all") {
      setAllSavingId(numId);
      setAllModified(true);
    }
    
    try { 
      const payload: Record<string, any> = { p_id: numId }; 
      if (DATE_TIME_KEYS.has(key)) { 
        if (!value) { 
          payload[`p_${key.toLowerCase()}`] = null; 
        } else { 
          const parsed = new Date(value); 
          if (!Number.isNaN(parsed.getTime())) { 
            payload[`p_${key.toLowerCase()}`] = parsed.toISOString(); 
          } else { 
            payload[`p_${key.toLowerCase()}`] = null; 
          } 
        } 
      } else if (DATE_ONLY_KEYS.has(key)) { 
        if (!value) { 
          payload[`p_${key.toLowerCase()}`] = null; 
        } else { 
          const parsed = new Date(value); 
          if (!Number.isNaN(parsed.getTime())) { 
            payload[`p_${key.toLowerCase()}`] = format(parsed, "yyyy-MM-dd"); 
          } else { 
            payload[`p_${key.toLowerCase()}`] = null; 
          } 
        } 
      } else { 
        payload[`p_${key.toLowerCase()}`] = value; 
      } 
      const result = await callRPC<any>("update_client_field", payload); 
      if (!result) throw new Error("Update failed"); 
      if (activeView === "upcoming") { 
        setUpcomingRows((prev) => 
          prev.map((r) => (String(r.id) === rowId ? { ...r, [key]: value } : r)) 
        ); 
        setUpcomingDrafts((prev) => { 
          const next = { ...prev }; 
          delete next[`${rowId}:${key}`]; 
          return next; 
        }); 
      } else if (activeView === "all") { 
        setAllRows((prev) => 
          prev.map((r) => (String(r.id) === rowId ? { ...r, [key]: value } : r)) 
        ); 
        setAllDrafts((prev) => { 
          const next = { ...prev }; 
          delete next[`${rowId}:${key}`]; 
          return next; 
        }); 
      } 
    } catch (err) { 
      console.error("Update failed:", err); 
      alert("Failed to update. Please try again."); 
    } finally { 
      if (activeView === "upcoming") {
        setUpcomingSavingId(null);
      } else if (activeView === "all") {
        setAllSavingId(null);
      }
    } 
  } 
  
  // NEW: Save all pending changes function
  async function handleSaveChanges() {
    if (activeView === "upcoming") {
      // Save all pending drafts for upcoming view
      const entries = Object.entries(upcomingDrafts);
      for (const [cellId, value] of entries) {
        const [rowId, key] = cellId.split(":");
        await handleUpdateRow(rowId, key, value);
      }
      setUpcomingDrafts({});
      setUpcomingModified(false);
    } else if (activeView === "all") {
      // Save all pending drafts for all records view
      const entries = Object.entries(allDrafts);
      for (const [cellId, value] of entries) {
        const [rowId, key] = cellId.split(":");
        await handleUpdateRow(rowId, key, value);
      }
      setAllDrafts({});
      setAllModified(false);
    }
  }
  
  function handleUpcomingSort(key: string) { 
    if (upcomingSortKey === key) { 
      setUpcomingSortDir((prev) => (prev === "asc" ? "desc" : "asc")); 
    } else { 
      setUpcomingSortKey(key as SortKey); 
      setUpcomingSortDir("asc"); 
    } 
  } 
  function handleProgressSort(key: string) { 
    if (progressSortKey === key) { 
      setProgressSortDir((prev) => (prev === "asc" ? "desc" : "asc")); 
    } else { 
      setProgressSortKey(key as ProgressSortKey); 
      setProgressSortDir("asc"); 
    } 
  } 
  function handleAllSort(key: string) { 
    if (allSortKey === key) { 
      setAllSortDir((prev) => (prev === "asc" ? "desc" : "asc")); 
    } else { 
      setAllSortKey(key as SortKey); 
      setAllSortDir("asc"); 
    } 
  } 
  const sortedUpcoming = useMemo(() => { 
    const arr = [...upcomingRows]; 
    arr.sort((a, b) => { 
      const aVal = a[upcomingSortKey]; 
      const bVal = b[upcomingSortKey]; 
      let cmp = 0; 
      if (typeof aVal === "string" && typeof bVal === "string") { 
        cmp = aVal.localeCompare(bVal); 
      } else if (typeof aVal === "number" && typeof bVal === "number") { 
        cmp = aVal - bVal; 
      } else { 
        cmp = String(aVal ?? "").localeCompare(String(bVal ?? "")); 
      } 
      return upcomingSortDir === "asc" ? cmp : -cmp; 
    }); 
    return arr; 
  }, [upcomingRows, upcomingSortKey, upcomingSortDir]); 
  const sortedProgress = useMemo(() => { 
    const arr = [...progressRows]; 
    arr.sort((a, b) => { 
      const aVal = a[progressSortKey]; 
      const bVal = b[progressSortKey]; 
      let cmp = 0; 
      if (typeof aVal === "string" && typeof bVal === "string") { 
        cmp = aVal.localeCompare(bVal); 
      } else if (typeof aVal === "number" && typeof bVal === "number") { 
        cmp = aVal - bVal; 
      } else { 
        cmp = String(aVal ?? "").localeCompare(String(bVal ?? "")); 
      } 
      return progressSortDir === "asc" ? cmp : -cmp; 
    }); 
    return arr; 
  }, [progressRows, progressSortKey, progressSortDir]); 
  const sortedAll = useMemo(() => { 
    const arr = [...allRows]; 
    arr.sort((a, b) => { 
      const aVal = a[allSortKey]; 
      const bVal = b[allSortKey]; 
      let cmp = 0; 
      if (typeof aVal === "string" && typeof bVal === "string") { 
        cmp = aVal.localeCompare(bVal); 
      } else if (typeof aVal === "number" && typeof bVal === "number") { 
        cmp = aVal - bVal; 
      } else { 
        cmp = String(aVal ?? "").localeCompare(String(bVal ?? "")); 
      } 
      return allSortDir === "asc" ? cmp : -cmp; 
    }); 
    return arr; 
  }, [allRows, allSortKey, allSortDir]); 
  const progressPageCount = Math.ceil(progressTotal / PROGRESS_PAGE_SIZE); 
  const allPageCount = Math.ceil(allTotal / ALL_PAGE_SIZE); 
  function handleRefreshUpcoming() { 
    setStartDateRaw(""); 
    setEndDateRaw(""); 
    setShowResultsActive(false); 
    setUpcomingDrafts({});
    setUpcomingModified(false); // Reset modified flag on refresh
    fetchUpcomingMeetings("", ""); 
  } 
  function handleShowResults() { 
    setShowResultsActive(true); 
    fetchUpcomingMeetings(startDateRaw, endDateRaw); 
  } 
  function handleLogout() { 
    clearAuthCookie(); 
    router.push("/login"); 
  } 
  function handleExportUpcoming() { 
    const wb = XLSX.utils.book_new(); 
    const wsData = [ 
      ["Client Name", "Email", "Phone", "Called On", "BOP Date", "BOP Status", "Follow-Up Date", "Follow-Up Status", "Status", "Spouse Name", "Date Of Birth", "Children", "City", "State", "Immigration Status", "Work Details"], 
      ...sortedUpcoming.map((r) => [ 
        r.client_name, 
        r.email, 
        r.phone, 
        r.CalledOn, 
        r.BOP_Date, 
        r.BOP_Status, 
        r.Followup_Date, 
        r.FollowUp_Status, 
        r.client_status, 
        r.spouse_name, 
        r.date_of_birth, 
        r.children, 
        r.city, 
        r.state, 
        r.immigration_status, 
        r.work_details, 
      ]), 
    ]; 
    const ws = XLSX.utils.aoa_to_sheet(wsData); 
    XLSX.utils.book_append_sheet(wb, ws, "Upcoming Meetings"); 
    XLSX.writeFile(wb, "upcoming_meetings.xlsx"); 
  } 
  function handleExportProgress() { 
    const wb = XLSX.utils.book_new(); 
    const wsData = [ 
      ["Client Name", "Last Call On", "No of Calls", "Last/Next BOP Call On", "No of BOP Calls", "Last/Next FollowUp On", "No of FollowUp Calls"], 
      ...sortedProgress.map((r) => [ 
        r.client_name, 
        r.last_call_date, 
        r.call_attempts, 
        r.last_bop_date, 
        r.bop_attempts, 
        r.last_followup_date, 
        r.followup_attempts, 
      ]), 
    ]; 
    const ws = XLSX.utils.aoa_to_sheet(wsData); 
    XLSX.utils.book_append_sheet(wb, ws, "Progress Monitoring"); 
    XLSX.writeFile(wb, "progress_monitoring.xlsx"); 
  } 
  function handleExportAll() { 
    const wb = XLSX.utils.book_new(); 
    const wsData = [ 
      ["ID", "Client Name", "Email", "Phone", "Called On", "BOP Date", "BOP Status", "Follow-Up Date", "Follow-Up Status", "Status", "Created Date", "Spouse Name", "Date Of Birth", "Children", "City", "State", "Immigration Status", "Work Details"], 
      ...sortedAll.map((r) => [ 
        r.id, 
        r.client_name, 
        r.email, 
        r.phone, 
        r.CalledOn, 
        r.BOP_Date, 
        r.BOP_Status, 
        r.Followup_Date, 
        r.FollowUp_Status, 
        r.client_status, 
        r.created_at, 
        r.spouse_name, 
        r.date_of_birth, 
        r.children, 
        r.city, 
        r.state, 
        r.immigration_status, 
        r.work_details, 
      ]), 
    ]; 
    const ws = XLSX.utils.aoa_to_sheet(wsData); 
    XLSX.utils.book_append_sheet(wb, ws, "All Records"); 
    XLSX.writeFile(wb, "all_records.xlsx"); 
  } 
  if (loading) { 
    return ( 
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100"> 
        <div className="text-center"> 
          <div className="mb-4 inline-block h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div> 
          <p className="text-lg font-medium text-slate-700">Loading Dashboard...</p> 
        </div> 
      </div> 
    ); 
  } 
  if (error) { 
    return ( 
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100"> 
        <div className="max-w-md p-6 text-center bg-white rounded-lg shadow-lg">
          <p className="mb-4 text-red-600 font-semibold">{error}</p> 
          <Button onClick={() => loadData()}>Retry</Button> 
        </div>
      </div> 
    ); 
  } 
  const upcomingCols = [ 
    { id: "client_name", key: "client_name", defaultW: 180, sortable: true }, 
    { id: "email", key: "email", defaultW: 200, sortable: true }, 
    { id: "phone", key: "phone", defaultW: 140, sortable: true }, 
    { id: "CalledOn", key: "CalledOn", defaultW: 160, sortable: true }, 
    { id: "BOP_Date", key: "BOP_Date", defaultW: 160, sortable: true }, 
    { id: "BOP_Status", key: "BOP_Status", defaultW: 130, sortable: true }, 
    { id: "Followup_Date", key: "Followup_Date", defaultW: 160, sortable: true }, 
    { id: "FollowUp_Status", key: "FollowUp_Status", defaultW: 150, sortable: true }, 
    { id: "status", key: "client_status", defaultW: 140, sortable: true }, 
    { id: "spouse_name", key: "spouse_name", defaultW: 150 }, 
    { id: "date_of_birth", key: "date_of_birth", defaultW: 140 }, 
    { id: "children", key: "children", defaultW: 120 }, 
    { id: "city", key: "city", defaultW: 120 }, 
    { id: "state", key: "state", defaultW: 100 }, 
    { id: "immigration_status", key: "immigration_status", defaultW: 160 }, 
    { id: "work_details", key: "work_details", defaultW: 200 }, 
  ]; 
  const progressCols = [ 
    { id: "client_name", key: "client_name", defaultW: 180, sortable: true }, 
    { id: "last_call_date", key: "last_call_date", defaultW: 150, sortable: true }, 
    { id: "call_attempts", key: "call_attempts", defaultW: 120, sortable: true }, 
    { id: "last_bop_date", key: "last_bop_date", defaultW: 170, sortable: true }, 
    { id: "bop_attempts", key: "bop_attempts", defaultW: 130, sortable: true }, 
    { id: "last_followup_date", key: "last_followup_date", defaultW: 180, sortable: true }, 
    { id: "followup_attempts", key: "followup_attempts", defaultW: 150, sortable: true }, 
  ]; 
  const allCols = [ 
    { id: "id", key: "id", defaultW: 70, sortable: true }, 
    { id: "client_name", key: "client_name", defaultW: 180, sortable: true }, 
    { id: "email", key: "email", defaultW: 200, sortable: true }, 
    { id: "phone", key: "phone", defaultW: 140, sortable: true }, 
    { id: "CalledOn", key: "CalledOn", defaultW: 160, sortable: true }, 
    { id: "BOP_Date", key: "BOP_Date", defaultW: 160, sortable: true }, 
    { id: "BOP_Status", key: "BOP_Status", defaultW: 130, sortable: true }, 
    { id: "Followup_Date", key: "Followup_Date", defaultW: 160, sortable: true }, 
    { id: "FollowUp_Status", key: "FollowUp_Status", defaultW: 150, sortable: true }, 
    { id: "status", key: "client_status", defaultW: 140, sortable: true }, 
    { id: "created_at", key: "created_at", defaultW: 130, sortable: true }, 
    { id: "spouse_name", key: "spouse_name", defaultW: 150 }, 
    { id: "date_of_birth", key: "date_of_birth", defaultW: 140 }, 
    { id: "children", key: "children", defaultW: 120 }, 
    { id: "city", key: "city", defaultW: 120 }, 
    { id: "state", key: "state", defaultW: 100 }, 
    { id: "immigration_status", key: "immigration_status", defaultW: 160 }, 
    { id: "work_details", key: "work_details", defaultW: 200 }, 
  ]; 
  return ( 
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 p-4"> 
      <div className="mx-auto max-w-[1600px]"> 
        <div className="mb-6 flex items-center justify-between"> 
          <h1 className="text-3xl font-bold text-slate-800">CAN Dashboard</h1> 
          <Button variant="secondary" onClick={handleLogout}>Logout</Button> 
        </div> 
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4"> 
          <Card title="New Clients">
            <div className="flex flex-col items-center justify-center p-4"> 
              <p className="text-sm text-slate-600 mb-1">New Clients</p> 
              <p className="text-3xl font-bold text-blue-600">{newClients}</p> 
            </div>
          </Card> 
          <Card title="BOP Calls Today">
            <div className="flex flex-col items-center justify-center p-4"> 
              <p className="text-sm text-slate-600 mb-1">BOP Calls Today</p> 
              <p className="text-3xl font-bold text-green-600">{bopToday}</p> 
            </div>
          </Card> 
          <Card title="Follow-Up Calls Today">
            <div className="flex flex-col items-center justify-center p-4"> 
              <p className="text-sm text-slate-600 mb-1">Follow-Up Calls Today</p> 
              <p className="text-3xl font-bold text-purple-600">{followupToday}</p> 
            </div>
          </Card> 
          <Card title="Completed Today">
            <div className="flex flex-col items-center justify-center p-4"> 
              <p className="text-sm text-slate-600 mb-1">Completed Today</p> 
              <p className="text-3xl font-bold text-orange-600">{completedToday}</p> 
            </div>
          </Card> 
        </div> 
        <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2"> 
          <Card title="BOP, Follow-Up & Completion"> 
            <div className="p-4">
              <h2 className="mb-4 text-lg font-semibold text-slate-700">BOP, Follow-Up & Completion (Last 7 Days)</h2> 
              {chartData.length > 0 ? ( 
                <ResponsiveContainer width="100%" height={240}> 
                  <BarChart data={chartData}> 
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} /> 
                    <YAxis tick={{ fontSize: 12 }} /> 
                    <Tooltip /> 
                    <Bar dataKey="BOP Calls" fill="#3b82f6" radius={[4, 4, 0, 0]}> 
                      <LabelList dataKey="BOP Calls" position="top" style={{ fontSize: 10 }} /> 
                    </Bar> 
                    <Bar dataKey="Follow-Up Calls" fill="#a855f7" radius={[4, 4, 0, 0]}> 
                      <LabelList dataKey="Follow-Up Calls" position="top" style={{ fontSize: 10 }} /> 
                    </Bar> 
                    <Bar dataKey="Completed" fill="#f97316" radius={[4, 4, 0, 0]}> 
                      <LabelList dataKey="Completed" position="top" style={{ fontSize: 10 }} /> 
                    </Bar> 
                  </BarChart> 
                </ResponsiveContainer> 
              ) : ( 
                <p className="text-sm text-slate-500">No chart data available.</p> 
              )}
            </div> 
          </Card> 
          <Card title="Call Status Distribution"> 
            <div className="p-4">
              <h2 className="mb-4 text-lg font-semibold text-slate-700">Call Status Distribution</h2> 
              {callData.length > 0 ? ( 
                <ResponsiveContainer width="100%" height={240}> 
                  <BarChart data={callData} layout="vertical"> 
                    <XAxis type="number" tick={{ fontSize: 12 }} /> 
                    <YAxis dataKey="status" type="category" tick={{ fontSize: 12 }} width={100} /> 
                    <Tooltip /> 
                    <Bar dataKey="count" fill="#10b981" radius={[0, 4, 4, 0]}> 
                      <LabelList dataKey="count" position="right" style={{ fontSize: 10 }} /> 
                    </Bar> 
                  </BarChart> 
                </ResponsiveContainer> 
              ) : ( 
                <p className="text-sm text-slate-500">No call status data available.</p> 
              )}
            </div> 
          </Card> 
        </div> 
        <div className="mb-4 flex items-center gap-4"> 
          <button onClick={() => setActiveView("upcoming")} className={`px-4 py-2 rounded font-semibold transition-colors ${activeView === "upcoming" ? "bg-blue-600 text-white" : "bg-white text-slate-700 hover:bg-blue-50"}`}>Upcoming Meetings</button> 
          <button onClick={() => setActiveView("progress")} className={`px-4 py-2 rounded font-semibold transition-colors ${activeView === "progress" ? "bg-blue-600 text-white" : "bg-white text-slate-700 hover:bg-blue-50"}`}>Progress Monitoring</button> 
          <button onClick={() => setActiveView("all")} className={`px-4 py-2 rounded font-semibold transition-colors ${activeView === "all" ? "bg-blue-600 text-white" : "bg-white text-slate-700 hover:bg-blue-50"}`}>All Records</button> 
        </div> 
        {activeView === "upcoming" && ( 
          <Card title="Upcoming Meetings"> 
            <div className="p-4">
              <div className="mb-4 flex items-center justify-between flex-wrap gap-2"> 
                <h2 className="text-xl font-semibold text-slate-700">Upcoming Meetings</h2> 
                <div className="flex items-center gap-2 flex-wrap"> 
                  <input type="date" className="border border-slate-300 rounded px-2 py-1 text-sm" value={startDateRaw} onChange={(e) => setStartDateRaw(e.target.value)} /> 
                  <span className="text-sm text-slate-600">to</span> 
                  <input type="date" className="border border-slate-300 rounded px-2 py-1 text-sm" value={endDateRaw} onChange={(e) => setEndDateRaw(e.target.value)} /> 
                  <Button variant="secondary" onClick={handleShowResults} className="text-sm"> 
                    {showResultsActive ? ( 
                      <span className="flex items-center gap-1"> 
                        <span className="inline-block w-2 h-2 bg-green-500 rounded-full"></span> 
                        Show Results 
                      </span> 
                    ) : ( 
                      "Show Results" 
                    )} 
                  </Button> 
                  <Button variant="secondary" onClick={handleRefreshUpcoming} className="text-sm">Refresh</Button> 
                  <Button variant="secondary" onClick={handleExportUpcoming} className="text-sm">Export</Button> 
                </div> 
              </div> 
              {/* NEW: Save button for upcoming meetings */}
              <div className="mb-4">
                <Button 
                  onClick={handleSaveChanges} 
                  disabled={!upcomingModified}
                  className="text-sm"
                >
                  Save Changes
                </Button>
              </div>
              <ResizableTable 
                rows={sortedUpcoming} 
                columns={upcomingCols} 
                stickyLeftCount={3} 
                drafts={upcomingDrafts} 
                setDrafts={setUpcomingDrafts} 
                savingId={upcomingSavingId} 
                onUpdate={handleUpdateRow} 
                onSort={handleUpcomingSort} 
                sortKey={upcomingSortKey} 
                sortDir={upcomingSortDir} 
                openCell={upcomingOpenCell} 
                setOpenCell={setUpcomingOpenCell} 
              />
            </div> 
          </Card> 
        )} 
        {activeView === "progress" && ( 
          <Card title="Progress Monitoring"> 
            <div className="p-4">
              <div className="mb-4 flex items-center justify-between flex-wrap gap-2"> 
                <h2 className="text-xl font-semibold text-slate-700">Progress Monitoring</h2> 
                <div className="flex items-center gap-2"> 
                  <Button variant="secondary" onClick={() => fetchProgressMonitoring()} className="text-sm">Refresh</Button> 
                  <Button variant="secondary" onClick={handleExportProgress} className="text-sm">Export</Button> 
                </div> 
              </div> 
              <ResizableTable 
                rows={sortedProgress} 
                columns={progressCols} 
                stickyLeftCount={1} 
                onSort={handleProgressSort} 
                sortKey={progressSortKey} 
                sortDir={progressSortDir} 
              /> 
              {progressPageCount > 1 && ( 
                <div className="mt-4 flex items-center justify-center gap-2"> 
                  <Button variant="secondary" onClick={() => setProgressPage((p) => Math.max(1, p - 1))} disabled={progressPage === 1}>Prev</Button> 
                  <span className="text-sm text-slate-600">Page {progressPage} of {progressPageCount}</span> 
                  <Button variant="secondary" onClick={() => setProgressPage((p) => Math.min(progressPageCount, p + 1))} disabled={progressPage === progressPageCount}>Next</Button> 
                </div> 
              )}
            </div> 
          </Card> 
        )} 
        {activeView === "all" && ( 
          <Card title="All Records"> 
            <div className="p-4">
              <div className="mb-4 flex items-center justify-between flex-wrap gap-2"> 
                <h2 className="text-xl font-semibold text-slate-700">All Records</h2> 
                <div className="flex items-center gap-2"> 
                  <Button variant="secondary" onClick={() => { setAllDrafts({}); setAllModified(false); fetchAllRecords(); }} className="text-sm">Refresh</Button> 
                  <Button variant="secondary" onClick={handleExportAll} className="text-sm">Export</Button> 
                </div> 
              </div> 
              {/* NEW: Save button for all records */}
              <div className="mb-4">
                <Button 
                  onClick={handleSaveChanges} 
                  disabled={!allModified}
                  className="text-sm"
                >
                  Save Changes
                </Button>
              </div>
              <ResizableTable 
                rows={sortedAll} 
                columns={allCols} 
                stickyLeftCount={3} 
                drafts={allDrafts} 
                setDrafts={setAllDrafts} 
                savingId={allSavingId} 
                onUpdate={handleUpdateRow} 
                onSort={handleAllSort} 
                sortKey={allSortKey} 
                sortDir={allSortDir} 
                openCell={allOpenCell} 
                setOpenCell={setAllOpenCell} 
              /> 
              {allPageCount > 1 && ( 
                <div className="mt-4 flex items-center justify-center gap-2"> 
                  <Button variant="secondary" onClick={() => setAllPage((p) => Math.max(1, p - 1))} disabled={allPage === 1}>Prev</Button> 
                  <span className="text-sm text-slate-600">Page {allPage} of {allPageCount}</span> 
                  <Button variant="secondary" onClick={() => setAllPage((p) => Math.min(allPageCount, p + 1))} disabled={allPage === allPageCount}>Next</Button> 
                </div> 
              )}
            </div> 
          </Card> 
        )} 
      </div> 
    </div> 
  ); 
}
