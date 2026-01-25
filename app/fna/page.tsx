
"use client";
export const dynamic = "force-dynamic";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabaseClient";

/**
 * Financial Needs Analysis (FNA) — page.tsx
 *
 * Fixes included:
 * 1) Client search now queries public.client_registrations (via supabase.from("client_registrations"))
 * using first_name / last_name / phone (ILIKE) and displays First, Last, Phone, Email.
 * 2) Selecting a client loads/creates an fna_header row, then fetches each tab’s data from the
 * appropriate fna_* tables using fna_id.
 * 3) Minimal, practical CRUD for each fna_* table (add/edit/delete + save).
 *
 * Assumptions:
 * - Supabase auth is required; if no session, user is redirected to /auth.
 * - One “active” FNA per client is represented by the most recently updated fna_header for that client.
 */

// ✅ Navigation/auth-gating helper (cookie auth matches /auth and /dashboard behavior)
const AUTH_COOKIE = "canfs_auth";
function hasAuthCookie() {
  if (typeof document === "undefined") return false;
  return document.cookie.split("; ").some((c) => c.startsWith(`${AUTH_COOKIE}=true`));
}

type UUID = string;

type ClientRow = {
  id: UUID;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
};

type FnaHeader = {
  id: UUID;
  client_id: UUID;
  created_at?: string;
  updated_at?: string;

  // Tell us about you
  spouse_name?: string | null;
  spouse_dob?: string | null; // date
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
  client_dob?: string | null; // date
  home_phone?: string | null;
  mobile_phone?: string | null;
  personal_email?: string | null;
  spouse_mobile_phone?: string | null;
  spouse_email?: string | null;

  // Children / education
  more_children_planned?: boolean | null;
  more_children_count?: number | null;

  // Goals / properties
  goals_text?: string | null;
  own_or_rent?: string | null;
  properties_notes?: string | null;

  // Assets (general)
  has_old_401k?: boolean | null;
  expects_lump_sum?: boolean | null;

  // Life insurance need summary
  li_debt?: number | null;
  li_income?: number | null;
  li_mortgage?: number | null;
  li_education?: number | null;
  li_total_needed?: number | null;
  li_insurance_in_place?: number | null;
  li_insurance_gap?: number | null;

  // Estate / retirement questions
  has_will?: boolean | null;
  will_last_updated?: string | null; // date
  has_trust?: boolean | null;
  trust_type?: string | null;
  trust_purpose?: string | null;
  retirement_monthly_need?: number | null;
  retirement_target_date?: string | null; // date
  monthly_commitment?: number | null;

  // Next appointment
  next_appointment_date?: string | null; // date
  next_appointment_time?: string | null; // time
};

type RowBase = { id: UUID; fna_id: UUID } & Record<string, any>;

type TabKey =
  | "client_family"
  | "goals_properties"
  | "assets"
  | "liabilities"
  | "insurance"
  | "income_estate";

const TAB_LABELS: Record<TabKey, string> = {
  client_family: "Client & Family",
  goals_properties: "Goals & Properties",
  assets: "Assets",
  liabilities: "Liabilities",
  insurance: "Insurance",
  income_estate: "Income & Estate",
};

const US_STATES = [
  "",
  "Alabama",
  "Alaska",
  "Arizona",
  "Arkansas",
  "California",
  "Colorado",
  "Connecticut",
  "Delaware",
  "Florida",
  "Georgia",
  "Hawaii",
  "Idaho",
  "Illinois",
  "Indiana",
  "Iowa",
  "Kansas",
  "Kentucky",
  "Louisiana",
  "Maine",
  "Maryland",
  "Massachusetts",
  "Michigan",
  "Minnesota",
  "Mississippi",
  "Missouri",
  "Montana",
  "Nebraska",
  "Nevada",
  "New Hampshire",
  "New Jersey",
  "New Mexico",
  "New York",
  "North Carolina",
  "North Dakota",
  "Ohio",
  "
