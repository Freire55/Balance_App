import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { setupTestDatabase } from './testHelper';
import {
  addRecurringTransaction,
  editRecurringTransaction,
  deleteRecurringTransaction,
  toggleRecurringActive,
  getRecurringTransactions,
  getCategories,
  getFilteredTransactions,
} from '../src/database/database';
import {
  getNextOccurrenceDate,
  processRecurringTransactions,
} from '../src/database/recurringEngine';

describe('Recurring Engine & Autonomous Billing Execution', () => {
  let categoryId: number;

  beforeEach(async () => {
    await setupTestDatabase();
    const cats = await getCategories();
    categoryId = cats[0].id;
  });

  test('can add and toggle recurring transactions', async () => {
    const id = await addRecurringTransaction({
      type: 'expense',
      amount: 14.99,
      category_id: categoryId,
      description: 'Netflix 4K Subscription',
      frequency: 'monthly',
      day_of_month: 15,
      start_date: '2026-01-01T00:00:00.000Z',
      is_active: 1,
    });

    assert.ok(id > 0);
    let rules = await getRecurringTransactions();
    let rule = rules.find((r) => r.id === id);
    assert.strictEqual(rule?.is_active, 1);

    // Toggle off
    await toggleRecurringActive(id, false);
    rules = await getRecurringTransactions();
    rule = rules.find((r) => r.id === id);
    assert.strictEqual(rule?.is_active, 0);

    // Toggle on
    await toggleRecurringActive(id, true);
    rules = await getRecurringTransactions();
    rule = rules.find((r) => r.id === id);
    assert.strictEqual(rule?.is_active, 1);
  });

  test('getNextOccurrenceDate calculates correct future dates for frequencies', () => {
    // 1. Monthly
    const nextMonthly = getNextOccurrenceDate({
      id: 1,
      type: 'expense',
      amount: 50,
      category_id: 1,
      start_date: '2025-01-01T00:00:00.000Z',
      frequency: 'monthly',
      day_of_month: 15,
      is_active: 1,
    });
    assert.ok(nextMonthly instanceof Date);
    assert.strictEqual(nextMonthly.getDate(), 15);

    // 2. Weekly
    const nextWeekly = getNextOccurrenceDate({
      id: 2,
      type: 'expense',
      amount: 50,
      category_id: 1,
      start_date: '2025-01-01T00:00:00.000Z',
      frequency: 'weekly',
      day_of_month: 1,
      is_active: 1,
    });
    assert.ok(nextWeekly instanceof Date);
    assert.ok(nextWeekly > new Date());

    // 3. Expired rule returns null
    const expired = getNextOccurrenceDate({
      id: 3,
      type: 'expense',
      amount: 50,
      category_id: 1,
      start_date: '2024-01-01T00:00:00.000Z',
      end_date: '2024-12-31T23:59:59.000Z',
      frequency: 'monthly',
      day_of_month: 1,
      is_active: 1,
    });
    assert.strictEqual(expired, null);
  });

  test('processRecurringTransactions generates transactions deterministically and idempotently', async () => {
    // Setup past recurring rule from 2 months ago
    const pastDate = new Date();
    pastDate.setMonth(pastDate.getMonth() - 2);
    pastDate.setDate(1);

    const ruleId = await addRecurringTransaction({
      type: 'expense',
      amount: 35.0,
      category_id: categoryId,
      description: 'Fiber Internet',
      frequency: 'monthly',
      day_of_month: 1,
      start_date: pastDate.toISOString(),
      is_active: 1,
    });

    // Initial run: should generate transactions for the past 2-3 months
    const count1 = await processRecurringTransactions();
    assert.ok(count1 >= 2, `Should generate at least 2 monthly payments (generated: ${count1})`);

    const txsAfterRun1 = await getFilteredTransactions({ limit: 100 });
    const generated = txsAfterRun1.transactions.filter((t) => t.recurring_rule_id === ruleId);
    assert.strictEqual(generated.length, count1);
    assert.ok(generated.every((t) => t.amount === 35.0));
    assert.ok(generated.every((t) => t.description?.includes('Fiber Internet')));

    // SECOND RUN (Idempotency test): should generate ZERO duplicate transactions!
    const count2 = await processRecurringTransactions();
    assert.strictEqual(count2, 0, 'Second run must generate 0 duplicate transactions');

    const txsAfterRun2 = await getFilteredTransactions({ limit: 100 });
    const generatedAfterRun2 = txsAfterRun2.transactions.filter((t) => t.recurring_rule_id === ruleId);
    assert.strictEqual(generatedAfterRun2.length, count1, 'Transaction count must remain strictly identical');
  });

  test('deleteRecurringTransaction deletes rule while preserving generated transactions', async () => {
    const pastDate = new Date();
    pastDate.setMonth(pastDate.getMonth() - 1);

    const ruleId = await addRecurringTransaction({
      type: 'expense',
      amount: 99.0,
      category_id: categoryId,
      description: 'Annual Software License',
      frequency: 'monthly',
      day_of_month: 1,
      start_date: pastDate.toISOString(),
      is_active: 1,
    });

    await processRecurringTransactions();

    const txsBefore = await getFilteredTransactions({ limit: 50 });
    const generatedTxs = txsBefore.transactions.filter((t) => t.recurring_rule_id === ruleId);
    assert.ok(generatedTxs.length > 0);

    // Delete rule
    await deleteRecurringTransaction(ruleId);

    // Verify rule deleted
    const rules = await getRecurringTransactions();
    assert.ok(!rules.some((r) => r.id === ruleId));

    // Verify transactions preserved
    const txsAfter = await getFilteredTransactions({ limit: 50 });
    const preservedTxs = txsAfter.transactions.filter((t) => t.recurring_rule_id === ruleId);
    assert.strictEqual(preservedTxs.length, generatedTxs.length, 'Generated transactions must be kept intact');
  });
});
