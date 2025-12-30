import * as SQLite from "expo-sqlite";
import { Budget, Category, Transaction } from "../types";

let db: SQLite.SQLiteDatabase | null = null;

// --- DATABASE CONNECTION ---

export const connectDb = async (): Promise<SQLite.SQLiteDatabase> => {
  if (!db) {
    db = await SQLite.openDatabaseAsync("finance.db");
  }
  return db;
};


export const executeSql = async <T>(
  sql: string,
  params: any[] = []
): Promise<T> => {
  const database = await connectDb();
  const query = sql.trim().toUpperCase();

  if (query.startsWith("SELECT")) {
    const results = await database.getAllAsync<any>(sql, params);
    return results as T;
  } else {
    const result = await database.runAsync(sql, params);
    return {
      success: true,
      lastInsertRowId: result.lastInsertRowId,
      changes: result.changes,
    } as T;
  }
};

// --- INITIALIZATION ---

export const initDatabase = async (): Promise<void> => {
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

  await createTriggers();
  await createIndexes();
};

// TRANSACTIONS

export const addTransaction = (transaction: Omit<Transaction, "id">) => {
  const { type, amount, category_id, description, created_at } = transaction;
  return executeSql(
    `INSERT INTO transactions (type, amount, category_id, description, created_at) 
     VALUES (?, ?, ?, ?, ?);`,
    [type, amount, category_id, description, created_at]
  );
};

export const getTransactions = () =>
  executeSql<Transaction[]>(
    `SELECT * FROM transactions ORDER BY created_at DESC;`
  );

export const deleteTransaction = (id: number) =>
  executeSql(`DELETE FROM transactions WHERE id = ?;`, [id]);

// CATEGORIES 

export const getCategories = () =>
  executeSql<Category[]>(`SELECT * FROM categories ORDER BY name ASC;`);

export const addCategory = (name: string) =>
  executeSql(`INSERT INTO categories (name) VALUES (?);`, [name]);

export const editCategory = (id: number, name: string) =>
  executeSql(`UPDATE categories SET name = ? WHERE id = ?;`, [name, id]);

export const deleteCategory = async (id:number) => {
  const sql = `DELETE FROM categories WHERE id = ?;`;
  return await executeSql<{ success: boolean }>(sql, [id]);
}

// PERIOD FILTERING & STATS

export const getMonthlyTransactions = (month: string, year: string) => {
  const filter = `${year}-${month}%`;
  return executeSql<Transaction[]>(
    `SELECT * FROM transactions 
     WHERE created_at LIKE ? 
     ORDER BY created_at DESC;`,
    [filter]
  );
};

export const getMonthlyTotal = async (month: string, year: string): Promise<number> => {
  const filter = `${year}-${month}%`;
  const sql = `
    SELECT SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END) as total 
    FROM transactions 
    WHERE created_at LIKE ?;
  `;
  const result = await executeSql<{ total: number }[]>(sql, [filter]);
  return result[0]?.total || 0;
};

export const getYearlyTotal = async (year: string): Promise<number> => {
  const filter = `${year}%`;
  const sql = `
    SELECT SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END) as total 
    FROM transactions 
    WHERE created_at LIKE ?;
  `;
  const result = await executeSql<{ total: number }[]>(sql, [filter]);
  return result[0]?.total || 0;
};

export const getTransactionCount = async (year: string, month?: string): Promise<number> => {
  const filter = month ? `${year}-${month}%` : `${year}%`;
  const sql = `SELECT COUNT(*) as count FROM transactions WHERE created_at LIKE ?;`;
  const result = await executeSql<{ count: number }[]>(sql, [filter]);
  return result[0]?.count || 0;
};

export const getCategoryBreakdown = async (year: string, month?: string) => {
  const filter = month ? `${year}-${month}%` : `${year}%`;
  const sql = `
    SELECT t.category_id as id, c.name, SUM(t.amount) as balance, t.type
    FROM transactions t
    JOIN categories c ON t.category_id = c.id
    WHERE t.created_at LIKE ?
    GROUP BY t.category_id, t.type
    ORDER BY ABS(SUM(t.amount)) DESC;
  `;
  return await executeSql<any[]>(sql, [filter]);
};

export const getPeriodTotal = async (year: string, month?: string): Promise<number> => {
  const filter = month ? `${year}-${month}%` : `${year}%`;
  const sql = `
    SELECT SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END) as total 
    FROM transactions 
    WHERE created_at LIKE ?;
  `;
  const result = await executeSql<{ total: number }[]>(sql, [filter]);
  return result[0]?.total || 0;
};

// TRIGGERS & INDEXES

export const createIndexes = async (): Promise<void> => {
  await executeSql(`CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);`);
  await executeSql(`CREATE INDEX IF NOT EXISTS idx_transactions_cat_id ON transactions(category_id);`);
  await executeSql(`CREATE INDEX IF NOT EXISTS idx_budgets_cat_id ON budgets(category_id);`);
  console.log('Indexes created');
};

export const createTriggers = async (): Promise<void> => {
  await executeSql(`
    CREATE TRIGGER IF NOT EXISTS trg_init_budget
    AFTER INSERT ON transactions
    BEGIN
      INSERT OR IGNORE INTO budgets (category_id, balance)
      VALUES (NEW.category_id, 0);
    END;
  `);

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