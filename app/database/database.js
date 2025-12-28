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
      category TEXT,
      source TEXT NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL
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
      limit_amount REAL NOT NULL,
      period TEXT NOT NULL,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );
  `);

  // Balance snapshots table
  await executeSql(`
    CREATE TABLE IF NOT EXISTS balance_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      balance REAL NOT NULL,
      recorded_at TEXT NOT NULL
    );
  `);



  console.log('Database initialized');
};



export const resetDatabase = async () => {

  await executeSql('DROP TABLE IF EXISTS transactions;');
  await executeSql('DROP TABLE IF EXISTS categories;');
  await executeSql('DROP TABLE IF EXISTS budgets;');
  await executeSql('DROP TABLE IF EXISTS balance_snapshots;');

  console.log('🗑️ All tables dropped.');
};