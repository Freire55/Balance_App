import * as SQLite from 'expo-sqlite';

export const DEFAULT_CATEGORIES = [
  { name: "Salary & Wages", icon: "work", color: "#10B981" },
  { name: "Freelance & Consulting", icon: "computer", color: "#06B6D4" },
  { name: "Investments & Dividends", icon: "trending-up", color: "#8B5CF6" },
  { name: "Housing & Rent", icon: "home", color: "#3B82F6" },
  { name: "Groceries & Supermarket", icon: "local-grocery-store", color: "#10B981" },
  { name: "Dining & Coffee", icon: "restaurant", color: "#F97316" },
  { name: "Transport & Fuel", icon: "directions-car", color: "#6366F1" },
  { name: "Shopping & Tech", icon: "shopping-bag", color: "#EC4899" },
  { name: "Health & Fitness", icon: "fitness-center", color: "#14B8A6" },
  { name: "Subscriptions & Cloud", icon: "subscriptions", color: "#06B6D4" },
  { name: "Travel & Vacations", icon: "flight", color: "#F43F5E" },
  { name: "Utilities & Internet", icon: "bolt", color: "#EAB308" },
  { name: "Personal & Wellness", icon: "spa", color: "#D946EF" },
  { name: "Education & Courses", icon: "school", color: "#64748B" },
];

export interface Migration {
  version: number;
  name: string;
  up: (db: SQLite.SQLiteDatabase) => Promise<void>;
}

