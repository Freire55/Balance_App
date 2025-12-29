export interface Transaction {
  id: number;
  type: 'income' | 'expense';
  amount: number;
  category_id: number;
  source: string;       // Added to match your DB schema
  description?: string; // Optional field
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