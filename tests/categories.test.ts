import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { setupTestDatabase } from './testHelper';
import {
  getCategories,
  addCategory,
  editCategory,
  deleteCategory,
  addTransaction,
  getFilteredTransactions,
  addRecurringTransaction,
  getRecurringTransactions,
  addQuickShortcut,
  getQuickShortcuts,
  setCategoryBudget,
  getBudgets,
} from '../src/database/database';

describe('Categories Management & Referential Integrity', () => {
  beforeEach(async () => {
    await setupTestDatabase();
  });

  test('can fetch default seeded categories', async () => {
    const cats = await getCategories();
    assert.ok(cats.length >= 14, 'Should contain all default fintech categories');
    const grocery = cats.find((c) => c.name === 'Groceries & Supermarket');
    assert.ok(grocery, 'Should find Groceries & Supermarket');
    assert.strictEqual(grocery?.icon, 'local-grocery-store');
  });

  test('can add a custom category', async () => {
    const newId = await addCategory('Pet Supplies', 'pets', '#F59E0B');
    assert.ok(newId > 0, 'New category ID should be positive integer');

    const cats = await getCategories();
    const created = cats.find((c) => c.id === newId);
    assert.ok(created, 'Newly created category should be found');
    assert.strictEqual(created?.name, 'Pet Supplies');
    assert.strictEqual(created?.icon, 'pets');
    assert.strictEqual(created?.color, '#F59E0B');
  });

  test('prevents duplicate category names', async () => {
    await addCategory('Crypto Investments', 'trending-up', '#8B5CF6');
    await assert.rejects(
      async () => {
        await addCategory('Crypto Investments', 'trending-up', '#8B5CF6');
      },
      /UNIQUE constraint failed/
    );
  });

  test('can edit an existing category', async () => {
    const id = await addCategory('Coffee Breaks', 'local-cafe', '#78350F');
    await editCategory(id, 'Artisan Coffee', 'coffee', '#B45309');

    const cats = await getCategories();
    const updated = cats.find((c) => c.id === id);
    assert.strictEqual(updated?.name, 'Artisan Coffee');
    assert.strictEqual(updated?.icon, 'coffee');
    assert.strictEqual(updated?.color, '#B45309');
  });

  test('deleteCategory reassigns transactions to fallback or NULL without losing any data', async () => {
    const catA = await addCategory('Cat A', 'folder', '#111');
    const catB = await addCategory('Cat B', 'folder', '#222');

    // Create transaction in Cat A
    const txId = await addTransaction({
      type: 'expense',
      amount: 45.0,
      category_id: catA,
      description: 'Test purchase',
      created_at: new Date().toISOString(),
    });

    // Delete Cat A with fallback to Cat B
    await deleteCategory(catA, catB);

    const txs = await getFilteredTransactions({ limit: 10 });
    const tx = txs.transactions.find((t) => t.id === txId);
    assert.ok(tx, 'Transaction must NOT be deleted');
    assert.strictEqual(tx?.category_id, catB, 'Transaction category must be reassigned to Cat B');

    // Now delete Cat B with fallback NULL
    await deleteCategory(catB, null);
    const txsAfter = await getFilteredTransactions({ limit: 10 });
    const txAfter = txsAfter.transactions.find((t) => t.id === txId);
    assert.ok(txAfter, 'Transaction must NEVER be lost');
    assert.strictEqual(txAfter?.category_id, null, 'Transaction category should be null (uncategorized)');
  });

  test('deleteCategory cleanly updates recurring rules, shortcuts and deletes budgets', async () => {
    const cat = await addCategory('Temporary Cat', 'folder', '#333');

    // Add recurring rule
    await addRecurringTransaction({
      type: 'expense',
      amount: 20.0,
      category_id: cat,
      description: 'Monthly sub',
      start_date: new Date().toISOString(),
      frequency: 'monthly',
      day_of_month: 1,
    });

    // Add shortcut
    await addQuickShortcut('Quick Coffee', 'local-cafe', 3.5, cat, 'expense');

    // Add budget
    await setCategoryBudget(cat, 100);

    // Verify budget exists
    const budgetsBefore = await getBudgets();
    assert.ok(budgetsBefore.some((b) => b.category_id === cat));

    // Delete category
    await deleteCategory(cat);

    // Verify recurring rule still exists with category_id = null
    const recurring = await getRecurringTransactions();
    const recRule = recurring.find((r) => r.description === 'Monthly sub');
    assert.ok(recRule, 'Recurring rule should not be deleted');
    assert.strictEqual(recRule?.category_id, null);

    // Verify shortcut still exists with category_id = null
    const shortcuts = await getQuickShortcuts();
    const sc = shortcuts.find((s) => s.title === 'Quick Coffee');
    assert.ok(sc, 'Shortcut should not be deleted');
    assert.strictEqual(sc?.category_id, null);

    // Verify budget was deleted
    const budgetsAfter = await getBudgets();
    assert.ok(!budgetsAfter.some((b) => b.category_id === cat), 'Budget for deleted category should be removed');
  });
});
