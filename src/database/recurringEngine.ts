import { connectDb } from './database';
import { RecurringTransaction } from './types';

/**
 * Deterministically process recurring transactions up to current date.
 * Guarantees zero duplicate entries and safe atomic transactions.
 */
export async function processRecurringTransactions(): Promise<number> {
  const db = await connectDb();
  let generatedCount = 0;

  try {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed

    // Fetch all active recurring transactions
    const rules = await db.getAllAsync<RecurringTransaction>(`
      SELECT * FROM recurring_transactions 
      WHERE is_active = 1 
      ORDER BY id ASC
    `.trim());

    if (rules.length === 0) {
      return 0;
    }

    await db.withTransactionAsync(async () => {
      for (const rule of rules) {
        const startDate = new Date(rule.start_date);
        const endDate = rule.end_date ? new Date(rule.end_date) : null;
        const targetDay = rule.day_of_month || 1;

        // Iterate through all months from rule's start month up to current month
        let iterDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
        const maxDate = new Date(currentYear, currentMonth, 1);

        while (iterDate <= maxDate) {
          const iterYear = iterDate.getFullYear();
          const iterMonth = iterDate.getMonth();

          // Construct the actual transaction date for this month
          // Handle month length (e.g. Feb 30 -> Feb 28)
          const daysInMonth = new Date(iterYear, iterMonth + 1, 0).getDate();
          const actualDay = Math.min(targetDay, daysInMonth);
          const txDate = new Date(iterYear, iterMonth, actualDay, 12, 0, 0);

          // Check if txDate is within the valid active range [startDate, endDate]
          const isAfterStart = txDate >= startDate;
          const isBeforeEnd = !endDate || txDate <= endDate;
          const isNotFuture = txDate <= now;

          if (isAfterStart && isBeforeEnd && isNotFuture) {
            const isoDate = txDate.toISOString();
            const datePrefix = `${iterYear}-${String(iterMonth + 1).padStart(2, '0')}`;

            // Check if this specific recurring rule already generated a transaction for this month
            const existing = await db.getAllAsync<{ id: number }>(`
              SELECT id FROM transactions 
              WHERE recurring_rule_id = ? 
                AND created_at LIKE ?
            `.trim(), [rule.id, `${datePrefix}%`]);

            if (existing.length === 0) {
              const description = rule.description 
                ? `${rule.description} (Recurring)` 
                : 'Recurring Transaction';

              await db.runAsync(`
                INSERT INTO transactions (type, amount, category_id, description, created_at, recurring_rule_id)
                VALUES (?, ?, ?, ?, ?, ?)
              `.trim(), [rule.type, rule.amount, rule.category_id, description, isoDate, rule.id]);

              generatedCount++;
            }
          }

          // Move to next month
          iterDate.setMonth(iterDate.getMonth() + 1);
        }

        // Update rule's last_processed_date
        await db.runAsync(`
          UPDATE recurring_transactions 
          SET last_processed_date = ? 
          WHERE id = ?
        `.trim(), [now.toISOString(), rule.id]);
      }
    });

    console.log(`[RecurringEngine] Processed ${rules.length} rules, generated ${generatedCount} transactions.`);
    return generatedCount;
  } catch (error) {
    console.error('[RecurringEngine] Error processing recurring transactions:', error);
    return 0;
  }
}