export const migrations: Migration[] = [
  {
    version: 1,
    name: 'initial_schema',
    up: async (db: SQLite.SQLiteDatabase) => {
      // 1. Categories table
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS categories (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          icon TEXT DEFAULT 'category',
          color TEXT DEFAULT '#3B82F6',
          is_default INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now'))
        );
      `);

      // Add columns if categories table was created in older app version
      const catCols = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(categories)`);
      const catColNames = catCols.map(c => c.name);
      if (!catColNames.includes('icon')) {
        await db.execAsync(`ALTER TABLE categories ADD COLUMN icon TEXT DEFAULT 'category'`);
      }
      if (!catColNames.includes('color')) {
        await db.execAsync(`ALTER TABLE categories ADD COLUMN color TEXT DEFAULT '#3B82F6'`);
      }
      if (!catColNames.includes('is_default')) {
        await db.execAsync(`ALTER TABLE categories ADD COLUMN is_default INTEGER DEFAULT 0`);
      }
      if (!catColNames.includes('created_at')) {
        await db.execAsync(`ALTER TABLE categories ADD COLUMN created_at TEXT`);
        await db.runAsync(`UPDATE categories SET created_at = datetime('now') WHERE created_at IS NULL`);
      }

      // 2. Transactions table
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS transactions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
          amount REAL NOT NULL,
          category_id INTEGER,
          description TEXT,
          created_at TEXT NOT NULL,
          recurring_rule_id INTEGER,
          FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
        );
      `);

      const txCols = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(transactions)`);
      const txColNames = txCols.map(c => c.name);
      if (!txColNames.includes('recurring_rule_id')) {
        await db.execAsync(`ALTER TABLE transactions ADD COLUMN recurring_rule_id INTEGER`);
      }

      // 3. Recurring transactions table
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS recurring_transactions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
          amount REAL NOT NULL,
          category_id INTEGER,
          description TEXT,
          frequency TEXT DEFAULT 'monthly',
          day_of_month INTEGER DEFAULT 1,
          start_date TEXT NOT NULL,
          end_date TEXT,
          is_active INTEGER DEFAULT 1,
          last_processed_date TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
        );
      `);

      const recCols = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(recurring_transactions)`);
      const recColNames = recCols.map(c => c.name);
      if (!recColNames.includes('frequency')) {
        await db.execAsync(`ALTER TABLE recurring_transactions ADD COLUMN frequency TEXT DEFAULT 'monthly'`);
      }
      if (!recColNames.includes('is_active')) {
        await db.execAsync(`ALTER TABLE recurring_transactions ADD COLUMN is_active INTEGER DEFAULT 1`);
      }
      if (!recColNames.includes('last_processed_date')) {
        await db.execAsync(`ALTER TABLE recurring_transactions ADD COLUMN last_processed_date TEXT`);
      }
      if (!recColNames.includes('created_at')) {
        await db.execAsync(`ALTER TABLE recurring_transactions ADD COLUMN created_at TEXT`);
        await db.runAsync(`UPDATE recurring_transactions SET created_at = datetime('now') WHERE created_at IS NULL`);
      }

      // 4. Budgets table
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS budgets (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          category_id INTEGER NOT NULL UNIQUE,
          monthly_limit REAL DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
        );
      `);

      // 5. App settings table
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS app_settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
      `);

      // Default settings
      await db.execAsync(`
        INSERT OR IGNORE INTO app_settings (key, value) VALUES ('currency', 'EUR');
        INSERT OR IGNORE INTO app_settings (key, value) VALUES ('currency_symbol', '€');
        INSERT OR IGNORE INTO app_settings (key, value) VALUES ('currency_position', 'suffix');
        INSERT OR IGNORE INTO app_settings (key, value) VALUES ('hide_balance', 'false');
        INSERT OR IGNORE INTO app_settings (key, value) VALUES ('theme_mode', 'light');
      `);

      // 6. High-performance indexes for 10+ year scale
      await db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_tx_created_at ON transactions(created_at);
        CREATE INDEX IF NOT EXISTS idx_tx_category_id ON transactions(category_id);
        CREATE INDEX IF NOT EXISTS idx_tx_type_created ON transactions(type, created_at);
        CREATE INDEX IF NOT EXISTS idx_tx_recurring_rule ON transactions(recurring_rule_id);
        CREATE INDEX IF NOT EXISTS idx_rec_active ON recurring_transactions(is_active);
      `);

      // 7. Populate default categories if empty
      const existingCategories = await db.getAllAsync<{ count: number }>(`SELECT COUNT(*) as count FROM categories`);
      if (!existingCategories[0] || existingCategories[0].count === 0) {
        for (const cat of DEFAULT_CATEGORIES) {
          await db.runAsync(
            `INSERT INTO categories (name, icon, color, is_default) VALUES (?, ?, ?, 1)`,
            [cat.name, cat.icon, cat.color]
          );
        }
      } else {
        // Ensure existing categories have valid icons and colors
        for (const cat of DEFAULT_CATEGORIES) {
          await db.runAsync(
            `UPDATE categories SET icon = ?, color = ? WHERE name = ? AND (icon IS NULL OR icon = 'category' OR color IS NULL)`,
            [cat.icon, cat.color, cat.name]
          );
        }
      }
    }
  },
  {
    version: 2,
    name: 'performance_tuning_and_search_index',
    up: async (db: SQLite.SQLiteDatabase) => {
      // Add composite index for date range filtering and sorting
      await db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_tx_date_desc ON transactions(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_tx_cat_date ON transactions(category_id, created_at DESC);
      `);
    }
  }
];

export async function runMigrations(db: SQLite.SQLiteDatabase): Promise<void> {
  // Ensure migrations tracking table exists
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT DEFAULT (datetime('now'))
    );
  `);

  const appliedRows = await db.getAllAsync<{ version: number }>(
    `SELECT version FROM schema_migrations ORDER BY version ASC`.trim()
  );
  const appliedVersions = new Set(appliedRows.map(r => r.version));

  for (const migration of migrations) {
    if (!appliedVersions.has(migration.version)) {
      console.log(`Applying migration ${migration.version}: ${migration.name}...`);
      await db.withTransactionAsync(async () => {
        await migration.up(db);
        await db.runAsync(
          `INSERT INTO schema_migrations (version, name) VALUES (?, ?)`,
          [migration.version, migration.name]
        );
        await db.execAsync(`PRAGMA user_version = ${migration.version}`);
      });
      console.log(`Migration ${migration.version} applied successfully.`);
    }
  }
}
