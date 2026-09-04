import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { setupTestDatabase } from './testHelper';
import {
  getQuickShortcuts,
  addQuickShortcut,
  updateQuickShortcut,
  deleteQuickShortcut,
  getCategories,
  addTransaction,
  getFilteredTransactions,
} from '../src/database/database';

describe('Quick Shortcuts Management & Transaction Creation', () => {
  let categoryId: number;

  beforeEach(async () => {
    await setupTestDatabase();
    const cats = await getCategories();
    categoryId = cats[0].id;
  });

  test('can add and retrieve quick shortcuts', async () => {
    const id = await addQuickShortcut('Daily Espresso', 'local-cafe', 3.5, categoryId, 'expense');
    assert.ok(id > 0);

    const list = await getQuickShortcuts();
    const sc = list.find((s) => s.id === id);
    assert.ok(sc);
    assert.strictEqual(sc?.title, 'Daily Espresso');
    assert.strictEqual(sc?.amount, 3.5);
    assert.strictEqual(sc?.category_id, categoryId);
    assert.strictEqual(sc?.type, 'expense');
  });

  test('can update a quick shortcut', async () => {
    const id = await addQuickShortcut('Quick Lunch', 'restaurant', 12.0, categoryId, 'expense');
    await updateQuickShortcut(id, 'Business Lunch', 'restaurant', 18.5, categoryId, 'expense');

    const list = await getQuickShortcuts();
    const sc = list.find((s) => s.id === id);
    assert.strictEqual(sc?.title, 'Business Lunch');
    assert.strictEqual(sc?.amount, 18.5);
  });

  test('can delete a quick shortcut', async () => {
    const id = await addQuickShortcut('Snack', 'fastfood', 5.0, categoryId, 'expense');
    await deleteQuickShortcut(id);

    const list = await getQuickShortcuts();
    assert.ok(!list.some((s) => s.id === id));
  });

  test('triggering a quick shortcut logs transaction accurately', async () => {
    const id = await addQuickShortcut('Transit Pass', 'directions-car', 45.0, categoryId, 'expense');
    const list = await getQuickShortcuts();
    const sc = list.find((s) => s.id === id)!;

    // Simulate clicking the shortcut (as done on HomeScreen)
    const txId = await addTransaction({
      type: sc.type,
      amount: sc.amount,
      category_id: sc.category_id,
      description: sc.title,
      created_at: new Date().toISOString(),
    });

    const txs = await getFilteredTransactions({ limit: 1 });
    assert.strictEqual(txs.transactions[0].id, txId);
    assert.strictEqual(txs.transactions[0].amount, 45.0);
    assert.strictEqual(txs.transactions[0].description, 'Transit Pass');
  });
});
