import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { setupTestDatabase } from './testHelper';
import {
  addTransaction,
  getCategories,
  addFinanceEvent,
  getPeriodSummary,
  getCategoryBreakdown,
  getEventAwareBreakdown,
  getMonthlyTrends,
  getWeeklyTrends,
  getMonthlyDailyExpenses,
} from '../src/database/database';

describe('Financial Analytics, Aggregations & Trends', () => {
  let catSalary: number;
  let catGroceries: number;
  let catDining: number;
  let eventTrip: number;

  beforeEach(async () => {
    await setupTestDatabase();
    const cats = await getCategories();
    catSalary = cats.find((c) => c.name === 'Salary & Wages')!.id;
    catGroceries = cats.find((c) => c.name === 'Groceries & Supermarket')!.id;
    catDining = cats.find((c) => c.name === 'Dining & Coffee')!.id;
    eventTrip = await addFinanceEvent('Rome Holiday', 'Vacation in Rome', 'flight', '#F43F5E', 1000);
  });

  test('getPeriodSummary computes correct totals, savings rate and daily spend', async () => {
    // 1. Income: $5,000
    await addTransaction({
      type: 'income',
      amount: 5000.0,
      category_id: catSalary,
      created_at: '2026-03-01T09:00:00.000Z',
    });

    // 2. Expenses: $200 + $300 + $500 = $1,000
    await addTransaction({
      type: 'expense',
      amount: 200.0,
      category_id: catGroceries,
      created_at: '2026-03-05T12:00:00.000Z',
    });
    await addTransaction({
      type: 'expense',
      amount: 300.0,
      category_id: catDining,
      created_at: '2026-03-10T19:00:00.000Z',
    });
    await addTransaction({
      type: 'expense',
      amount: 500.0,
      category_id: catGroceries,
      created_at: '2026-03-15T15:00:00.000Z',
    });

    const summary = await getPeriodSummary(
      '2026-03-01T00:00:00.000Z',
      '2026-03-31T23:59:59.999Z'
    );

    assert.strictEqual(summary.income, 5000.0);
    assert.strictEqual(summary.expenses, 1000.0);
    assert.strictEqual(summary.netBalance, 4000.0);
    assert.strictEqual(summary.transactionCount, 4);
    // Savings rate: (4000 / 5000) * 100 = 80.0%
    assert.strictEqual(summary.savingsRate, 80.0);
    assert.strictEqual(summary.largestExpense, 500.0);
    assert.ok((summary.avgDailySpend ?? 0) > 0);
  });

  test('getCategoryBreakdown calculates percentages accurately', async () => {
    await addTransaction({
      type: 'expense',
      amount: 700.0,
      category_id: catGroceries,
      created_at: '2026-03-05T12:00:00.000Z',
    });
    await addTransaction({
      type: 'expense',
      amount: 300.0,
      category_id: catDining,
      created_at: '2026-03-10T12:00:00.000Z',
    });

    const breakdown = await getCategoryBreakdown(
      '2026-03-01T00:00:00.000Z',
      '2026-03-31T23:59:59.999Z',
      'expense'
    );

    assert.strictEqual(breakdown.length, 2);
    assert.strictEqual(breakdown[0].category_id, catGroceries);
    assert.strictEqual(breakdown[0].total, 700.0);
    assert.strictEqual(breakdown[0].percentage, 70.0);

    assert.strictEqual(breakdown[1].category_id, catDining);
    assert.strictEqual(breakdown[1].total, 300.0);
    assert.strictEqual(breakdown[1].percentage, 30.0);
  });

  test('getEventAwareBreakdown rolls up event spending and includes sub-breakdown', async () => {
    // Normal expense (no event)
    await addTransaction({
      type: 'expense',
      amount: 400.0,
      category_id: catGroceries,
      created_at: '2026-03-05T12:00:00.000Z',
    });

    // Event expenses (tagged with Rome Holiday)
    await addTransaction({
      type: 'expense',
      amount: 350.0,
      category_id: catDining,
      event_id: eventTrip,
      created_at: '2026-03-12T20:00:00.000Z',
    });
    await addTransaction({
      type: 'expense',
      amount: 250.0,
      category_id: catGroceries,
      event_id: eventTrip,
      created_at: '2026-03-13T10:00:00.000Z',
    });

    const breakdown = await getEventAwareBreakdown(
      '2026-03-01T00:00:00.000Z',
      '2026-03-31T23:59:59.999Z',
      'expense'
    );

    // Total expenses: $400 + $350 + $250 = $1,000
    // Rome Holiday total: $600 (60%)
    // Groceries non-event total: $400 (40%)
    const eventItem = breakdown.find((b) => b.is_event);
    assert.ok(eventItem, 'Should find event parent item');
    assert.strictEqual(eventItem?.name, 'Rome Holiday');
    assert.strictEqual(eventItem?.total, 600.0);
    assert.strictEqual(eventItem?.percentage, 60.0);

    // Verify sub-breakdown inside the event
    assert.ok(eventItem?.sub_breakdown && eventItem.sub_breakdown.length === 2);
    const subDining = eventItem?.sub_breakdown.find((s) => s.category_id === catDining);
    assert.strictEqual(subDining?.total, 350.0);
    // (350 / 600) * 100 = 58.3%
    assert.strictEqual(subDining?.percentage, 58.3);
  });

  test('getMonthlyTrends groups 12 months with net flow', async () => {
    // January income and expense
    await addTransaction({ type: 'income', amount: 4000, created_at: '2026-01-15T00:00:00.000Z' });
    await addTransaction({ type: 'expense', amount: 1500, created_at: '2026-01-20T00:00:00.000Z' });

    // February income and expense
    await addTransaction({ type: 'income', amount: 4200, created_at: '2026-02-15T00:00:00.000Z' });
    await addTransaction({ type: 'expense', amount: 2000, created_at: '2026-02-20T00:00:00.000Z' });

    const trends = await getMonthlyTrends(2026);
    assert.strictEqual(trends.length, 12);

    // Jan (index 0)
    assert.strictEqual(trends[0].label, 'Jan');
    assert.strictEqual(trends[0].income, 4000);
    assert.strictEqual(trends[0].expenses, 1500);
    assert.strictEqual(trends[0].net, 2500);

    // Feb (index 1)
    assert.strictEqual(trends[1].label, 'Feb');
    assert.strictEqual(trends[1].income, 4200);
    assert.strictEqual(trends[1].expenses, 2000);
    assert.strictEqual(trends[1].net, 2200);

    // Mar (empty, index 2)
    assert.strictEqual(trends[2].income, 0);
    assert.strictEqual(trends[2].expenses, 0);
    assert.strictEqual(trends[2].net, 0);
  });

  test('getWeeklyTrends breaks month into 4 weeks', async () => {
    // Week 1 (day <= 7)
    await addTransaction({ type: 'expense', amount: 100, created_at: '2026-03-03T12:00:00.000Z' });
    // Week 2 (day 8-14)
    await addTransaction({ type: 'expense', amount: 200, created_at: '2026-03-10T12:00:00.000Z' });
    // Week 3 (day 15-21)
    await addTransaction({ type: 'expense', amount: 300, created_at: '2026-03-17T12:00:00.000Z' });
    // Week 4 (day 22+)
    await addTransaction({ type: 'expense', amount: 400, created_at: '2026-03-25T12:00:00.000Z' });

    const weekly = await getWeeklyTrends(2026, 3);
    assert.strictEqual(weekly.length, 4);
    assert.strictEqual(weekly[0].label, 'W1');
    assert.strictEqual(weekly[0].expenses, 100);
    assert.strictEqual(weekly[1].label, 'W2');
    assert.strictEqual(weekly[1].expenses, 200);
    assert.strictEqual(weekly[2].label, 'W3');
    assert.strictEqual(weekly[2].expenses, 300);
    assert.strictEqual(weekly[3].label, 'W4');
    assert.strictEqual(weekly[3].expenses, 400);
  });

  test('getMonthlyDailyExpenses aggregates daily spend for calendar view', async () => {
    await addTransaction({ type: 'expense', amount: 45.0, created_at: '2026-03-05T08:00:00.000Z' });
    await addTransaction({ type: 'expense', amount: 55.0, created_at: '2026-03-05T14:00:00.000Z' });
    await addTransaction({ type: 'expense', amount: 120.0, created_at: '2026-03-12T19:00:00.000Z' });

    const daily = await getMonthlyDailyExpenses(2026, 3);
    const day5 = daily.find((d) => d.day === 5);
    assert.ok(day5);
    assert.strictEqual(day5?.amount, 100.0);
    assert.strictEqual(day5?.count, 2);

    const day12 = daily.find((d) => d.day === 12);
    assert.ok(day12);
    assert.strictEqual(day12?.amount, 120.0);
    assert.strictEqual(day12?.count, 1);
  });
});
