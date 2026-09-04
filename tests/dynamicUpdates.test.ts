import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { setupTestDatabase } from './testHelper';
import {
  addTransaction,
  editTransaction,
  deleteTransaction,
  getCategories,
  setCategoryBudget,
  getBudgets,
  getPeriodSummary,
  getCategoryBreakdown,
  getFinanceEvents,
  addFinanceEvent,
  getMonthlyDailyExpenses,
  getFilteredTransactions,
  executeSql,
  initDatabase,
} from '../src/database/database';

describe('Global App Dynamism & Integrity Audit', () => {
  let catGroceries: number;
  let catSalary: number;
  let eventTrip: number;

  beforeEach(async () => {
    await setupTestDatabase();
    const cats = await getCategories();
    catGroceries = cats.find((c) => c.name === 'Groceries & Supermarket')!.id;
    catSalary = cats.find((c) => c.name === 'Salary & Wages')!.id;
    eventTrip = await addFinanceEvent('Vacation 2026', 'Summer holiday', 'flight', '#F43F5E', 2000);
    await setCategoryBudget(catGroceries, 500.0);
  });

  test('DYNAMIC PIPELINE: adding a transaction immediately updates summary, breakdown, budget, event, and calendar', async () => {
    // 1. Initial State Check (Empty)
    const summaryBefore = await getPeriodSummary('2026-06-01T00:00:00.000Z', '2026-06-30T23:59:59.999Z');
    assert.strictEqual(summaryBefore.expenses, 0);

    const budgetsBefore = await getBudgets(2026, 6);
    const groceryBudgetBefore = budgetsBefore.find((b) => b.category_id === catGroceries);
    assert.strictEqual(groceryBudgetBefore?.spent_amount, 0);
    assert.strictEqual(groceryBudgetBefore?.percentage_used, 0);

    const eventsBefore = await getFinanceEvents();
    const tripBefore = eventsBefore.find((e) => e.id === eventTrip);
    assert.strictEqual(tripBefore?.total_spent, 0);

    const calendarBefore = await getMonthlyDailyExpenses(2026, 6);
    assert.strictEqual(calendarBefore.length, 0);

    // 2. ACTION: User logs a $180 grocery transaction on June 15 tagged with Vacation 2026
    const txId = await addTransaction({
      type: 'expense',
      amount: 180.0,
      category_id: catGroceries,
      event_id: eventTrip,
      description: 'Supermarket for vacation cabin',
      created_at: '2026-06-15T14:00:00.000Z',
    });
    assert.ok(txId > 0);

    // 3. DYNAMIC VERIFICATION: Summary immediately reflects the new transaction
    const summaryAfter = await getPeriodSummary('2026-06-01T00:00:00.000Z', '2026-06-30T23:59:59.999Z');
    assert.strictEqual(summaryAfter.expenses, 180.0);
    assert.strictEqual(summaryAfter.netBalance, -180.0);
    assert.strictEqual(summaryAfter.transactionCount, 1);

    // 4. DYNAMIC VERIFICATION: Category breakdown immediately reflects the new transaction
    const breakdownAfter = await getCategoryBreakdown('2026-06-01T00:00:00.000Z', '2026-06-30T23:59:59.999Z', 'expense');
    assert.strictEqual(breakdownAfter.length, 1);
    assert.strictEqual(breakdownAfter[0].category_id, catGroceries);
    assert.strictEqual(breakdownAfter[0].total, 180.0);

    // 5. DYNAMIC VERIFICATION: Budget progress bar immediately reflects the new transaction
    const budgetsAfter = await getBudgets(2026, 6);
    const groceryBudgetAfter = budgetsAfter.find((b) => b.category_id === catGroceries);
    assert.strictEqual(groceryBudgetAfter?.spent_amount, 180.0);
    assert.strictEqual(groceryBudgetAfter?.remaining_amount, 320.0);
    // (180 / 500) * 100 = 36.0%
    assert.strictEqual(groceryBudgetAfter?.percentage_used, 36.0);

    // 6. DYNAMIC VERIFICATION: Trip progress bar immediately reflects the new transaction
    const eventsAfter = await getFinanceEvents();
    const tripAfter = eventsAfter.find((e) => e.id === eventTrip);
    assert.strictEqual(tripAfter?.total_spent, 180.0);
    assert.strictEqual(tripAfter?.transaction_count, 1);

    // 7. DYNAMIC VERIFICATION: Calendar view immediately reflects June 15 spend
    const calendarAfter = await getMonthlyDailyExpenses(2026, 6);
    const day15 = calendarAfter.find((d) => d.day === 15);
    assert.ok(day15);
    assert.strictEqual(day15?.amount, 180.0);
    assert.strictEqual(day15?.count, 1);

    // 8. DYNAMIC VERIFICATION: Transaction ledger immediately reflects the new transaction
    const recent = await getFilteredTransactions({ limit: 5 });
    assert.strictEqual(recent.transactions[0].id, txId);
    assert.strictEqual(recent.transactions[0].amount, 180.0);
  });

  test('DYNAMIC PIPELINE: editing a transaction cascades through all aggregates', async () => {
    const txId = await addTransaction({
      type: 'expense',
      amount: 100.0,
      category_id: catGroceries,
      created_at: '2026-06-10T12:00:00.000Z',
    });

    // Verify initial budget spent = $100
    let budgets = await getBudgets(2026, 6);
    let groceryBudget = budgets.find((b) => b.category_id === catGroceries);
    assert.strictEqual(groceryBudget?.spent_amount, 100.0);

    // Edit transaction: increase amount to $250
    await editTransaction({
      id: txId,
      type: 'expense',
      amount: 250.0,
      category_id: catGroceries,
      created_at: '2026-06-10T12:00:00.000Z',
    });

    // Budget spent dynamically updates to $250
    budgets = await getBudgets(2026, 6);
    groceryBudget = budgets.find((b) => b.category_id === catGroceries);
    assert.strictEqual(groceryBudget?.spent_amount, 250.0);
    assert.strictEqual(groceryBudget?.percentage_used, 50.0);

    // Summary dynamically updates to $250
    const summary = await getPeriodSummary('2026-06-01T00:00:00.000Z', '2026-06-30T23:59:59.999Z');
    assert.strictEqual(summary.expenses, 250.0);
  });

  test('DYNAMIC PIPELINE: deleting a transaction cascades and restores budget remaining amount', async () => {
    const txId = await addTransaction({
      type: 'expense',
      amount: 300.0,
      category_id: catGroceries,
      created_at: '2026-06-20T12:00:00.000Z',
    });

    // Delete transaction
    await deleteTransaction(txId);

    // Budget spent drops back to 0
    const budgets = await getBudgets(2026, 6);
    const groceryBudget = budgets.find((b) => b.category_id === catGroceries);
    assert.strictEqual(groceryBudget?.spent_amount, 0);
    assert.strictEqual(groceryBudget?.remaining_amount, 500.0);
    assert.strictEqual(groceryBudget?.percentage_used, 0);

    // Summary expenses drop back to 0
    const summary = await getPeriodSummary('2026-06-01T00:00:00.000Z', '2026-06-30T23:59:59.999Z');
    assert.strictEqual(summary.expenses, 0);
  });

  test('INTEGRITY AUDIT: future-dated transactions are NEVER lost or deleted on database init', async () => {
    // User logs an expense dated 14 days in the future
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 14);
    const futureIso = futureDate.toISOString();

    const futureTxId = await addTransaction({
      type: 'expense',
      amount: 75.0,
      category_id: catGroceries,
      description: 'Scheduled Future Grocery Delivery',
      created_at: futureIso,
    });

    // Simulate app restart / re-running migrations & schema checks
    await initDatabase();

    // Verify the future transaction is 100% intact and NEVER lost
    const txs = await getFilteredTransactions({ limit: 50 });
    const found = txs.transactions.find((t) => t.id === futureTxId);
    assert.ok(found, 'Future transaction must be preserved and NOT deleted');
    assert.strictEqual(found?.amount, 75.0);
    assert.strictEqual(found?.created_at, futureIso);
  });

  test('OPTIMIZATION AUDIT: all covering indexes are present in sqlite_master', async () => {
    const rows = await executeSql<{ name: string; tbl_name: string }[]>(
      `SELECT name, tbl_name FROM sqlite_master WHERE type = 'index'`
    );
    const indexNames = rows.map((r) => r.name);

    // Check critical performance indexes
    assert.ok(indexNames.includes('idx_tx_created_id_desc'), 'Should have idx_tx_created_id_desc');
    assert.ok(indexNames.includes('idx_tx_cover_budget'), 'Should have idx_tx_cover_budget');
    assert.ok(indexNames.includes('idx_tx_cover_event'), 'Should have idx_tx_cover_event');
    assert.ok(indexNames.includes('idx_tx_cover_summary'), 'Should have idx_tx_cover_summary');
    assert.ok(indexNames.includes('idx_tx_rec_date'), 'Should have idx_tx_rec_date');
    assert.ok(indexNames.includes('idx_rec_cat'), 'Should have idx_rec_cat');
    assert.ok(indexNames.includes('idx_qs_cat'), 'Should have idx_qs_cat');
    assert.ok(indexNames.includes('idx_events_active'), 'Should have idx_events_active');
  });
});
