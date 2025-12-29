import * as SQLite from 'expo-sqlite';
import { Budget, Category, Transaction } from '../types.js';

let db: SQLite.SQLiteDatabase | null = null;

export const connectDb = async (): Promise<SQLite.SQLiteDatabase> => {
  if (!db) {
    db = await SQLite.openDatabaseAsync('finance.db');
  }
  return db;
};

/**
 * Generic SQL executor.
 * Usage: const data = await executeSql<Transaction[]>(query, params);
 */
export const executeSql = async <T>(sql: string, params: any[] = []): Promise<T> => {
  const database = await connectDb();
  const query = sql.trim().toUpperCase();

  if (query.startsWith('SELECT')) {
    const results = await database.getAllAsync<any>(sql, params);
    return results as T;
  } else {
    const result = await database.runAsync(sql, params);
    return { success: true, lastInsertRowId: result.lastInsertRowId, changes: result.changes } as T;
  }
};

export const initDatabase = async (): Promise<void> => {
  // resetDatabase();
  await executeSql(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL
    );
  `);

  await executeSql(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      category_id INTEGER,
      description TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );
  `);

  await executeSql(`
    CREATE TABLE IF NOT EXISTS budgets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL UNIQUE,
      balance REAL DEFAULT 0,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );
  `);

  console.log('Database initialized');
};

// export const resetDatabase = async (): Promise<void> => {
//   await executeSql('DROP TABLE IF EXISTS transactions;');
//   await executeSql('DROP TABLE IF EXISTS budgets;');
//   await executeSql('DROP TABLE IF EXISTS categories;');
//   console.log('🗑️ All tables dropped.');
// };

// --- CRUD FUNCTIONS ---

export const addTransaction = async (transaction: Omit<Transaction, 'id'>) => {
  const { type, amount, category_id, description, created_at } = transaction;
  const sql = `
    INSERT INTO transactions (type, amount, category_id, description, created_at) 
    VALUES (?, ?, ?, ?, ?);
  `;
  const params = [type, amount, category_id, description, created_at];
  return await executeSql<{ success: boolean }>(sql, params);
};

export const getTransactions = async (): Promise<Transaction[]> => {
  const sql = `SELECT * FROM transactions ORDER BY created_at DESC;`;
  return await executeSql<Transaction[]>(sql);
};

export const deleteTransaction = async (id:number) => {
  const sql = `DELETE FROM transactions WHERE id = ?;`;
  return await executeSql<{ success: boolean }>(sql, [id]);
}

export const addCategory = async (category: Omit<Category, 'id'>) => {
  const { name } = category;
  const sql = `INSERT INTO categories (name) VALUES (?);`;
  return await executeSql<{ success: boolean }>(sql, [name]);
};

export const getCategories = async (): Promise<Category[]> => {
  const sql = `SELECT * FROM categories ORDER BY name ASC;`;
  return await executeSql<Category[]>(sql);
};

export const deleteCategory = async (id:number) => {
  const sql = `DELETE FROM categories WHERE id = ?;`;
  return await executeSql<{ success: boolean }>(sql, [id]);
}

export const editCategory = async (id:number, name:string) => {
  const sql = `UPDATE categories SET name = ? WHERE id = ?;`;
  return await executeSql<{ success: boolean }>(sql, [name, id]);
}

export const getAllPositiveBalance = async (): Promise<Budget[]> => {
  const sql = `SELECT * FROM budgets ORDER BY balance DESC;`;
  return await executeSql<Budget[]>(sql);
};

export const getAllNegativeBalance = async (): Promise<Budget[]> => {
  const sql = `SELECT * FROM budgets ORDER BY balance ASC;`;
  return await executeSql<Budget[]>(sql);
}

export const getTotalBalance = async (): Promise<number> => {
  const sql = `
    SELECT 
      SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END) as total_balance 
    FROM transactions;
  `;
  const result = await executeSql<{ total_balance: number }[]>(sql);
  return result[0]?.total_balance || 0;
};

export const getMonthlyTotal = async (month: string, year: string) => {
  const start = `${year}-${month}-01`;
  const end = `${year}-${month}-31`;

  const sql = `
    SELECT 
      SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END) as monthly_total 
    FROM transactions 
    WHERE created_at BETWEEN ? AND ?;
  `;
  const result = await executeSql<{ monthly_total: number }[]>(sql, [start, end]);
  return result[0]?.monthly_total || 0;
}



export const getYearlyTotal = async (year: string) => {
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;

  const sql = `
    SELECT 
      SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END) as yearly_total 
    FROM transactions 
    WHERE created_at BETWEEN ? AND ?;
  `;
  const result = await executeSql<{ yearly_total: number }[]>(sql, [start, end]);
  return result[0]?.yearly_total || 0;
}

export const getMonthlyTransactions = async (month: string, year: string): Promise<Transaction[]> => {
  const start = `${year}-${month}-01`;
  const end = `${year}-${month}-31`;

  const sql = `
    SELECT * FROM transactions 
    WHERE created_at BETWEEN ? AND ?
    ORDER BY created_at DESC;
  `;
  return await executeSql<Transaction[]>(sql, [start, end]);
}

export const getYearlyTransactions = async (year: string): Promise<Transaction[]> => {
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;

  const sql = `
    SELECT * FROM transactions 
    WHERE created_at BETWEEN ? AND ?
    ORDER BY created_at DESC;
  `;
  return await executeSql<Transaction[]>(sql, [start, end]);
}

// --- OPTIMIZATIONS ---

export const createIndexes = async (): Promise<void> => {
  await executeSql(`CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);`);
  await executeSql(`CREATE INDEX IF NOT EXISTS idx_transactions_cat_id ON transactions(category_id);`);
  await executeSql(`CREATE INDEX IF NOT EXISTS idx_budgets_cat_id ON budgets(category_id);`);
  console.log('Indexes created');
};

export const createTriggers = async (): Promise<void> => {
  // Trigger 1: Auto-create budget row if category is first-time used
  await executeSql(`
    CREATE TRIGGER IF NOT EXISTS trg_init_budget
    AFTER INSERT ON transactions
    BEGIN
      INSERT OR IGNORE INTO budgets (category_id, balance)
      VALUES (NEW.category_id, 0);
    END;
  `);

  // Trigger 2: Maintain current balance in budget table
  await executeSql(`
    CREATE TRIGGER IF NOT EXISTS trg_update_budget_balance
    AFTER INSERT ON transactions
    BEGIN
      UPDATE budgets 
      SET balance = balance + (
        CASE WHEN NEW.type = 'income' THEN NEW.amount ELSE -NEW.amount END
      )
      WHERE category_id = NEW.category_id;
    END;
  `);
  console.log('Triggers created');
};