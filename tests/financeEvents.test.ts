import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { setupTestDatabase } from './testHelper';
import {
  getFinanceEvents,
  getFinanceEventById,
  addFinanceEvent,
  editFinanceEvent,
  deleteFinanceEvent,
  addTransaction,
  getCategories,
  getTransactionById,
} from '../src/database/database';

describe('Finance Events & Vacation Trips Tracking', () => {
  let catDining: number;
  let catGroceries: number;

  beforeEach(async () => {
    await setupTestDatabase();
    const cats = await getCategories();
    catDining = cats.find((c) => c.name === 'Dining & Coffee')!.id;
    catGroceries = cats.find((c) => c.name === 'Groceries & Supermarket')!.id;
  });

  test('can create and fetch finance events with aggregate spend', async () => {
    const eventId = await addFinanceEvent(
      'Tokyo Vacation 2026',
      'Flight and hotels in Tokyo',
      'flight',
      '#EC4899',
      3000.0,
      '2026-05-01',
      '2026-05-15'
    );

    assert.ok(eventId > 0);

    // Add 2 expenses to this event
    await addTransaction({
      type: 'expense',
      amount: 450.0,
      category_id: catDining,
      event_id: eventId,
      description: 'Shibuya Dinner',
      created_at: '2026-05-03T20:00:00.000Z',
    });
    await addTransaction({
      type: 'expense',
      amount: 150.0,
      category_id: catGroceries,
      event_id: eventId,
      description: 'Konbini snacks',
      created_at: '2026-05-04T10:00:00.000Z',
    });

    const events = await getFinanceEvents();
    const event = events.find((e) => e.id === eventId);
    assert.ok(event);
    assert.strictEqual(event?.name, 'Tokyo Vacation 2026');
    assert.strictEqual(event?.budget, 3000.0);
    assert.strictEqual(event?.total_spent, 600.0);
    assert.strictEqual(event?.transaction_count, 2);
  });

  test('getFinanceEventById computes sub-breakdown within the event', async () => {
    const eventId = await addFinanceEvent('Ski Trip', 'Alps vacation', 'flight', '#3B82F6', 1500.0);

    await addTransaction({
      type: 'expense',
      amount: 300.0,
      category_id: catDining,
      event_id: eventId,
      created_at: '2026-01-10T12:00:00.000Z',
    });
    await addTransaction({
      type: 'expense',
      amount: 700.0,
      category_id: catGroceries,
      event_id: eventId,
      created_at: '2026-01-11T12:00:00.000Z',
    });

    const details = await getFinanceEventById(eventId);
    assert.ok(details);
    assert.strictEqual(details?.total_spent, 1000.0);
    assert.strictEqual(details?.transaction_count, 2);
    assert.ok(details?.category_breakdown && details.category_breakdown.length === 2);

    const grocerySub = details.category_breakdown.find((c) => c.category_id === catGroceries);
    assert.strictEqual(grocerySub?.total, 700.0);
    assert.strictEqual(grocerySub?.percentage, 70.0);
  });

  test('editFinanceEvent updates event information', async () => {
    const eventId = await addFinanceEvent('Original Event', 'Desc', 'flight', '#111', 500);
    await editFinanceEvent(eventId, 'Renamed Event', 'New Desc', 'flight', '#222', 750);

    const updated = await getFinanceEventById(eventId);
    assert.strictEqual(updated?.name, 'Renamed Event');
    assert.strictEqual(updated?.description, 'New Desc');
    assert.strictEqual(updated?.budget, 750);
  });

  test('deleteFinanceEvent dissociates transactions without deleting them', async () => {
    const eventId = await addFinanceEvent('Temporary Event', 'Desc', 'flight', '#111', 500);

    const txId = await addTransaction({
      type: 'expense',
      amount: 88.0,
      category_id: catDining,
      event_id: eventId,
      created_at: '2026-02-01T12:00:00.000Z',
    });

    // Delete the event
    await deleteFinanceEvent(eventId);

    // Verify event is removed
    const events = await getFinanceEvents();
    assert.ok(!events.some((e) => e.id === eventId));

    // Verify transaction STILL exists with event_id = null
    const tx = await getTransactionById(txId);
    assert.ok(tx, 'Transaction must NOT be deleted when event is deleted');
    assert.strictEqual(tx?.event_id, null, 'Transaction event_id must be cleanly set to null');
    assert.strictEqual(tx?.amount, 88.0);
  });
});
