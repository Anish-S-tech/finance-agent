-- ============================================================
-- FinMentor — structured financial profile, planner, mentor
-- Run AFTER supabase/schema.sql.
-- ============================================================

-- ============================================================
-- 1. INCOME SOURCES
-- ============================================================
create table if not exists income_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  label text not null,
  amount numeric not null check (amount >= 0),
  frequency text not null default 'monthly',     -- 'monthly' | 'yearly' | 'one_time'
  pay_day int check (pay_day between 1 and 31),
  is_primary boolean default false,
  created_at timestamptz default now()
);

-- ============================================================
-- 2. EXPENSES
-- ============================================================
create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  label text not null,
  category text not null default 'other',        -- 'housing' | 'food' | 'transport' | 'utilities' | 'shopping'
                                                  -- | 'entertainment' | 'health' | 'education' | 'other'
  amount numeric not null check (amount >= 0),
  frequency text not null default 'monthly',     -- 'monthly' | 'yearly' | 'one_time'
  is_essential boolean default true,
  created_at timestamptz default now()
);

-- ============================================================
-- 3. DEBTS / EMIs
-- ============================================================
create table if not exists debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  label text not null,
  debt_type text not null default 'other',       -- 'home' | 'car' | 'personal' | 'education' | 'credit_card' | 'other'
  outstanding numeric not null check (outstanding >= 0),
  interest_rate numeric default 0,               -- annual %, e.g. 10.5
  emi numeric not null default 0,                -- monthly payment (minimum due for credit cards)
  emi_day int check (emi_day between 1 and 31),
  remaining_months int,                          -- null for revolving credit
  credit_limit numeric,                          -- credit cards only
  created_at timestamptz default now()
);

-- ============================================================
-- 4. GOALS
-- ============================================================
create table if not exists goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  label text not null,
  target_amount numeric not null check (target_amount > 0),
  current_amount numeric default 0,
  target_date date,
  priority int default 2 check (priority between 1 and 3),   -- 1 = high
  monthly_contribution numeric default 0,
  created_at timestamptz default now()
);

-- ============================================================
-- 5. ACTION ITEMS (personalized action planner)
-- ============================================================
create table if not exists action_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  action_key text not null,                      -- stable key so regeneration preserves status
  focus_area text not null,                      -- 'spend' | 'save' | 'debt' | 'goals' | 'cashflow'
  title text not null,
  detail text,
  impact_amount numeric,                         -- ₹/month freed or saved
  priority int default 2,
  status text default 'todo',                    -- 'todo' | 'doing' | 'done' | 'dismissed'
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, action_key)
);

-- ============================================================
-- 6. MENTOR CHAT HISTORY
-- ============================================================
create table if not exists mentor_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role text not null,                            -- 'user' | 'assistant'
  content text not null,
  created_at timestamptz default now()
);

-- ============================================================
-- 7. SAVED SIMULATIONS
-- ============================================================
create table if not exists simulations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  scenario jsonb not null,
  result_summary jsonb,
  created_at timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table income_sources enable row level security;
alter table expenses enable row level security;
alter table debts enable row level security;
alter table goals enable row level security;
alter table action_items enable row level security;
alter table mentor_messages enable row level security;
alter table simulations enable row level security;

create policy "Users manage their own income" on income_sources
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage their own expenses" on expenses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage their own debts" on debts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage their own goals" on goals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage their own actions" on action_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage their own mentor messages" on mentor_messages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage their own simulations" on simulations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- INDEXES
-- ============================================================
create index if not exists idx_income_user on income_sources(user_id);
create index if not exists idx_expenses_user on expenses(user_id);
create index if not exists idx_debts_user on debts(user_id);
create index if not exists idx_goals_user on goals(user_id);
create index if not exists idx_actions_user on action_items(user_id);
create index if not exists idx_mentor_user on mentor_messages(user_id, created_at);
create index if not exists idx_simulations_user on simulations(user_id);
