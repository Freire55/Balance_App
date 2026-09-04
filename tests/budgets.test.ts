import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { setupTestDatabase } from './testHelper';
import {
  getCategories,
  setCategoryBudget,
  getBudgets,
  deleteCategoryBudget,
  addTransaction,
} from '../src/database/database';

describe('Budgets CRUD & Dynamic Spending Calculation', () => {
  let catGroceries: number;
  let catDining: number;

  beforeEach(async () => {
    await setupTestDatabase();
    const cats = await getCategories();
    catGroceries = cats.find((c) => c.name === 'Groceries & Supermarket')!.id;
    catDining = cats.find((c) => c.name === 'Dining & Coffee')!.id;
  });

  test('can set, update, and get category budgets', async () => {
    await setCategoryBudget(catGroceries, 400.0);
    const budgets1 = await getBudgets(2026, 3);
    const groceryBudget1 = budgets1.find((b) => b.category_id === catGroceries);
    assert.ok(groceryBudget1);
    assert.strictEqual(groceryBudget1?.monthly_limit, 400.0);

    // Update the same budget (ON CONFLICT DO UPDATE)
    await setCategoryBudget(catGroceries, 450.0);
    const budgets2 = await getBudgets(2026, 3);
    const groceryBudget2 = budgets2.find((b) => b.category_id === catGroceries);
    assert.strictEqual(groceryBudget2?.monthly_limit, 450.0);
  });

  test('dynamically updates spent amount, remaining amount, and percentage', async () => {
    await setCategoryBudget(catDining, 200.0);

    // Verify initial 0 spent
    const initialBudgets = await getBudgets(2026, 3);
    const initialDining = initialBudgets.find((b) => b.category_id === catDining);
    assert.strictEqual(initialDining?.spent_amount, 0);
    assert.strictEqual(initialDining?.remaining_amount, 200.0);
    assert.strictEqual(initialDining?.percentage_used, 0);

    // Add a dining expense in March 2026
    await addTransaction({
      type: 'expense',
      amount: 150.0,
      category_id: catDining,
      created_at: '2026-03-10T12:00:00.000Z',
    });

    // Re-query budgets for March 2026
    const updatedBudgets = await getBudgets(2026, 3);
    const updatedDining = updatedBudgets.find((b) => b.category_id === catDining);
    assert.strictEqual(updatedDining?.spent_amount, 150.0);
    assert.strictEqual(updatedDining?.remaining_amount, 50.0);
    // (150 / 200) * 100 = 75.0%
    assert.strictEqual(updatedDining?.percentage_used, 75.0);

    // Add another expense that exceeds the budget
    await addTransaction({
      type: 'expense',
      amount: 100.0,
      category_id: catDining,
      created_at: '2026-03-20T12:00:00.000Z',
    });

    const exceededBudgets = await getBudgets(2026, 3);
    const exceededDining = exceededBudgets.find((b) => b.category_id === catDining);
    assert.strictEqual(exceededDining?.spent_amount, 250.0);
    assert.strictEqual(exceededDining?.remaining_amount, 0); // Math.max(0, limit - spent)
    assert.strictEqual(exceededDining?.percentage_used, 125.0);
  });

  test('can delete a budget', async () => {
    await setCategoryBudget(catGroceries, 500.0);
    const before = await getBudgets(2026, 3);
    assert.ok(before.some((b) => b.category_id === catGroceries));

    await deleteCategoryBudget(catGroceries);
    const after = await getBudgets(2026, 3);
    assert.ok(!after.some((b) => b.category_id === catGroceries));
  });
});
