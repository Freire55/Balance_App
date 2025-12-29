// database.js
import * as SQLite from 'expo-sqlite';

let db = null;

export const connectDb = async () => {
  if (!db) {
    db = await SQLite.openDatabaseAsync('finance.db');
  }
  return db;
};

export const executeSql = async (sql, params = []) => {
  const database = await connectDb();
  const query = sql.trim().toUpperCase();

  if (query.startsWith('SELECT')) {
    return await database.getAllAsync(sql, params);
  } else {
    await database.runAsync(sql, params);
    return { success: true };
  }
};


export const initDatabase = async () => {
  await connectDb();

   // Transactions table
  await executeSql(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      category_id INTEGER,
      source TEXT NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );
  `);

  // Categories table
  await executeSql(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      kind TEXT NOT NULL
    );
  `);

  // Budgets table
  await executeSql(`
    CREATE TABLE IF NOT EXISTS budgets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL,
      balance REAL DEFAULT 0,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );
  `);


  console.log('Database initialized');
};



export const resetDatabase = async () => {

  await executeSql('DROP TABLE IF EXISTS transactions;');
  await executeSql('DROP TABLE IF EXISTS categories;');
  await executeSql('DROP TABLE IF EXISTS budgets;');

  console.log('🗑️ All tables dropped.');
};


// CRUD FUNCTIONS


// Transactions

export const addTransaction = async (transaction) => {
  const { type, amount, category, source, description, created_at } = transaction;
  const sql = `
  INSERT INTO transactions (type, amount, category, source, description, created_at) VALUES (?, ?, ?, ?, ?, ?);
  `;
  const params = [type, amount, category, source, description, created_at];
  return await executeSql(sql, params);
};

export const getTransactions = async () => {
  const sql = `SELECT * FROM transactions ORDER BY created_at DESC;`;
  return await executeSql(sql);
}


// Categories

export const addCategory = async (category) => {
  const {name, kind} = category;
  const sql = `INSERT INTO categories (name, kind) VALUES (?, ?);`;
  const params = [name, kind];
  return await executeSql(sql, params);
}

export const getCategories = async () => {
  const sql = `SELECT * FROM categories ORDER BY name ASC;`;
  return await executeSql(sql);
}


// Budgets
export const getBudgets = async () => {
  const sql = `SELECT * FROM budgets ORDER BY category_id ASC;`;
  return await executeSql(sql);
}




// INDEXES

export const createIndexes = async () => {
  await executeSql(`CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);`);
  await executeSql(`CREATE INDEX IF NOT EXISTS idx_transactions_cat_id ON transactions(category_id);`);
  await executeSql(`CREATE INDEX IF NOT EXISTS idx_budgets_cat_id ON budgets(category_id);`);
  console.log('Indexes created');
}


// TRIGGERS

export const createTriggers = async () => {
  // Initialize budget for new category
  await executeSql(`
    CREATE TRIGGER IF NOT EXISTS trg_init_budget
    AFTER INSERT ON transactions
    BEGIN
      INSERT OR IGNORE INTO budgets (category_id, balance)
      VALUES (NEW.category_id, 0);
    END;
  `);


  // Update budget balance on transaction insert
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
}
