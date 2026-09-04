import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { setupTestDatabase } from './testHelper';
import {
  addTransaction,
  editTransaction,
  deleteTransaction,
  getTransactionById,
  getFilteredTransactions,
  getCategories,
  addFinanceEvent,
} from '../src/database/database';

describe('Transactions CRUD, Filtering, Sorting & Pagination', () => {
  let categoryId: number;
  let eventId: number;

  beforeEach(async () => {
    await setupTestDatabase();
    const cats = await getCategories();
    categoryId = cats[0].id;
    eventId = await addFinanceEvent('Test Trip', 'Vacation', 'flight', '#F43F5E', 500);
  });

  test('can add and retrieve an expense transaction', async () => {
    const txId = await addTransaction({
      type: 'expense',
      amount: 52.45,
      category_id: categoryId,
      description: 'Supermarket weekly groceries',
      tags: 'grocery, food',
      created_at: '2026-03-15T14:30:00.000Z',
      event_id: eventId,
    });

    assert.ok(txId > 0);
    const tx = await getTransactionById(txId);
    assert.ok(tx);
    assert.strictEqual(tx?.type, 'expense');
    assert.strictEqual(tx?.amount, 52.45);
    assert.strictEqual(tx?.category_id, categoryId);
    assert.strictEqual(tx?.description, 'Supermarket weekly groceries');
    assert.strictEqual(tx?.tags, 'grocery, food');
    assert.strictEqual(tx?.event_id, eventId);
    assert.strictEqual(tx?.event_name, 'Test Trip');
  });

  test('can add and retrieve an income transaction', async () => {
    const txId = await addTransaction({
      type: 'income',
      amount: 3200.0,
      category_id: categoryId,
      description: 'Monthly consulting contract',
      created_at: '2026-03-01T09:00:00.000Z',
    });

    const tx = await getTransactionById(txId);
    assert.ok(tx);
    assert.strictEqual(tx?.type, 'income');
    assert.strictEqual(tx?.amount, 3200.0);
  });

  test('can edit an existing transaction', async () => {
    const txId = await addTransaction({
      type: 'expense',
      amount: 100.0,
      category_id: categoryId,
      description: 'Old Description',
      created_at: '2026-03-10T12:00:00.000Z',
    });

    await editTransaction({
      id: txId,
      type: 'expense',
      amount: 125.5,
      category_id: categoryId,
      description: 'Updated Description',
      tags: 'edited',
      created_at: '2026-03-11T12:00:00.000Z',
    });

    const updated = await getTransactionById(txId);
    assert.strictEqual(updated?.amount, 125.5);
    assert.strictEqual(updated?.description, 'Updated Description');
    assert.strictEqual(updated?.tags, 'edited');
    assert.strictEqual(updated?.created_at, '2026-03-11T12:00:00.000Z');
  });

  test('can delete a transaction', async () => {
    const txId = await addTransaction({
      type: 'expense',
      amount: 25.0,
      created_at: new Date().toISOString(),
    });

    const before = await getTransactionById(txId);
    assert.ok(before);

    await deleteTransaction(txId);

    const after = await getTransactionById(txId);
    assert.strictEqual(after, null);
  });

  test('filters transactions by type', async () => {
    await addTransaction({ type: 'income', amount: 500, created_at: '2026-03-01T00:00:00.000Z' });
    await addTransaction({ type: 'expense', amount: 50, created_at: '2026-03-02T00:00:00.000Z' });
    await addTransaction({ type: 'expense', amount: 30, created_at: '2026-03-03T00:00:00.000Z' });

    const incomeOnly = await getFilteredTransactions({ type: 'income' });
    assert.strictEqual(incomeOnly.transactions.length, 1);
    assert.strictEqual(incomeOnly.transactions[0].type, 'income');

    const expenseOnly = await getFilteredTransactions({ type: 'expense' });
    assert.strictEqual(expenseOnly.transactions.length, 2);
  });

  test('filters transactions by date range', async () => {
    await addTransaction({ type: 'expense', amount: 10, created_at: '2026-01-15T00:00:00.000Z' });
    await addTransaction({ type: 'expense', amount: 20, created_at: '2026-02-15T00:00:00.000Z' });
    await addTransaction({ type: 'expense', amount: 30, created_at: '2026-03-15T00:00:00.000Z' });

    const febTxs = await getFilteredTransactions({
      startDate: '2026-02-01T00:00:00.000Z',
      endDate: '2026-02-28T23:59:59.999Z',
    });

    assert.strictEqual(febTxs.transactions.length, 1);
    assert.strictEqual(febTxs.transactions[0].amount, 20);
  });

  test('filters transactions by min and max amount', async () => {
    await addTransaction({ type: 'expense', amount: 15.0, created_at: '2026-03-01T00:00:00.000Z' });
    await addTransaction({ type: 'expense', amount: 85.0, created_at: '2026-03-02T00:00:00.000Z' });
    await addTransaction({ type: 'expense', amount: 350.0, created_at: '2026-03-03T00:00:00.000Z' });

    const filtered = await getFilteredTransactions({ minAmount: 50, maxAmount: 100 });
    assert.strictEqual(filtered.transactions.length, 1);
    assert.strictEqual(filtered.transactions[0].amount, 85.0);
  });

  test('filters transactions by search query', async () => {
    await addTransaction({
      type: 'expense',
      amount: 40,
      description: 'Flight to Rome',
      tags: 'travel',
      created_at: '2026-03-01T00:00:00.000Z',
    });
    await addTransaction({
      type: 'expense',
      amount: 25,
      description: 'Gym pass',
      tags: 'fitness',
      created_at: '2026-03-02T00:00:00.000Z',
    });

    const searchResult = await getFilteredTransactions({ searchQuery: 'Rome' });
    assert.strictEqual(searchResult.transactions.length, 1);
    assert.strictEqual(searchResult.transactions[0].description, 'Flight to Rome');

    const searchByTag = await getFilteredTransactions({ searchQuery: 'fitness' });
    assert.strictEqual(searchByTag.transactions.length, 1);
    assert.strictEqual(searchByTag.transactions[0].description, 'Gym pass');
  });

  test('supports sorting by amount and date', async () => {
    await addTransaction({ type: 'expense', amount: 10, created_at: '2026-03-01T00:00:00.000Z' });
    await addTransaction({ type: 'expense', amount: 100, created_at: '2026-03-02T00:00:00.000Z' });
    await addTransaction({ type: 'expense', amount: 50, created_at: '2026-03-03T00:00:00.000Z' });

    const byAmountDesc = await getFilteredTransactions({ orderBy: 'amount', orderDirection: 'DESC' });
    assert.strictEqual(byAmountDesc.transactions[0].amount, 100);
    assert.strictEqual(byAmountDesc.transactions[1].amount, 50);
    assert.strictEqual(byAmountDesc.transactions[2].amount, 10);

    const byDateAsc = await getFilteredTransactions({ orderBy: 'created_at', orderDirection: 'ASC' });
    assert.strictEqual(byDateAsc.transactions[0].amount, 10);
    assert.strictEqual(byDateAsc.transactions[2].amount, 50);
  });

  test('handles pagination correctly', async () => {
    for (let i = 1; i <= 25; i++) {
      await addTransaction({
        type: 'expense',
        amount: i * 10,
        description: `Tx ${i}`,
        created_at: `2026-03-${String(i).padStart(2, '0')}T00:00:00.000Z`,
      });
    }

    // Page 1: limit 10, offset 0
    const page1 = await getFilteredTransactions({ limit: 10, offset: 0 });
    assert.strictEqual(page1.transactions.length, 10);
    assert.strictEqual(page1.totalCount, 25);
    assert.strictEqual(page1.hasMore, true);

    // Page 2: limit 10, offset 10
    const page2 = await getFilteredTransactions({ limit: 10, offset: 10 });
    assert.strictEqual(page2.transactions.length, 10);
    assert.strictEqual(page2.hasMore, true);

    // Page 3: limit 10, offset 20
    const page3 = await getFilteredTransactions({ limit: 10, offset: 20 });
    assert.strictEqual(page3.transactions.length, 5);
    assert.strictEqual(page3.hasMore, false);
  });
});
