import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { setupTestDatabase } from './testHelper';
import {
  getSavingsGoals,
  addSavingsGoal,
  updateSavingsGoal,
  deleteSavingsGoal,
  contributeToGoal,
} from '../src/database/database';

describe('Savings Goals Management & Progress Logic', () => {
  beforeEach(async () => {
    await setupTestDatabase();
  });

  test('can add and retrieve savings goals', async () => {
    const goalId = await addSavingsGoal({
      name: 'Emergency Fund',
      target_amount: 5000.0,
      current_amount: 1000.0,
      quick_amount: 50.0,
      target_date: '2026-12-31T23:59:59.000Z',
      icon: 'savings',
      color: '#10B981',
      is_completed: 0,
    });

    assert.ok(goalId > 0);
    const goals = await getSavingsGoals();
    const goal = goals.find((g) => g.id === goalId);
    assert.ok(goal);
    assert.strictEqual(goal?.name, 'Emergency Fund');
    assert.strictEqual(goal?.target_amount, 5000.0);
    assert.strictEqual(goal?.current_amount, 1000.0);
    assert.strictEqual(goal?.quick_amount, 50.0);
    assert.strictEqual(goal?.is_completed, 0);
  });

  test('contributeToGoal increments amount and completes goal when target reached', async () => {
    const goalId = await addSavingsGoal({
      name: 'Laptop Fund',
      target_amount: 2000.0,
      current_amount: 1900.0,
      quick_amount: 25.0,
      is_completed: 0,
    });

    // Contribute $50 -> $1950, not completed
    await contributeToGoal(goalId, 50.0);
    let goals = await getSavingsGoals();
    let goal = goals.find((g) => g.id === goalId);
    assert.strictEqual(goal?.current_amount, 1950.0);
    assert.strictEqual(goal?.is_completed, 0);

    // Contribute another $50 -> $2000, target reached!
    await contributeToGoal(goalId, 50.0);
    goals = await getSavingsGoals();
    goal = goals.find((g) => g.id === goalId);
    assert.strictEqual(goal?.current_amount, 2000.0);
    assert.strictEqual(goal?.is_completed, 1);
  });

  test('updateSavingsGoal modifies goal properties', async () => {
    const goalId = await addSavingsGoal({
      name: 'Old Name',
      target_amount: 1000.0,
      current_amount: 100.0,
      quick_amount: 20.0,
      is_completed: 0,
    });

    await updateSavingsGoal({
      id: goalId,
      name: 'New Name',
      target_amount: 1500.0,
      quick_amount: 100.0,
    });

    const goals = await getSavingsGoals();
    const updated = goals.find((g) => g.id === goalId);
    assert.strictEqual(updated?.name, 'New Name');
    assert.strictEqual(updated?.target_amount, 1500.0);
    assert.strictEqual(updated?.quick_amount, 100.0);
  });

  test('deleteSavingsGoal deletes goal cleanly', async () => {
    const goalId = await addSavingsGoal({
      name: 'To Delete',
      target_amount: 500.0,
      current_amount: 0,
      is_completed: 0,
    });

    await deleteSavingsGoal(goalId);
    const goals = await getSavingsGoals();
    assert.ok(!goals.some((g) => g.id === goalId));
  });
});
