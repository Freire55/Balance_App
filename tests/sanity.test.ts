import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { setupTestDatabase } from './testHelper';
import { getCategories, addCategory, getSetting, setSetting } from '../src/database/database';

describe('Sanity & Database Initialization', () => {
  beforeEach(async () => {
    await setupTestDatabase();
  });

  test('migrations populate default categories', async () => {
    const categories = await getCategories();
    assert.ok(categories.length > 0, 'Categories should not be empty');
    const names = categories.map((c) => c.name);
    assert.ok(names.includes('Salary & Wages'));
    assert.ok(names.includes('Housing & Rent'));
  });

  test('settings table works', async () => {
    const currency = await getSetting('currency', 'EUR');
    assert.strictEqual(currency, 'EUR');
    await setSetting('currency', 'USD');
    const updated = await getSetting('currency');
    assert.strictEqual(updated, 'USD');
  });
});
