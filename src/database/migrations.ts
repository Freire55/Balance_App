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
  },
  {
    version: 3,
    name: 'notifications_goals_shortcuts_and_tags',
    up: async (db: SQLite.SQLiteDatabase) => {
      // 1. Add tags column to transactions if not present
      const txCols = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(transactions)`);
      const txColNames = txCols.map(c => c.name);
      if (!txColNames.includes('tags')) {
        await db.execAsync(`ALTER TABLE transactions ADD COLUMN tags TEXT`);
      }

      // 2. Notifications table for in-app notification center
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS app_notifications (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          type TEXT NOT NULL,
          title TEXT NOT NULL,
          body TEXT NOT NULL,
          data TEXT,
          is_read INTEGER DEFAULT 0,
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_notif_created ON app_notifications(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_notif_read ON app_notifications(is_read);
      `);

      // 3. Savings goals table
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS savings_goals (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          target_amount REAL NOT NULL,
          current_amount REAL DEFAULT 0,
          target_date TEXT,
          icon TEXT DEFAULT 'savings',
          color TEXT DEFAULT '#10B981',
          is_completed INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now'))
        );
      `);

      // 4. Quick-Add shortcuts table
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS quick_shortcuts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          icon TEXT NOT NULL,
          amount REAL NOT NULL,
          category_id INTEGER,
          type TEXT DEFAULT 'expense',
          FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
        );
      `);

      // 5. Populate default notification settings
      await db.execAsync(`
        INSERT OR IGNORE INTO app_settings (key, value) VALUES ('notifications_enabled', 'true');
        INSERT OR IGNORE INTO app_settings (key, value) VALUES ('notify_recurring', 'true');
        INSERT OR IGNORE INTO app_settings (key, value) VALUES ('notify_month_end', 'true');
        INSERT OR IGNORE INTO app_settings (key, value) VALUES ('notify_year_end', 'true');
        INSERT OR IGNORE INTO app_settings (key, value) VALUES ('notify_budgets', 'true');
      `);

      // 6. Populate default quick shortcuts if categories exist
      const coffeeCat = await db.getAllAsync<{ id: number }>(`SELECT id FROM categories WHERE name LIKE '%Dining%' OR name LIKE '%Coffee%' LIMIT 1`);
      const groceryCat = await db.getAllAsync<{ id: number }>(`SELECT id FROM categories WHERE name LIKE '%Groceries%' LIMIT 1`);
      const transportCat = await db.getAllAsync<{ id: number }>(`SELECT id FROM categories WHERE name LIKE '%Transport%' LIMIT 1`);

      const shortcutsCount = await db.getAllAsync<{ count: number }>(`SELECT COUNT(*) as count FROM quick_shortcuts`);
      if (!shortcutsCount[0] || shortcutsCount[0].count === 0) {
        if (coffeeCat[0]) {
          await db.runAsync(`INSERT INTO quick_shortcuts (title, icon, amount, category_id, type) VALUES (?, ?, ?, ?, ?)`,
            ['Espresso / Coffee', 'local-cafe', 3.50, coffeeCat[0].id, 'expense']);
          await db.runAsync(`INSERT INTO quick_shortcuts (title, icon, amount, category_id, type) VALUES (?, ?, ?, ?, ?)`,
            ['Lunch / Dining', 'restaurant', 14.00, coffeeCat[0].id, 'expense']);
        }
        if (groceryCat[0]) {
          await db.runAsync(`INSERT INTO quick_shortcuts (title, icon, amount, category_id, type) VALUES (?, ?, ?, ?, ?)`,
            ['Quick Groceries', 'local-grocery-store', 25.00, groceryCat[0].id, 'expense']);
        }
        if (transportCat[0]) {
          await db.runAsync(`INSERT INTO quick_shortcuts (title, icon, amount, category_id, type) VALUES (?, ?, ?, ?, ?)`,
            ['Fuel / Transit', 'directions-car', 40.00, transportCat[0].id, 'expense']);
        }
      }
    }
  },
  {
    version: 4,
    name: 'performance_and_goals_quick_amount',
    up: async (db: SQLite.SQLiteDatabase) => {
      // 1. Add quick_amount to savings_goals
      const goalCols = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(savings_goals)`);
      const goalColNames = goalCols.map(c => c.name);
      if (!goalColNames.includes('quick_amount')) {
        await db.execAsync(`ALTER TABLE savings_goals ADD COLUMN quick_amount REAL DEFAULT 25.0`);
      }

      // 2. High-performance covering indexes
      await db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_tx_cat_type_date ON transactions(category_id, type, created_at);
        CREATE INDEX IF NOT EXISTS idx_budgets_cat ON budgets(category_id);
        CREATE INDEX IF NOT EXISTS idx_goals_completed ON savings_goals(is_completed);
      `);
    }
  },
  {
    version: 5,
    name: 'events_and_trips_tracking',
    up: async (db: SQLite.SQLiteDatabase) => {
      // 1. Finance Events / Trips table
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS finance_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          description TEXT,
          icon TEXT DEFAULT 'flight',
          color TEXT DEFAULT '#F43F5E',
          budget REAL DEFAULT 0,
          start_date TEXT,
          end_date TEXT,
          is_active INTEGER DEFAULT 1,
          created_at TEXT DEFAULT (datetime('now'))
        );
      `);

      // 2. Add event_id and tags to transactions if not present
      const txCols = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(transactions)`);
      const txColNames = txCols.map(c => c.name);
      if (!txColNames.includes('tags')) {
        await db.execAsync(`ALTER TABLE transactions ADD COLUMN tags TEXT`);
      }
      if (!txColNames.includes('event_id')) {
        await db.execAsync(`ALTER TABLE transactions ADD COLUMN event_id INTEGER`);
      }

      // 3. Index for event transactions
      await db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_tx_event_id ON transactions(event_id);
      `);

      // 4. Seed default sample vacation event if empty
      const existingEvents = await db.getAllAsync<{ id: number }>(`SELECT id FROM finance_events LIMIT 1`);
      if (existingEvents.length === 0) {
        await db.runAsync(
          `INSERT INTO finance_events (name, description, icon, color, budget) VALUES (?, ?, ?, ?, ?)`,
          ['Summer Vacation', 'Holiday trip: flights, hotels, food & adventures', 'flight', '#F43F5E', 1500.0]
        );
      }
    }
  }
];

export async function ensureSafeSchema(db: SQLite.SQLiteDatabase): Promise<void> {
  try {
    const txCols = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(transactions)`);
    const txColNames = txCols.map(c => c.name);
    if (!txColNames.includes('tags')) {
      await db.execAsync(`ALTER TABLE transactions ADD COLUMN tags TEXT`);
    }
    if (!txColNames.includes('event_id')) {
      await db.execAsync(`ALTER TABLE transactions ADD COLUMN event_id INTEGER`);
    }

    // High-performance covering indexes for sub-millisecond query execution
    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_tx_created_id_desc ON transactions(created_at DESC, id DESC);
      CREATE INDEX IF NOT EXISTS idx_tx_cover_budget ON transactions(type, created_at, category_id, amount);
      CREATE INDEX IF NOT EXISTS idx_tx_cover_event ON transactions(event_id, type, amount);
      CREATE INDEX IF NOT EXISTS idx_tx_cover_summary ON transactions(created_at, type, amount);
      CREATE INDEX IF NOT EXISTS idx_tx_rec_date ON transactions(recurring_rule_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_rec_cat ON recurring_transactions(category_id);
      CREATE INDEX IF NOT EXISTS idx_qs_cat ON quick_shortcuts(category_id);
      CREATE INDEX IF NOT EXISTS idx_events_active ON finance_events(is_active, created_at DESC);
    `);
  } catch (e) {
    console.warn('[Schema] Note ensuring columns and indexes:', e);
  }
}

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

  await ensureSafeSchema(db);
}
