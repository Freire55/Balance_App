import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { connectDb } from './database';
import { Category, DatabaseBackup, FinanceEvent, RecurringTransaction, Transaction } from './types';

/**
 * High-performance streaming CSV export for transactions.
 * Formats all transactions into RFC 4180 standard CSV.
 */
export async function exportTransactionsToCsv(): Promise<{ success: boolean; uri?: string; message?: string }> {
  try {
    const db = await connectDb();

    // Fetch all transactions with joined category name
    const rows = await db.getAllAsync<{
      id: number;
      date: string;
      type: string;
      category: string;
      amount: number;
      description: string | null;
      tags: string | null;
      is_recurring: number;
    }>(`
      SELECT 
        t.id,
        t.created_at as date,
        t.type,
        COALESCE(c.name, 'Uncategorized') as category,
        t.amount,
        t.description,
        t.tags,
        CASE WHEN t.recurring_rule_id IS NOT NULL THEN 1 ELSE 0 END as is_recurring
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      ORDER BY t.created_at DESC
    `.trim());

    if (rows.length === 0) {
      return { success: false, message: 'No transactions found to export.' };
    }

    // Build RFC 4180 CSV
    const escapeCsv = (str: string | null | undefined): string => {
      if (!str) return '""';
      const clean = String(str).replace(/"/g, '""');
      return `"${clean}"`;
    };

    const header = ['ID', 'Date', 'Type', 'Category', 'Amount', 'Description', 'Tags', 'Recurring'].join(',');
    const lines = rows.map((r) => [
      r.id,
      escapeCsv(r.date),
      escapeCsv(r.type),
      escapeCsv(r.category),
      r.amount.toFixed(2),
      escapeCsv(r.description || ''),
      escapeCsv(r.tags || ''),
      r.is_recurring ? 'Yes' : 'No',
    ].join(','));

    const csvContent = [header, ...lines].join('\r\n');
    const fileName = `budget_transactions_${new Date().toISOString().slice(0, 10)}.csv`;

    const file = new File(Paths.cache, fileName);
    if (file.exists) {
      file.delete();
    }
    file.create();
    file.write(csvContent);

    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(file.uri, {
        mimeType: 'text/csv',
        dialogTitle: 'Export Transactions CSV',
        UTI: 'public.comma-separated-values-text',
      });
      return { success: true, uri: file.uri };
    } else {
      return { success: true, uri: file.uri, message: `Saved to ${file.uri}` };
    }
  } catch (error: any) {
    console.error('Error exporting CSV:', error);
    return { success: false, message: error?.message || 'Failed to export CSV' };
  }
}

/**
 * Generate a complete JSON backup of the user database.
 */
export async function createFullBackupJson(): Promise<string> {
  const db = await connectDb();

  const categories = await db.getAllAsync<Category>(`SELECT * FROM categories ORDER BY id ASC`.trim());
  const transactions = await db.getAllAsync<Transaction>(`SELECT * FROM transactions ORDER BY id ASC`.trim());
  const recurring = await db.getAllAsync<RecurringTransaction>(`SELECT * FROM recurring_transactions ORDER BY id ASC`.trim());
  const budgets = await db.getAllAsync<any>(`SELECT * FROM budgets ORDER BY id ASC`.trim());
  const savingsGoals = await db.getAllAsync<any>(`SELECT * FROM savings_goals ORDER BY id ASC`.trim());
  const quickShortcuts = await db.getAllAsync<any>(`SELECT * FROM quick_shortcuts ORDER BY id ASC`.trim());
  const financeEvents = await db.getAllAsync<FinanceEvent>(`SELECT * FROM finance_events ORDER BY id ASC`.trim());
  const settingsRows = await db.getAllAsync<{ key: string; value: string }>(`SELECT * FROM app_settings`.trim());

  const settings: Record<string, string> = {};
  for (const s of settingsRows) {
    settings[s.key] = s.value;
  }

  const backup: DatabaseBackup = {
    version: 3,
    exportedAt: new Date().toISOString(),
    categories,
    transactions,
    recurringTransactions: recurring,
    budgets,
    savingsGoals,
    quickShortcuts,
    financeEvents,
    settings,
  };

  return JSON.stringify(backup, null, 2);
}

/**
 * Share complete JSON backup file.
 */
export async function exportBackupFile(): Promise<{ success: boolean; message?: string }> {
  try {
    const json = await createFullBackupJson();
    const fileName = `budget_backup_${new Date().toISOString().slice(0, 10)}.json`;
    const file = new File(Paths.cache, fileName);
    if (file.exists) {
      file.delete();
    }
    file.create();
    file.write(json);

    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(file.uri, {
        mimeType: 'application/json',
        dialogTitle: 'Backup Financial Data',
        UTI: 'public.json',
      });
      return { success: true };
    } else {
      return { success: true, message: `File saved to ${file.uri}` };
    }
  } catch (error: any) {
    console.error('Error exporting backup:', error);
    return { success: false, message: error?.message || 'Failed to export backup' };
  }
}

