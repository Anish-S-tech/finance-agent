// Mirrors backend/app/schemas/finmentor.py

export type Frequency = 'monthly' | 'yearly' | 'one_time'
export type ExpenseCategory =
  | 'housing' | 'food' | 'transport' | 'utilities' | 'shopping'
  | 'entertainment' | 'health' | 'education' | 'other'
export type DebtType = 'home' | 'car' | 'personal' | 'education' | 'credit_card' | 'other'
export type Severity = 'high' | 'medium' | 'low'
export type ActionStatus = 'todo' | 'doing' | 'done' | 'dismissed'
export type FocusArea = 'spend' | 'save' | 'debt' | 'goals' | 'cashflow' | 'profile'
export type Band = 'Critical' | 'Weak' | 'Fair' | 'Good' | 'Excellent'
export type Verdict = 'yes' | 'yes_with_caution' | 'not_now' | 'no'

export interface IncomeSource {
  id?: string
  label: string
  amount: number
  frequency: Frequency
  pay_day: number | null
  is_primary: boolean
}

export interface Expense {
  id?: string
  label: string
  category: ExpenseCategory
  amount: number
  frequency: Frequency
  is_essential: boolean
}

export interface Debt {
  id?: string
  label: string
  debt_type: DebtType
  outstanding: number
  interest_rate: number
  emi: number
  emi_day: number | null
  remaining_months: number | null
  credit_limit: number | null
}

export interface Goal {
  id?: string
  label: string
  target_amount: number
  current_amount: number
  target_date: string | null
  priority: number
  monthly_contribution: number
}

export interface Savings {
  current_savings: number
  emergency_fund: number
  investments: number
  health_insurance_cover: number | null
}

export interface UpcomingPayment {
  id?: string | null
  label: string
  event_type: string
  amount: number
  due_date: string
  is_recurring: boolean
}

export interface Metrics {
  monthly_income: number
  monthly_expenses: number
  essential_expenses: number
  discretionary_expenses: number
  monthly_emi: number
  goal_contributions: number
  surplus: number
  free_cash: number
  savings_rate: number
  debt_to_income: number
  liquid_savings: number
  monthly_obligations: number
  emergency_months: number
  discretionary_share: number
  credit_utilisation: number | null
  total_debt: number
  high_interest_debt: number
}

export interface ScoreComponent {
  key: string
  label: string
  score: number
  weight: number
  value: number | null
  target: string
}

export interface GoalStatus {
  label: string
  priority: number
  target_amount: number
  current_amount: number
  progress_pct: number
  target_date: string | null
  months_left: number | null
  required_monthly: number | null
  effective_contribution: number
  projected_months: number | null
  projected_date: string | null
  on_track: boolean
}

export interface Risk {
  id: string
  severity: Severity
  category: string
  title: string
  detail: string
  value: number | null
}

export interface HealthReport {
  score: number
  band: Band
  metrics: Metrics
  components: ScoreComponent[]
  goals: GoalStatus[]
  risks: Risk[]
}

export interface ForecastPoint {
  month: string
  label: string
  inflow: number
  outflow: number
  net: number
  balance: number
  events: string[]
  status: 'ok' | 'low' | 'shortfall'
}

export interface Forecast {
  starting_balance: number
  safety_buffer: number
  points: ForecastPoint[]
  lowest_balance: number
  lowest_month: string
  shortfall_months: string[]
  low_months: string[]
  milestones: string[]
}

export interface ActionItem {
  id: string
  action_key: string
  focus_area: FocusArea
  title: string
  detail: string
  impact_amount: number | null
  priority: number
  status: ActionStatus
}

export interface Overview {
  name: string | null
  health: HealthReport
  forecast: Forecast
  top_actions: ActionItem[]
  upcoming: UpcomingPayment[]
  has_data: boolean
}

// ---------- Simulation ----------
export type ScenarioChange =
  | { type: 'purchase'; label: string; amount: number; mode: 'cash' | 'emi'; tenure_months: number; interest_rate: number; down_payment: number; month: number }
  | { type: 'new_loan'; label: string; principal: number; interest_rate: number; tenure_months: number; receive_cash: boolean }
  | { type: 'income_change'; label: string; percent: number | null; amount: number | null; start_month: number; months: number | null }
  | { type: 'emergency'; label: string; amount: number; month: number; income_loss_months: number }
  | { type: 'savings_plan'; label: string; monthly_amount: number; start_month: number }
  | { type: 'expense_change'; label: string; category: ExpenseCategory | null; percent: number | null; amount: number | null; essential: boolean; start_month: number }

export interface SimulationDelta {
  score: number
  savings_rate: number
  debt_to_income: number
  emergency_months: number
  free_cash: number
  lowest_balance: number
  ending_balance: number
  new_shortfall_months: number
}

export interface GoalDelay {
  label: string
  baseline_months: number | null
  scenario_months: number | null
  delay_months: number | null
}

export interface SimulationResult {
  baseline: HealthReport
  scenario: HealthReport
  baseline_forecast: Forecast
  scenario_forecast: Forecast
  delta: SimulationDelta
  goal_delays: GoalDelay[]
  new_risks: Risk[]
}

export interface AffordRequest {
  item: string
  cost: number
  mode: 'cash' | 'emi'
  tenure_months: number
  interest_rate: number
  down_payment: number
}

export interface AffordabilityResult {
  item: string
  cost: number
  mode: string
  verdict: Verdict
  headline: string
  checks: { key: string; label: string; passed: boolean; detail: string }[]
  monthly_emi: number | null
  max_comfortable_amount: number
  alternatives: string[]
  simulation: SimulationResult
}

export interface SavedSimulation {
  id: string
  name: string
  scenario: { changes: ScenarioChange[]; months: number }
  result_summary: (SimulationDelta & { scenario_score: number }) | null
  created_at: string
}

export interface MentorMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}
