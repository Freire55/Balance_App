export interface Transaction {
  id: number;
  type: 'income' | 'expense';
  amount: number;
  category_id: number;
  description?: string;
  created_at: string;
}

export interface Category {
  id: number;
  name: string;
}

export interface Budget {
  id: number;
  category_id: number; 
  balance: number;
}

export interface FinanceSummary {
  income: number;
  expenses: number;
  totalBalance: number;
}

export interface Trends {
    num: number,
    income: number;
    expenses: number;
}

export interface CategoryStat {
  id: number;
  name: string;
  balance: number;
  type: 'income' | 'expense';
}