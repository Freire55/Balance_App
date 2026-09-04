import { notifyRecurringProcessed } from '../services/notifications';
import { connectDb } from './database';
import { RecurringTransaction } from './types';

/**
 * Calculate next occurrence date for a recurring rule.
 */
export function getNextOccurrenceDate(rule: RecurringTransaction): Date | null {
  const now = new Date();
  const startDate = new Date(rule.start_date);
  const endDate = rule.end_date ? new Date(rule.end_date) : null;
  const frequency = rule.frequency || 'monthly';
  const targetDay = rule.day_of_month || 1;

  if (endDate && endDate < now) return null;

  let candidate: Date;

  if (frequency === 'weekly') {
    const dayOfWeek = startDate.getDay();
    candidate = new Date(now);
    const diff = (dayOfWeek - candidate.getDay() + 7) % 7;
    candidate.setDate(candidate.getDate() + (diff === 0 ? 7 : diff));
    candidate.setHours(12, 0, 0, 0);
  } else if (frequency === 'biweekly') {
    candidate = new Date(startDate);
    while (candidate <= now) {
      candidate.setDate(candidate.getDate() + 14);
    }
  } else if (frequency === 'yearly') {
    candidate = new Date(now.getFullYear(), startDate.getMonth(), startDate.getDate(), 12, 0, 0);
    if (candidate <= now) {
      candidate.setFullYear(candidate.getFullYear() + 1);
    }
  } else {
    // monthly
    candidate = new Date(now.getFullYear(), now.getMonth(), targetDay, 12, 0, 0);
    if (candidate <= now) {
      candidate = new Date(now.getFullYear(), now.getMonth() + 1, targetDay, 12, 0, 0);
    }
  }

  if (endDate && candidate > endDate) return null;
  return candidate;
}

/**
 * Deterministically process recurring transactions up to current date.
 * Supports weekly, bi-weekly, monthly, and yearly frequencies.
 * Dispatches notifications when transactions are executed.
 */
export async function processRecurringTransactions(): Promise<number> {
  const db = await connectDb();
  let generatedCount = 0;
  const processedDescriptions: string[] = [];

  try {
    const now = new Date();
    const rules = await db.getAllAsync<RecurringTransaction>(`
      SELECT * FROM recurring_transactions 
      WHERE is_active = 1 
      ORDER BY id ASC
    `.trim());

    if (rules.length === 0) return 0;

    await db.withTransactionAsync(async () => {
      for (const rule of rules) {
        const startDate = new Date(rule.start_date);
        const endDate = rule.end_date ? new Date(rule.end_date) : null;
        const frequency = rule.frequency || 'monthly';
        const targetDay = rule.day_of_month || 1;

        if (frequency === 'weekly' || frequency === 'biweekly') {
          const stepDays = frequency === 'weekly' ? 7 : 14;
          let iter = new Date(startDate);

          while (iter <= now) {
            const isAfterStart = iter >= startDate;
            const isBeforeEnd = !endDate || iter <= endDate;

            if (isAfterStart && isBeforeEnd) {
              const dayPrefix = iter.toISOString().slice(0, 10);
              const existing = await db.getAllAsync<{ id: number }>(`
                SELECT id FROM transactions 
                WHERE recurring_rule_id = ? 
                  AND created_at LIKE ?
              `.trim(), [rule.id, `${dayPrefix}%`]);

              if (existing.length === 0) {
                const desc = rule.description 
                  ? `${rule.description} (Recurring)` 
                  : 'Recurring Transaction';

                await db.runAsync(`
                  INSERT INTO transactions (type, amount, category_id, description, created_at, recurring_rule_id)
                  VALUES (?, ?, ?, ?, ?, ?)
                `.trim(), [rule.type, rule.amount, rule.category_id, desc, iter.toISOString(), rule.id]);

                generatedCount++;
                processedDescriptions.push(rule.description || 'Recurring Payment');
              }
            }
            iter.setDate(iter.getDate() + stepDays);
          }
        } else if (frequency === 'yearly') {
          let y = startDate.getFullYear();
          const targetY = now.getFullYear();

          while (y <= targetY) {
            const txDate = new Date(Date.UTC(y, startDate.getMonth(), startDate.getDate(), 12, 0, 0));
            const isAfterStart = txDate >= startDate;
            const isBeforeEnd = !endDate || txDate <= endDate;
            const isNotFuture = txDate <= now;

            if (isAfterStart && isBeforeEnd && isNotFuture) {
              const yearPrefix = String(y);
              const existing = await db.getAllAsync<{ id: number }>(`
                SELECT id FROM transactions 
                WHERE recurring_rule_id = ? 
                  AND created_at LIKE ?
              `.trim(), [rule.id, `${yearPrefix}%`]);

              if (existing.length === 0) {
                const desc = rule.description 
                  ? `${rule.description} (Recurring)` 
                  : 'Recurring Transaction';

                await db.runAsync(`
                  INSERT INTO transactions (type, amount, category_id, description, created_at, recurring_rule_id)
                  VALUES (?, ?, ?, ?, ?, ?)
                `.trim(), [rule.type, rule.amount, rule.category_id, desc, txDate.toISOString(), rule.id]);

                generatedCount++;
                processedDescriptions.push(rule.description || 'Recurring Payment');
              }
            }
            y++;
          }
        } else {
          // monthly
          let iterDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
          const maxDate = new Date(now.getFullYear(), now.getMonth(), 1);

          while (iterDate <= maxDate) {
            const iterYear = iterDate.getFullYear();
            const iterMonth = iterDate.getMonth();
            const daysInMonth = new Date(iterYear, iterMonth + 1, 0).getDate();
            const actualDay = Math.min(targetDay, daysInMonth);
            const txDate = new Date(Date.UTC(iterYear, iterMonth, actualDay, 12, 0, 0));

            const isAfterStart = txDate >= startDate;
            const isBeforeEnd = !endDate || txDate <= endDate;
            const isNotFuture = txDate <= now;

            if (isAfterStart && isBeforeEnd && isNotFuture) {
              const datePrefix = `${iterYear}-${String(iterMonth + 1).padStart(2, '0')}`;
              const existing = await db.getAllAsync<{ id: number }>(`
                SELECT id FROM transactions 
                WHERE recurring_rule_id = ? 
                  AND created_at LIKE ?
              `.trim(), [rule.id, `${datePrefix}%`]);

              if (existing.length === 0) {
                const desc = rule.description 
                  ? `${rule.description} (Recurring)` 
                  : 'Recurring Transaction';

                await db.runAsync(`
                  INSERT INTO transactions (type, amount, category_id, description, created_at, recurring_rule_id)
                  VALUES (?, ?, ?, ?, ?, ?)
                `.trim(), [rule.type, rule.amount, rule.category_id, desc, txDate.toISOString(), rule.id]);

                generatedCount++;
                processedDescriptions.push(rule.description || 'Recurring Payment');
              }
            }
            iterDate.setMonth(iterDate.getMonth() + 1);
          }
        }

        await db.runAsync(`
          UPDATE recurring_transactions 
          SET last_processed_date = ? 
          WHERE id = ?
        `.trim(), [now.toISOString(), rule.id]);
      }
    });

    if (generatedCount > 0) {
      await notifyRecurringProcessed(generatedCount, processedDescriptions);
    }

    return generatedCount;
  } catch (error) {
    console.error('[RecurringEngine] Error processing recurring transactions:', error);
    return 0;
  }
}
