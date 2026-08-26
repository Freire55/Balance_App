export type TransactionType = 'income' | 'expense';

export type RecurringFrequency = 'monthly' | 'weekly' | 'yearly';

export interface Category {
  id: number;
  name: string;
  icon?: string;
  color?: string;
  is_default?: number;
  created_at?: string;
}

export interface Transaction {
  id: number;
  type: TransactionType;
  amount: number;
  category_id: number;
  description?: string;
  created_at: string;
  recurring_rule_id?: number | null;
  // Joined fields
  category_name?: string;
  category_icon?: string;
  category_color?: string;
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
  searchQuery?: string;
  startDate?: string;
  endDate?: string;
  minAmount?: number;
  maxAmount?: number;
  limit?: number;
  offset?: number;
  orderBy?: 'created_at' | 'amount';
  orderDirection?: 'ASC' | 'DESC';
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
  themeMode: 'light' | 'dark' | 'system';
  dateFormat: string;
}

export interface DatabaseBackup {
  version: number;
  exportedAt: string;
  categories: Category[];
  transactions: Transaction[];
  recurringTransactions: RecurringTransaction[];
  budgets: Budget[];
  settings: Record<string, string>;
}