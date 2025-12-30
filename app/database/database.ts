import * as SQLite from "expo-sqlite";
import { Category, RecurringTransaction, Transaction } from "../types";

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

  await executeSql(`
    CREATE TABLE IF NOT EXISTS recurring_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      category_id INTEGER,
      description TEXT,
      day_of_month INTEGER,
      start_date TEXT NOT NULL,
      end_date TEXT,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );
  `);

  await executeSql(`
    CREATE TABLE IF NOT EXISTS app_metadata (
      key TEXT PRIMARY KEY,
      value TEXT
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


export const getRecurringTransactions = () =>
  executeSql<RecurringTransaction[]>(
    `SELECT * FROM recurring_transactions ORDER BY start_date DESC;`
  );

export const addRecurringTransaction = (transaction: Omit<RecurringTransaction, "id">) => {
  const { type, amount, category_id, description, start_date, end_date } = transaction;
  return executeSql(
    `INSERT INTO recurring_transactions 
     (type, amount, category_id, description, day_of_month, start_date, end_date) 
     VALUES (?, ?, ?, ?, 1, ?, ?);`,
    [type, amount, category_id, description, start_date, end_date]
  );
}

export const deleteRecurringTransaction = (id: number) =>
  executeSql(`DELETE FROM recurring_transactions WHERE id = ?;`, [id]); 

export const checkRecurringTransactionExists = async (
  description: string, 
  monthYear: string
): Promise<boolean> => {
  const result = await executeSql<Transaction[]>(
    `SELECT * FROM transactions 
     WHERE description = ? AND created_at LIKE ?;`,
    [description, `${monthYear}%`]
  );
  return result.length > 0;
};

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


export const getLastCheckDate = async (): Promise<Date> => {
  const result = await executeSql<{ value: string }[]>(
    `SELECT value FROM app_metadata WHERE key = 'last_recurring_check'`
  );
  return result[0]?.value ? new Date(result[0].value) : new Date(0);
};

export const setLastCheckDate = async (date: Date): Promise<void> => {
  await executeSql(
    `INSERT INTO app_metadata (key, value) 
     VALUES ('last_recurring_check', ?) 
     ON CONFLICT(key) DO UPDATE SET value = excluded.value;`,
    [date.toISOString()]
  );
};

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
    SELECT t.category_id as id, c.name, 
           SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE -t.amount END) as balance
    FROM transactions t
    JOIN categories c ON t.category_id = c.id
    WHERE t.created_at LIKE ?
    GROUP BY t.category_id
    ORDER BY ABS(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE -t.amount END)) DESC;
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


export const seedDatabase = async (): Promise<void> => {
  try {
    // 1. Wipe existing data to ensure a fresh demo environment
    await executeSql(`DELETE FROM transactions;`);
    await executeSql(`DELETE FROM budgets;`);
    await executeSql(`DELETE FROM categories;`);
    // Reset auto-increment counters
    await executeSql(`DELETE FROM sqlite_sequence WHERE name IN ('transactions', 'categories');`);

    // 2. Insert Categories
    const categoryNames = ["Salary", "Freelance", "Rent", "Groceries", "Dining", "Gym", "Transport", "Shopping", "Subscriptions"];
    for (const name of categoryNames) {
      await addCategory(name);
    }

    const cats = await getCategories();
    const findId = (name: string) => cats.find(c => c.name === name)?.id || 1;

    // 3. Generate Transactions for July through December 2025
    const dummyTransactions = [];
    const months = ["07", "08", "09", "10", "11", "12"];

    for (const month of months) {
      const year = "2025";
      
      // Every month has a Salary
      dummyTransactions.push({ 
        type: "income", amount: 3200, category_id: findId("Salary"), 
        description: `Paycheck ${month}`, created_at: `${year}-${month}-01T09:00:00Z` 
      });

      // Every month has Rent
      dummyTransactions.push({ 
        type: "expense", amount: 1100, category_id: findId("Rent"), 
        description: `Rent ${month}`, created_at: `${year}-${month}-02T10:00:00Z` 
      });

      // Weekly Transactions (Testing your Week 1, 2, 3, 4 logic)
      const weeks = [
        { day: "05", desc: "Weekly Groceries" },
        { day: "12", desc: "Dining Out" },
        { day: "19", desc: "Gym & Health" },
        { day: "26", desc: "Grocery Restock" }
      ];

      weeks.forEach((w, index) => {
        dummyTransactions.push({
          type: "expense", 
          amount: 50 + Math.random() * 100, // Randomized amounts for realistic charts
          category_id: index % 2 === 0 ? findId("Groceries") : findId("Dining"),
          description: w.desc,
          created_at: `${year}-${month}-${w.day}T12:00:00Z`
        });
      });

      // Random Freelance Income in August and October
      if (month === "08" || month === "10") {
        dummyTransactions.push({
          type: "income", amount: 600, category_id: findId("Freelance"),
          description: "Side Project", created_at: `${year}-${month}-15T14:00:00Z`
        });
      }

      // Large Shopping Expense in November (Black Friday)
      if (month === "11") {
        dummyTransactions.push({
          type: "expense", amount: 450, category_id: findId("Shopping"),
          description: "New Tech", created_at: `${year}-${month}-24T16:00:00Z`
        });
      }
    }

    // 4. Batch Insert
    for (const tx of dummyTransactions) {
      await addTransaction(tx as any);
    }

    console.log("🚀 Database fully populated with 6 months of data!");
  } catch (error) {
    console.error("❌ Seeding failed:", error);
  }
};


export const resetDatabase = async (): Promise<void> => {
  try {
    await executeSql(`DROP TABLE IF EXISTS transactions;`);
    await executeSql(`DROP TABLE IF EXISTS budgets;`);
    await executeSql(`DROP TABLE IF EXISTS categories;`);
    await executeSql(`DROP TABLE IF EXISTS recurring_transactions;`);
    await executeSql(`DROP TABLE IF EXISTS app_metadata;`);
    console.log("Database reset successfully.");
    await initDatabase();
  } catch (error) {
    console.error("Error resetting database:", error);
  }
}