-- ============================================================
-- FinClarity — Phase 1 Database Schema
-- Target: Supabase (Postgres)
-- Note: auth.users is managed by Supabase Auth automatically.
--       We extend it with our own user_profile table (1:1).
-- ============================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ============================================================
-- 1. USER PROFILE
-- Extends auth.users. auth.users already has id, email, created_at.
-- ============================================================
create table if not exists user_profile (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  age int,
  occupation text,
  monthly_income numeric,
  salary_day int check (salary_day between 1 and 31),
  num_dependents int default 0,
  onboarding_step int default 0,          -- 0 = not started, 1 = profile, 2 = income, 3 = household, 4 = complete
  onboarding_completed boolean default false,
  last_login timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- 2. FINANCIAL CONTEXT + FINANCIAL ITEMS
-- The core "context layer" — every financial fact is stored
-- with metadata, not just a raw value.
-- ============================================================

-- A financial_item is one discrete fact about the user
-- e.g. "monthly_income", "has_health_insurance", "rent_amount"
create table if not exists financial_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  item_key text not null,                  -- e.g. 'monthly_income', 'health_insurance'
  item_category text not null,             -- 'income' | 'expense' | 'debt' | 'insurance' | 'savings' | 'dependents'
  value_numeric numeric,                   -- for numeric facts
  value_text text,                         -- for non-numeric facts (e.g. "yes"/"no", plan name)
  value_boolean boolean,                   -- for yes/no facts
  source text not null default 'user',     -- 'user' | 'document' | 'inferred' | 'ai'
  confidence numeric default 1.0 check (confidence between 0 and 1),
  verified boolean default false,
  ai_allowed boolean default true,         -- can AI agents use this fact?
  last_updated timestamptz default now(),
  created_at timestamptz default now(),
  unique(user_id, item_key)
);

-- ContextSources — tracks *where* a financial_item's value came from
-- (supports multiple sources over time, audit trail of value changes)
create table if not exists context_sources (
  id uuid primary key default gen_random_uuid(),
  financial_item_id uuid references financial_items(id) on delete cascade not null,
  source_type text not null,               -- 'manual_entry' | 'document_upload' | 'ai_inference'
  source_reference text,                   -- e.g. document id, or note
  recorded_value_numeric numeric,
  recorded_value_text text,
  recorded_at timestamptz default now()
);

-- ============================================================
-- 3. CONSENT RECORDS
-- Explicit, granular consent — shown BEFORE data collection.
-- ============================================================
create table if not exists consent_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  consent_key text not null,               -- 'store_salary' | 'store_expenses' | 'store_bank_account'
                                            -- | 'ai_recommendations' | 'share_analytics' | 'document_processing'
  granted boolean not null default false,
  granted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, consent_key)
);

-- ============================================================
-- 4. FINANCIAL CALENDAR
-- Upcoming dated financial events (rent, EMI, salary, premiums)
-- ============================================================
create table if not exists financial_calendar (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  event_type text not null,                -- 'rent' | 'emi' | 'salary' | 'insurance_premium' | 'credit_card_due' | 'other'
  label text not null,
  amount numeric,
  due_date date not null,
  is_recurring boolean default false,
  recurrence_interval text,                -- 'monthly' | 'weekly' | 'yearly' | null
  status text default 'upcoming',          -- 'upcoming' | 'paid' | 'overdue' | 'skipped'
  created_at timestamptz default now()
);

-- ============================================================
-- 5. UPLOADED DOCUMENTS
-- Metadata only in Phase 1 — no parsing/analysis yet.
-- Actual files live in Supabase Storage.
-- ============================================================
create table if not exists uploaded_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  document_type text not null,             -- 'insurance_policy' | 'salary_slip' | 'loan_statement' | 'medical_estimate' | 'other'
  file_name text not null,
  storage_path text not null,              -- path within Supabase Storage bucket
  file_size_bytes bigint,
  mime_type text,
  encrypted boolean default true,
  processed boolean default false,         -- future phases will flip this
  uploaded_at timestamptz default now()
);

-- ============================================================
-- 6. PROFILE COMPLETENESS
-- Tracks what % of the financial picture is filled in,
-- and which specific facts are missing (drives Module 6).
-- ============================================================
create table if not exists profile_completeness (
  user_id uuid primary key references auth.users(id) on delete cascade,
  income_complete boolean default false,
  savings_complete boolean default false,
  expenses_complete boolean default false,
  debts_complete boolean default false,
  insurance_complete boolean default false,
  dependents_complete boolean default false,
  overall_percent numeric default 0,
  last_calculated timestamptz default now()
);

-- ============================================================
-- 7. AUDIT LOGS
-- Every sensitive read/write should be traceable.
-- ============================================================
create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  action text not null,                    -- 'consent_granted' | 'data_exported' | 'data_deleted' | 'document_uploaded' | 'financial_item_updated' ...
  entity_type text,                        -- 'financial_item' | 'consent_record' | 'document' | 'profile'
  entity_id uuid,
  metadata jsonb,
  ip_address text,
  created_at timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- Every table: a user can only see/modify their own rows.
-- ============================================================
alter table user_profile enable row level security;
alter table financial_items enable row level security;
alter table context_sources enable row level security;
alter table consent_records enable row level security;
alter table financial_calendar enable row level security;
alter table uploaded_documents enable row level security;
alter table profile_completeness enable row level security;
alter table audit_logs enable row level security;

create policy "Users manage their own profile" on user_profile
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "Users manage their own financial items" on financial_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage their own context sources" on context_sources
  for all using (
    auth.uid() = (select user_id from financial_items where financial_items.id = context_sources.financial_item_id)
  );

create policy "Users manage their own consent" on consent_records
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage their own calendar" on financial_calendar
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage their own documents" on uploaded_documents
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage their own completeness" on profile_completeness
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users view their own audit logs" on audit_logs
  for select using (auth.uid() = user_id);

-- ============================================================
-- HELPFUL INDEXES
-- ============================================================
create index if not exists idx_financial_items_user on financial_items(user_id);
create index if not exists idx_financial_items_category on financial_items(user_id, item_category);
create index if not exists idx_calendar_user_date on financial_calendar(user_id, due_date);
create index if not exists idx_documents_user on uploaded_documents(user_id);
create index if not exists idx_audit_user on audit_logs(user_id, created_at desc);
