export type TransactionType = 'income' | 'expense';

export type RecurringFrequency = 'monthly' | 'weekly' | 'biweekly' | 'yearly';

export interface Category {
  id: number;
  name: string;
  icon?: string;
  color?: string;
  is_default?: number;
  created_at?: string;
}

export interface FinanceEvent {
  id: number;
  name: string;
  description?: string;
  icon: string;
  color: string;
  budget?: number;
  start_date?: string;
  end_date?: string;
  is_active?: number;
  created_at?: string;
  total_spent?: number;
  transaction_count?: number;
  category_breakdown?: CategoryBreakdown[];
}

export interface Transaction {
  id: number;
  type: TransactionType;
  amount: number;
  category_id?: number;
  description?: string;
  tags?: string;
  created_at: string;
  recurring_rule_id?: number | null;
  event_id?: number | null;
  // Joined fields
  category_name?: string;
  category_icon?: string;
  category_color?: string;
  event_name?: string;
  event_icon?: string;
  event_color?: string;
}

export interface RecurringTransaction {
  id: number;
  type: TransactionType;
  amount: number;
  category_id: number;
  description?: string;
  frequency?: RecurringFrequency;
  day_of_month?: number;
  start_date: string;
  end_date?: string | null;
  is_active?: number;
  last_processed_date?: string | null;
  // Joined fields
  category_name?: string;
  category_icon?: string;
  category_color?: string;
}

export interface Budget {
  id: number;
  category_id: number;
  monthly_limit: number;
  created_at?: string;
  // Joined fields
  category_name?: string;
  category_icon?: string;
  category_color?: string;
  spent_amount?: number;
  remaining_amount?: number;
  percentage_used?: number;
}

export interface AppNotification {
  id: number;
  type: 'recurring' | 'month_end' | 'year_end' | 'budget' | 'system';
  title: string;
  body: string;
  data?: string;
  is_read: number;
  created_at: string;
}

export interface SavingsGoal {
  id: number;
  name: string;
  target_amount: number;
  current_amount: number;
  quick_amount?: number;
  target_date?: string | null;
  icon?: string;
  color?: string;
  is_completed?: number;
  created_at?: string;
}

export interface QuickShortcut {
  id: number;
  title: string;
  icon: string;
  amount: number;
  category_id: number;
  type: TransactionType;
  // Joined fields
  category_name?: string;
  category_color?: string;
}

export interface PeriodSummary {
  income: number;
  expenses: number;
  netBalance: number;
  transactionCount: number;
  savingsRate: number;
  avgDailySpend?: number;
  largestExpense?: number;
}

export interface CategoryBreakdown {
  category_id: number;
  name: string;
  icon: string;
  color: string;
  type: TransactionType;
  total: number;
  count: number;
  percentage: number;
  is_event?: boolean;
  event_id?: number;
  sub_breakdown?: CategoryBreakdown[];
}

export interface TrendDataPoint {
  label: string;
  income: number;
  expenses: number;
  net: number;
  dateKey: string;
}

export interface TransactionFilterOptions {
  type?: TransactionType | 'all';
  categoryId?: number | 'all';
  eventId?: number | 'all';
  searchQuery?: string;
  tag?: string;
  startDate?: string;
  endDate?: string;
  minAmount?: number;
  maxAmount?: number;
  limit?: number;
  offset?: number;
  orderBy?: 'created_at' | 'amount';
  orderDirection?: 'ASC' | 'DESC';
  skipCount?: boolean;
}

export interface PaginatedTransactions {
  transactions: Transaction[];
  totalCount: number;
  hasMore: boolean;
}

export interface AppSettings {
  currency: string;
  currencySymbol: string;
  currencyPosition: 'prefix' | 'suffix';
  hideBalance: boolean;
  themeMode: 'light' | 'dark';
  dateFormat: string;
  notificationsEnabled: boolean;
  notifyRecurring: boolean;
  notifyMonthEnd: boolean;
  notifyYearEnd: boolean;
  notifyBudgets: boolean;
}

export interface DatabaseBackup {
  version: number;
  exportedAt: string;
  categories: Category[];
  transactions: Transaction[];
  recurringTransactions: RecurringTransaction[];
  budgets: Budget[];
  savingsGoals?: SavingsGoal[];
  quickShortcuts?: QuickShortcut[];
  financeEvents?: FinanceEvent[];
  settings: Record<string, string>;
}