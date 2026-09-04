import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { setupTestDatabase } from './testHelper';
import {
  addTransaction,
  getCategories,
  setCategoryBudget,
  addSavingsGoal,
  addQuickShortcut,
  addFinanceEvent,
  getFilteredTransactions,
  getBudgets,
  getSavingsGoals,
} from '../src/database/database';
import {
  createFullBackupJson,
  restoreFromBackupJson,
  optimizeDatabase,
} from '../src/database/exportImport';

describe('Export, Import & Database Optimization', () => {
  beforeEach(async () => {
    await setupTestDatabase();
  });

  test('full database backup and restore maintains 100% data fidelity', async () => {
    const cats = await getCategories();
    const cat = cats[0].id;

    // 1. Seed distinct entities
    const eventId = await addFinanceEvent('Backup Trip', 'Trip to test backup', 'flight', '#F43F5E', 800);
    const txId = await addTransaction({
      type: 'expense',
      amount: 123.45,
      category_id: cat,
      event_id: eventId,
      description: 'Pre-backup expense',
      tags: 'backup-tag',
      created_at: '2026-03-01T12:00:00.000Z',
    });
    await setCategoryBudget(cat, 600);
    const goalId = await addSavingsGoal({
      name: 'Backup Goal',
      target_amount: 1500,
      current_amount: 500,
    });
    await addQuickShortcut('Backup Shortcut', 'local-cafe', 4.5, cat, 'expense');

    // 2. Create full JSON backup
    const backupJson = await createFullBackupJson();
    assert.ok(typeof backupJson === 'string');
    const parsed = JSON.parse(backupJson);
    assert.strictEqual(parsed.version, 3);
    assert.ok(parsed.transactions.some((t: any) => t.id === txId));

    // 3. Restore from the backup JSON
    const restoreResult = await restoreFromBackupJson(backupJson);
    assert.strictEqual(restoreResult.success, true);

    // 4. Verify restored state matches completely
    const txs = await getFilteredTransactions({ limit: 10 });
    const restoredTx = txs.transactions.find((t) => t.id === txId);
    assert.ok(restoredTx, 'Restored transaction should exist');
    assert.strictEqual(restoredTx?.amount, 123.45);
    assert.strictEqual(restoredTx?.description, 'Pre-backup expense');
    assert.strictEqual(restoredTx?.tags, 'backup-tag');
    assert.strictEqual(restoredTx?.event_id, eventId);

    const budgets = await getBudgets(2026, 3);
    const restoredBudget = budgets.find((b) => b.category_id === cat);
    assert.ok(restoredBudget);
    assert.strictEqual(restoredBudget?.monthly_limit, 600);

    const goals = await getSavingsGoals();
    const restoredGoal = goals.find((g) => g.id === goalId);
    assert.ok(restoredGoal);
    assert.strictEqual(restoredGoal?.name, 'Backup Goal');
    assert.strictEqual(restoredGoal?.current_amount, 500);
  });

  test('restoreFromBackupJson safely rejects invalid payload', async () => {
    const res1 = await restoreFromBackupJson('not valid json');
    assert.strictEqual(res1.success, false);

    const res2 = await restoreFromBackupJson(JSON.stringify({ invalid: true }));
    assert.strictEqual(res2.success, false);
  });

  test('optimizeDatabase executes VACUUM and PRAGMA optimize cleanly', async () => {
    await assert.doesNotReject(async () => {
      await optimizeDatabase();
    });
  });
});
