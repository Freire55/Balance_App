import * as SQLite from "expo-sqlite";
import { runMigrations } from "./migrations";
import {
  AppSettings,
  Category,
  CategoryBreakdown,
  PaginatedTransactions,
  PeriodSummary,
  RecurringTransaction,
  Transaction,
  TransactionFilterOptions,
  TrendDataPoint,
} from "./types";

let dbInstance: SQLite.SQLiteDatabase | null = null;
let dbInitPromise: Promise<SQLite.SQLiteDatabase> | null = null;

// --- DATABASE CONNECTION & PRAGMA OPTIMIZATIONS ---

export const connectDb = async (): Promise<SQLite.SQLiteDatabase> => {
  if (dbInstance) {
    return dbInstance;
  }
  if (!dbInitPromise) {
    dbInitPromise = (async () => {
      const db = await SQLite.openDatabaseAsync("finance.db");
      // Optimize performance and enforce integrity for 10+ year longevity
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;
        PRAGMA foreign_keys = ON;
        PRAGMA temp_store = MEMORY;
        PRAGMA cache_size = -64000;
      `);
      dbInstance = db;
      return db;
    })();
  }
  return dbInitPromise;
};

export const initDatabase = async (): Promise<void> => {
  const db = await connectDb();
  await runMigrations(db);
};

// Generic safe SQL execution
export const executeSql = async <T>(
  sql: string,
  params: any[] = []
): Promise<T> => {
  const db = await connectDb();
  const trimmed = sql.trim().toUpperCase();

  if (trimmed.startsWith("SELECT") || trimmed.startsWith("PRAGMA")) {
    const results = await db.getAllAsync<any>(sql, params);
    return results as T;
  } else {
    const result = await db.runAsync(sql, params);
    return {
      success: true,
      lastInsertRowId: result.lastInsertRowId,
      changes: result.changes,
    } as T;
  }
};

// --- TRANSACTIONS CRUD & PAGINATION ---

export const addTransaction = async (
  transaction: Omit<Transaction, "id">
): Promise<number> => {
  const db = await connectDb();
  const { type, amount, category_id, description, created_at, recurring_rule_id } = transaction;

  const result = await db.runAsync(
    `INSERT INTO transactions (type, amount, category_id, description, created_at, recurring_rule_id) 
     VALUES (?, ?, ?, ?, ?, ?)`,
    [type, amount, category_id || null, description?.trim() || null, created_at, recurring_rule_id || null]
  );
  return result.lastInsertRowId;
};

export const editTransaction = async (
  transaction: Pick<Transaction, "id" | "type" | "amount" | "category_id" | "description" | "created_at">
): Promise<void> => {
  const db = await connectDb();
  const { id, type, amount, category_id, description, created_at } = transaction;

  await db.runAsync(
    `UPDATE transactions 
     SET type = ?, amount = ?, category_id = ?, description = ?, created_at = ? 
     WHERE id = ?`,
    [type, amount, category_id || null, description?.trim() || null, created_at, id]
  );
};

export const deleteTransaction = async (id: number): Promise<void> => {
  const db = await connectDb();
  await db.runAsync(`DELETE FROM transactions WHERE id = ?`, [id]);
};

export const getTransactionById = async (id: number): Promise<Transaction | null> => {
  const db = await connectDb();
  const rows = await db.getAllAsync<Transaction>(`
    SELECT 
      t.id, t.type, t.amount, t.category_id, t.description, t.created_at, t.recurring_rule_id,
      c.name as category_name, 
      c.icon as category_icon, 
      c.color as category_color 
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE t.id = ?
  `, [id]);
  return rows[0] || null;
};

/**
 * High-performance filtered & paginated query for transactions.
 * Utilizes B-Tree indexes for instantaneous response even with 50,000+ records.
 */
export const getFilteredTransactions = async (
  options: TransactionFilterOptions = {}
): Promise<PaginatedTransactions> => {
  const db = await connectDb();
  const {
    type,
    categoryId,
    searchQuery,
    startDate,
    endDate,
    minAmount,
    maxAmount,
    limit = 50,
    offset = 0,
    orderBy = "created_at",
    orderDirection = "DESC",
  } = options;

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (type && type !== "all") {
    conditions.push("t.type = ?");
    params.push(type);
  }

  if (categoryId !== undefined && categoryId !== "all" && categoryId !== null) {
    const numericCatId = typeof categoryId === "number" ? categoryId : parseInt(String(categoryId), 10);
    if (!isNaN(numericCatId)) {
      conditions.push("t.category_id = ?");
      params.push(numericCatId);
    }
  }

  if (typeof startDate === "string" && startDate.trim().length > 0) {
    conditions.push("t.created_at >= ?");
    params.push(startDate.trim());
  }

  if (typeof endDate === "string" && endDate.trim().length > 0) {
    conditions.push("t.created_at <= ?");
    params.push(endDate.trim());
  }

  if (typeof minAmount === "number" && !isNaN(minAmount)) {
    conditions.push("t.amount >= ?");
    params.push(minAmount);
  }

  if (typeof maxAmount === "number" && !isNaN(maxAmount)) {
    conditions.push("t.amount <= ?");
    params.push(maxAmount);
  }

  if (typeof searchQuery === "string" && searchQuery.trim().length > 0) {
    const term = `%${searchQuery.trim()}%`;
    conditions.push("(t.description LIKE ? OR c.name LIKE ?)");
    params.push(term, term);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  // 1. Total Count (No trailing semicolon)
  const countSql = `SELECT COUNT(*) as total FROM transactions t LEFT JOIN categories c ON t.category_id = c.id ${whereClause}`.trim();
  const countResult = params.length > 0
    ? await db.getAllAsync<{ total: number }>(countSql, params)
    : await db.getAllAsync<{ total: number }>(countSql);
  const totalCount = countResult[0]?.total || 0;

  // 2. Paginated Data (No trailing semicolon)
  const orderCol = orderBy === "amount" ? "t.amount" : "t.created_at";
  const direction = orderDirection === "ASC" ? "ASC" : "DESC";
  const safeLimit = typeof limit === "number" && !isNaN(limit) && limit > 0 ? limit : 50;
  const safeOffset = typeof offset === "number" && !isNaN(offset) && offset >= 0 ? offset : 0;

  const dataSql = `SELECT t.id, t.type, t.amount, t.category_id, t.description, t.created_at, t.recurring_rule_id, c.name as category_name, c.icon as category_icon, c.color as category_color FROM transactions t LEFT JOIN categories c ON t.category_id = c.id ${whereClause} ORDER BY ${orderCol} ${direction}, t.id DESC LIMIT ? OFFSET ?`.trim();

  const queryParams = [...params, safeLimit, safeOffset];
  const transactions = await db.getAllAsync<Transaction>(dataSql, queryParams);

  return {
    transactions,
    totalCount,
    hasMore: safeOffset + transactions.length < totalCount,
  };
};

export const getTransactions = async (): Promise<Transaction[]> => {
  const result = await getFilteredTransactions({ limit: 10000 });
  return result.transactions;
};

// --- PERIOD ANALYTICS & STATS (PURE SQL AGGREGATION) ---

export const getPeriodSummary = async (
  startDate: string,
  endDate: string
): Promise<PeriodSummary> => {
  const db = await connectDb();
  const sql = `
    SELECT 
      COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as income,
      COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expenses,
      COUNT(*) as count,
      COALESCE(MAX(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as largest_expense
    FROM transactions
    WHERE created_at >= ? AND created_at <= ?
  `.trim();
  const rows = await db.getAllAsync<{
    income: number;
    expenses: number;
    count: number;
    largest_expense: number;
  }>(sql, [startDate, endDate]);

  const row = rows[0] || { income: 0, expenses: 0, count: 0, largest_expense: 0 };
  const income = row.income;
  const expenses = row.expenses;
  const netBalance = income - expenses;
  const savingsRate = income > 0 ? ((netBalance / income) * 100) : 0;

  // Calculate day difference for average daily spend
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  const days = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1);
  const avgDailySpend = expenses / days;

  return {
    income,
    expenses,
    netBalance,
    transactionCount: row.count,
    savingsRate: parseFloat(savingsRate.toFixed(1)),
    avgDailySpend: parseFloat(avgDailySpend.toFixed(2)),
    largestExpense: row.largest_expense,
  };
};

export const getCategoryBreakdown = async (
  startDate: string,
  endDate: string,
  type: "income" | "expense" = "expense"
): Promise<CategoryBreakdown[]> => {
  const db = await connectDb();
  const sql = `
    SELECT 
      COALESCE(t.category_id, 0) as category_id,
      COALESCE(c.name, 'Uncategorized') as name,
      COALESCE(c.icon, 'category') as icon,
      COALESCE(c.color, '#64748B') as color,
      t.type as type,
      SUM(t.amount) as total,
      COUNT(t.id) as count
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE t.created_at >= ? AND t.created_at <= ? AND t.type = ?
    GROUP BY t.category_id
    ORDER BY total DESC
  `.trim();

  const rows = await db.getAllAsync<any>(sql, [startDate, endDate, type]);
  const overallTotal = rows.reduce((acc: number, r: any) => acc + (r.total || 0), 0);

  return rows.map((r: any) => ({
    category_id: r.category_id,
    name: r.name,
    icon: r.icon,
    color: r.color,
    type: r.type,
    total: r.total,
    count: r.count,
    percentage: overallTotal > 0 ? parseFloat(((r.total / overallTotal) * 100).toFixed(1)) : 0,
  }));
};

export const getMonthlyTrends = async (year: number): Promise<TrendDataPoint[]> => {
  const db = await connectDb();
  const startYear = `${year}-01-01T00:00:00.000Z`;
  const endYear = `${year}-12-31T23:59:59.999Z`;

  const sql = `
    SELECT 
      CAST(strftime('%m', created_at) AS INTEGER) as month_num,
      COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as income,
      COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expenses
    FROM transactions
    WHERE created_at >= ? AND created_at <= ?
    GROUP BY month_num
    ORDER BY month_num ASC
  `.trim();

  const rows = await db.getAllAsync<{ month_num: number; income: number; expenses: number }>(
    sql,
    [startYear, endYear]
  );

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const trendMap = new Map(rows.map(r => [r.month_num, r]));

  return Array.from({ length: 12 }, (_, i) => {
    const mNum = i + 1;
    const item = trendMap.get(mNum) || { income: 0, expenses: 0 };
    return {
      label: monthNames[i],
      income: item.income,
      expenses: item.expenses,
      net: item.income - item.expenses,
      dateKey: `${year}-${String(mNum).padStart(2, '0')}`,
    };
  });
};

export const getWeeklyTrends = async (year: number, month: number): Promise<TrendDataPoint[]> => {
  const db = await connectDb();
  const monthStr = String(month).padStart(2, '0');
  const startMonth = `${year}-${monthStr}-01T00:00:00.000Z`;
  const lastDay = new Date(year, month, 0).getDate();
  const endMonth = `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}T23:59:59.999Z`;

  const sql = `
    SELECT 
      CASE 
        WHEN CAST(strftime('%d', created_at) AS INTEGER) <= 7 THEN 1
        WHEN CAST(strftime('%d', created_at) AS INTEGER) <= 14 THEN 2
        WHEN CAST(strftime('%d', created_at) AS INTEGER) <= 21 THEN 3
        ELSE 4 
      END as week_num,
      COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as income,
      COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expenses
    FROM transactions
    WHERE created_at >= ? AND created_at <= ?
    GROUP BY week_num
    ORDER BY week_num ASC
  `.trim();

  const rows = await db.getAllAsync<{ week_num: number; income: number; expenses: number }>(
    sql,
    [startMonth, endMonth]
  );

  const weekMap = new Map(rows.map(r => [r.week_num, r]));

  return Array.from({ length: 4 }, (_, i) => {
    const wNum = i + 1;
    const item = weekMap.get(wNum) || { income: 0, expenses: 0 };
    return {
      label: `W${wNum}`,
      income: item.income,
      expenses: item.expenses,
      net: item.income - item.expenses,
      dateKey: `${year}-${monthStr}-W${wNum}`,
    };
  });
};

// --- CATEGORIES CRUD ---

export const getCategories = async (): Promise<Category[]> => {
  const db = await connectDb();
  return db.getAllAsync<Category>(`SELECT * FROM categories ORDER BY name ASC`.trim());
};

export const addCategory = async (
  name: string,
  icon: string = "category",
  color: string = "#3B82F6"
): Promise<number> => {
  const db = await connectDb();
  const result = await db.runAsync(
    `INSERT INTO categories (name, icon, color) VALUES (?, ?, ?)`,
    [name.trim(), icon, color]
  );
  return result.lastInsertRowId;
};

export const editCategory = async (
  id: number,
  name: string,
  icon?: string,
  color?: string
): Promise<void> => {
  const db = await connectDb();
  if (icon && color) {
    await db.runAsync(
      `UPDATE categories SET name = ?, icon = ?, color = ? WHERE id = ?`,
      [name.trim(), icon, color, id]
    );
  } else {
    await db.runAsync(
      `UPDATE categories SET name = ? WHERE id = ?`,
      [name.trim(), id]
    );
  }
};

export const deleteCategory = async (
  id: number,
  fallbackCategoryId?: number | null
): Promise<void> => {
  const db = await connectDb();
  await db.withTransactionAsync(async () => {
    // Reassign transactions to fallback or NULL
    await db.runAsync(
      `UPDATE transactions SET category_id = ? WHERE category_id = ?`,
      [fallbackCategoryId || null, id]
    );
    await db.runAsync(
      `UPDATE recurring_transactions SET category_id = ? WHERE category_id = ?`,
      [fallbackCategoryId || null, id]
    );
    await db.runAsync(`DELETE FROM budgets WHERE category_id = ?`, [id]);
    await db.runAsync(`DELETE FROM categories WHERE id = ?`, [id]);
  });
};

// --- RECURRING TRANSACTIONS CRUD ---

export const getRecurringTransactions = async (): Promise<RecurringTransaction[]> => {
  const db = await connectDb();
  return db.getAllAsync<RecurringTransaction>(`
    SELECT 
      r.id, r.type, r.amount, r.category_id, r.description, r.frequency, r.day_of_month, r.start_date, r.end_date, r.is_active, r.last_processed_date, r.created_at,
      c.name as category_name, 
      c.icon as category_icon, 
      c.color as category_color 
    FROM recurring_transactions r
    LEFT JOIN categories c ON r.category_id = c.id
    ORDER BY r.created_at DESC
  `.trim());
};

export const addRecurringTransaction = async (
  data: Omit<RecurringTransaction, "id">
): Promise<number> => {
  const db = await connectDb();
  const {
    type,
    amount,
    category_id,
    description,
    frequency = "monthly",
    day_of_month = 1,
    start_date,
    end_date,
    is_active = 1,
  } = data;

  const result = await db.runAsync(
    `INSERT INTO recurring_transactions 
     (type, amount, category_id, description, frequency, day_of_month, start_date, end_date, is_active) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [type, amount, category_id || null, description?.trim() || null, frequency, day_of_month, start_date, end_date || null, is_active]
  );
  return result.lastInsertRowId;
};

export const editRecurringTransaction = async (
  data: Pick<RecurringTransaction, "id" | "type" | "amount" | "category_id" | "description" | "end_date" | "day_of_month" | "is_active">
): Promise<void> => {
  const db = await connectDb();
  const { id, type, amount, category_id, description, end_date, day_of_month, is_active } = data;

  await db.runAsync(
    `UPDATE recurring_transactions 
     SET type = ?, amount = ?, category_id = ?, description = ?, end_date = ?, day_of_month = ?, is_active = ? 
     WHERE id = ?`,
    [type, amount, category_id || null, description?.trim() || null, end_date || null, day_of_month || 1, is_active ?? 1, id]
  );
};

export const deleteRecurringTransaction = async (id: number): Promise<void> => {
  const db = await connectDb();
  await db.runAsync(`DELETE FROM recurring_transactions WHERE id = ?`, [id]);
};

export const toggleRecurringActive = async (id: number, isActive: boolean): Promise<void> => {
  const db = await connectDb();
  await db.runAsync(
    `UPDATE recurring_transactions SET is_active = ? WHERE id = ?`,
    [isActive ? 1 : 0, id]
  );
};

// --- SETTINGS MANAGEMENT ---

export const getSetting = async (key: string, defaultValue: string = ""): Promise<string> => {
  const db = await connectDb();
  const rows = await db.getAllAsync<{ value: string }>(
    `SELECT value FROM app_settings WHERE key = ?`,
    [key]
  );
  return rows[0]?.value ?? defaultValue;
};

export const setSetting = async (key: string, value: string): Promise<void> => {
  const db = await connectDb();
  await db.runAsync(
    `INSERT INTO app_settings (key, value) VALUES (?, ?) 
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value]
  );
};

export const getAppSettings = async (): Promise<AppSettings> => {
  const currency = await getSetting("currency", "EUR");
  const currencySymbol = await getSetting("currency_symbol", "€");
  const currencyPosition = (await getSetting("currency_position", "suffix")) as "prefix" | "suffix";
  const hideBalance = (await getSetting("hide_balance", "false")) === "true";
  const themeMode = (await getSetting("theme_mode", "system")) as "light" | "dark" | "system";
  const dateFormat = await getSetting("date_format", "MMM D, YYYY");

  return {
    currency,
    currencySymbol,
    currencyPosition,
    hideBalance,
    themeMode,
    dateFormat,
  };
};

// --- SEEDING & RESET ---

export const seedDatabase = async (): Promise<void> => {
  const db = await connectDb();

  await db.withTransactionAsync(async () => {
    // 1. Clear existing data
    await db.execAsync(`
      DELETE FROM transactions;
      DELETE FROM recurring_transactions;
      DELETE FROM budgets;
      DELETE FROM categories;
      DELETE FROM sqlite_sequence;
    `);

    // 2. Insert standard fintech categories
    const categoriesToInsert = [
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

    const categoryIdMap: Record<string, number> = {};
    for (const cat of categoriesToInsert) {
      const res = await db.runAsync(
        `INSERT INTO categories (name, icon, color, is_default) VALUES (?, ?, ?, 1)`,
        [cat.name, cat.icon, cat.color]
      );
      categoryIdMap[cat.name] = res.lastInsertRowId;
    }

    // 3. Generate realistic multi-year dataset (Past 36 months / 3 years)
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const transactionsToInsert: {
      type: "income" | "expense";
      amount: number;
      category_id: number;
      description: string;
      created_at: string;
    }[] = [];

    // Helper to format ISO
    const makeIso = (y: number, m: number, d: number, hr = 12, min = 0) => {
      const dt = new Date(Date.UTC(y, m, d, hr, min, 0));
      return dt.toISOString();
    };

    for (let i = 35; i >= 0; i--) {
      const targetDate = new Date(currentYear, currentMonth - i, 1);
      const y = targetDate.getFullYear();
      const m = targetDate.getMonth(); // 0-indexed
      const monthLabel = targetDate.toLocaleDateString("en-US", { month: "short", year: "numeric" });

      // Career progression salary ($3,600 in yr 1, $4,100 in yr 2, $4,500 in yr 3)
      const baseSalary = 3600 + (35 - i) * 28;
      transactionsToInsert.push({
        type: "income",
        amount: parseFloat(baseSalary.toFixed(2)),
        category_id: categoryIdMap["Salary & Wages"],
        description: `Salary • ${monthLabel}`,
        created_at: makeIso(y, m, 1, 9, 30),
      });

      // Monthly Rent
      const rentAmount = 1200 + Math.floor((35 - i) / 12) * 50;
      transactionsToInsert.push({
        type: "expense",
        amount: rentAmount,
        category_id: categoryIdMap["Housing & Rent"],
        description: `Apartment Rent • ${monthLabel}`,
        created_at: makeIso(y, m, 2, 10, 0),
      });

      // Utilities & Fiber Internet
      transactionsToInsert.push({
        type: "expense",
        amount: parseFloat((135 + Math.sin(i) * 25).toFixed(2)),
        category_id: categoryIdMap["Utilities & Internet"],
        description: `Electricity & High-Speed Fiber`,
        created_at: makeIso(y, m, 5, 14, 15),
      });

      // Cloud & Media Subscriptions
      transactionsToInsert.push({
        type: "expense",
        amount: 48.97,
        category_id: categoryIdMap["Subscriptions & Cloud"],
        description: `Apple One & Media Subscriptions`,
        created_at: makeIso(y, m, 8, 8, 0),
      });

      // Gym Membership
      transactionsToInsert.push({
        type: "expense",
        amount: 65.00,
        category_id: categoryIdMap["Health & Fitness"],
        description: `Gym & Wellness Club`,
        created_at: makeIso(y, m, 10, 11, 0),
      });

      // Bi-monthly Freelance Consulting
      if (i % 2 === 0) {
        const freelanceAmount = 650 + ((i * 73) % 600);
        transactionsToInsert.push({
          type: "income",
          amount: parseFloat(freelanceAmount.toFixed(2)),
          category_id: categoryIdMap["Freelance & Consulting"],
          description: `UI/UX Client Project Milestone`,
          created_at: makeIso(y, m, 15, 16, 45),
        });
      }

      // Quarterly Portfolio Dividends
      if (i % 3 === 0) {
        const divAmount = 180 + ((i * 47) % 250);
        transactionsToInsert.push({
          type: "income",
          amount: parseFloat(divAmount.toFixed(2)),
          category_id: categoryIdMap["Investments & Dividends"],
          description: `Quarterly Portfolio Dividends`,
          created_at: makeIso(y, m, 20, 10, 20),
        });
      }

      // 4 Weekly Groceries
      const groceryDays = [3, 10, 17, 24];
      const stores = ["Trader Joe's", "Whole Foods Market", "Local Farmers Market", "Costco Wholesale"];
      groceryDays.forEach((day, idx) => {
        const amt = 75 + ((i * 13 + idx * 29) % 70);
        transactionsToInsert.push({
          type: "expense",
          amount: parseFloat(amt.toFixed(2)),
          category_id: categoryIdMap["Groceries & Supermarket"],
          description: `${stores[idx]} Restock`,
          created_at: makeIso(y, m, day, 17, 30),
        });
      });

      // 4 Weekly Dining & Coffee
      const diningDays = [6, 13, 20, 27];
      const venues = ["Artisan Espresso & Bakery", "Italian Trattoria", "Sushi Bar & Omakase", "Weekend Brunch"];
      diningDays.forEach((day, idx) => {
        const amt = 24 + ((i * 17 + idx * 31) % 65);
        transactionsToInsert.push({
          type: "expense",
          amount: parseFloat(amt.toFixed(2)),
          category_id: categoryIdMap["Dining & Coffee"],
          description: venues[idx],
          created_at: makeIso(y, m, day, 20, 15),
        });
      });

      // Transport & Fuel
      transactionsToInsert.push({
        type: "expense",
        amount: parseFloat((75 + ((i * 19) % 45)).toFixed(2)),
        category_id: categoryIdMap["Transport & Fuel"],
        description: `Gas Station & Transit Pass`,
        created_at: makeIso(y, m, 16, 13, 0),
      });

      // Shopping & Tech (Occasional)
      if (i % 2 === 1) {
        const techAmt = 89 + ((i * 41) % 220);
        transactionsToInsert.push({
          type: "expense",
          amount: parseFloat(techAmt.toFixed(2)),
          category_id: categoryIdMap["Shopping & Tech"],
          description: `Amazon Gadgets & Electronics`,
          created_at: makeIso(y, m, 22, 15, 20),
        });
      }

      // Personal & Wellness
      if (i % 3 === 1) {
        transactionsToInsert.push({
          type: "expense",
          amount: 45.00,
          category_id: categoryIdMap["Personal & Wellness"],
          description: `Haircut & Grooming`,
          created_at: makeIso(y, m, 18, 12, 0),
        });
      }

      // Vacations in Summer (July/Aug) and Winter (Dec)
      if (m === 6 || m === 7 || m === 11) {
        const travelAmt = 450 + ((i * 89) % 650);
        transactionsToInsert.push({
          type: "expense",
          amount: parseFloat(travelAmt.toFixed(2)),
          category_id: categoryIdMap["Travel & Vacations"],
          description: m === 11 ? `Holiday Flights & Hotel` : `Summer Beach Getaway`,
          created_at: makeIso(y, m, 26, 14, 0),
        });
      }

      // Year-end Bonus in December
      if (m === 11) {
        transactionsToInsert.push({
          type: "income",
          amount: 1500.00,
          category_id: categoryIdMap["Salary & Wages"],
          description: `Annual Performance Bonus`,
          created_at: makeIso(y, m, 22, 11, 0),
        });
      }
    }

    // Batch insert transactions
    for (const tx of transactionsToInsert) {
      await db.runAsync(
        `INSERT INTO transactions (type, amount, category_id, description, created_at) VALUES (?, ?, ?, ?, ?)`,
        [tx.type, tx.amount, tx.category_id, tx.description, tx.created_at]
      );
    }

    // Insert recurring active rules
    await db.runAsync(
      `INSERT INTO recurring_transactions (type, amount, category_id, description, frequency, day_of_month, start_date, is_active)
       VALUES (?, ?, ?, ?, 'monthly', 1, ?, 1)`,
      ['income', 4500.00, categoryIdMap['Salary & Wages'], 'Monthly Salary', `${currentYear}-01-01T00:00:00.000Z`]
    );

    await db.runAsync(
      `INSERT INTO recurring_transactions (type, amount, category_id, description, frequency, day_of_month, start_date, is_active)
       VALUES (?, ?, ?, ?, 'monthly', 2, ?, 1)`,
      ['expense', 1350.00, categoryIdMap['Housing & Rent'], 'Apartment Rent', `${currentYear}-01-01T00:00:00.000Z`]
    );

    await db.runAsync(
      `INSERT INTO recurring_transactions (type, amount, category_id, description, frequency, day_of_month, start_date, is_active)
       VALUES (?, ?, ?, ?, 'monthly', 8, ?, 1)`,
      ['expense', 48.97, categoryIdMap['Subscriptions & Cloud'], 'Cloud & Media Subscriptions', `${currentYear}-01-01T00:00:00.000Z`]
    );

    await db.runAsync(
      `INSERT INTO recurring_transactions (type, amount, category_id, description, frequency, day_of_month, start_date, is_active)
       VALUES (?, ?, ?, ?, 'monthly', 10, ?, 1)`,
      ['expense', 65.00, categoryIdMap['Health & Fitness'], 'Gym Membership', `${currentYear}-01-01T00:00:00.000Z`]
    );
  });

  console.log("Database seeded successfully with 36 months of multi-year fintech data.");
};

export const resetDatabase = async (): Promise<void> => {
  const db = await connectDb();
  await db.execAsync(`
    DROP TABLE IF EXISTS transactions;
    DROP TABLE IF EXISTS recurring_transactions;
    DROP TABLE IF EXISTS budgets;
    DROP TABLE IF EXISTS categories;
    DROP TABLE IF EXISTS app_settings;
    DROP TABLE IF EXISTS schema_migrations;
    DROP TABLE IF EXISTS app_metadata;
  `);
  await initDatabase();
};