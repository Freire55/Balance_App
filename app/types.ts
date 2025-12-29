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