/**
 * Restore data from JSON backup string.
 */
export async function restoreFromBackupJson(jsonString: string): Promise<{ success: boolean; message?: string }> {
  try {
    const data: DatabaseBackup = JSON.parse(jsonString);
    if (!data || !Array.isArray(data.categories) || !Array.isArray(data.transactions)) {
      return { success: false, message: 'Invalid backup file format.' };
    }

    const db = await connectDb();

    await db.withTransactionAsync(async () => {
      // Clear existing records
      await db.execAsync(`
        DELETE FROM transactions;
        DELETE FROM recurring_transactions;
        DELETE FROM budgets;
        DELETE FROM savings_goals;
        DELETE FROM quick_shortcuts;
        DELETE FROM finance_events;
        DELETE FROM categories;
        DELETE FROM sqlite_sequence;
      `);

      // Restore categories
      for (const cat of data.categories) {
        await db.runAsync(
          `INSERT INTO categories (id, name, icon, color, is_default, created_at) VALUES (?, ?, ?, ?, ?, ?)`.trim(),
          [cat.id, cat.name, cat.icon || 'category', cat.color || '#3B82F6', cat.is_default || 0, cat.created_at || new Date().toISOString()]
        );
      }

      // Restore finance events (events / trips) before transactions for FK consistency
      if (Array.isArray(data.financeEvents)) {
        for (const evt of data.financeEvents) {
          await db.runAsync(
            `INSERT INTO finance_events (id, name, description, icon, color, budget, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`.trim(),
            [evt.id, evt.name, evt.description || null, evt.icon || 'flight', evt.color || '#F43F5E', evt.budget || 0, evt.created_at || new Date().toISOString()]
          );
        }
      }

      // Restore transactions
      for (const tx of data.transactions) {
        await db.runAsync(
          `INSERT INTO transactions (id, type, amount, category_id, description, tags, created_at, recurring_rule_id, event_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`.trim(),
          [tx.id, tx.type, tx.amount, tx.category_id || null, tx.description || null, tx.tags || null, tx.created_at, tx.recurring_rule_id || null, tx.event_id || null]
        );
      }

      // Restore recurring transactions
      if (Array.isArray(data.recurringTransactions)) {
        for (const rec of data.recurringTransactions) {
          await db.runAsync(
            `INSERT INTO recurring_transactions (id, type, amount, category_id, description, frequency, day_of_month, start_date, end_date, is_active, last_processed_date)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`.trim(),
            [rec.id, rec.type, rec.amount, rec.category_id, rec.description || null, rec.frequency || 'monthly', rec.day_of_month || 1, rec.start_date, rec.end_date || null, rec.is_active ?? 1, rec.last_processed_date || null]
          );
        }
      }

      // Restore budgets
      if (Array.isArray(data.budgets)) {
        for (const b of data.budgets) {
          await db.runAsync(
            `INSERT INTO budgets (id, category_id, monthly_limit, created_at) VALUES (?, ?, ?, ?)`.trim(),
            [b.id, b.category_id, b.monthly_limit, b.created_at || new Date().toISOString()]
          );
        }
      }

      // Restore savings goals
      if (Array.isArray(data.savingsGoals)) {
        for (const g of data.savingsGoals) {
          await db.runAsync(
            `INSERT INTO savings_goals (id, name, target_amount, current_amount, target_date, icon, color, is_completed, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`.trim(),
            [g.id, g.name, g.target_amount, g.current_amount, g.target_date || null, g.icon || 'savings', g.color || '#10B981', g.is_completed ?? 0, g.created_at || new Date().toISOString()]
          );
        }
      }

      // Restore quick shortcuts
      if (Array.isArray(data.quickShortcuts)) {
        for (const qs of data.quickShortcuts) {
          await db.runAsync(
            `INSERT INTO quick_shortcuts (id, title, icon, amount, category_id, type) VALUES (?, ?, ?, ?, ?, ?)`.trim(),
            [qs.id, qs.title, qs.icon, qs.amount, qs.category_id, qs.type || 'expense']
          );
        }
      }

      // Restore settings
      if (data.settings) {
        for (const [key, value] of Object.entries(data.settings)) {
          await db.runAsync(
            `INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)`.trim(),
            [key, value]
          );
        }
      }
    });

    return { success: true };
  } catch (error: any) {
    console.error('Error restoring backup:', error);
    return { success: false, message: error?.message || 'Failed to restore database from backup.' };
  }
}

/**
 * Vacuum and optimize SQLite database for 10+ year longevity.
 */
export async function optimizeDatabase(): Promise<void> {
  const db = await connectDb();
  await db.execAsync(`
    PRAGMA optimize;
    VACUUM;
    PRAGMA wal_checkpoint(TRUNCATE);
  `);
}
