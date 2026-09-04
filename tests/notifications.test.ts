import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { setupTestDatabase } from './testHelper';
import {
  addAppNotification,
  getAppNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  clearAllNotifications,
} from '../src/database/database';

describe('App Notification Center Operations', () => {
  beforeEach(async () => {
    await setupTestDatabase();
  });

  test('can add notifications and track unread count', async () => {
    const notif1 = await addAppNotification('recurring', 'Bill Processed', 'Rent was logged.');
    const notif2 = await addAppNotification('budget', 'Budget Alert', 'Groceries exceeded 80%.');

    assert.ok(notif1 > 0);
    assert.ok(notif2 > 0);

    const count = await getUnreadNotificationCount();
    assert.strictEqual(count, 2);

    const list = await getAppNotifications(10);
    assert.strictEqual(list.length, 2);
    assert.strictEqual(list[0].title, 'Budget Alert');
    assert.strictEqual(list[0].is_read, 0);
  });

  test('markNotificationAsRead marks single item read', async () => {
    const id = await addAppNotification('month_end', 'Month-End Review', 'Check your report.');
    await markNotificationAsRead(id);

    const count = await getUnreadNotificationCount();
    assert.strictEqual(count, 0);

    const list = await getAppNotifications(1);
    assert.strictEqual(list[0].is_read, 1);
  });

  test('markAllNotificationsAsRead marks all read', async () => {
    await addAppNotification('recurring', 'N1', 'B1');
    await addAppNotification('recurring', 'N2', 'B2');
    await addAppNotification('recurring', 'N3', 'B3');

    assert.strictEqual(await getUnreadNotificationCount(), 3);

    await markAllNotificationsAsRead();
    assert.strictEqual(await getUnreadNotificationCount(), 0);
  });

  test('clearAllNotifications deletes all notifications', async () => {
    await addAppNotification('recurring', 'N1', 'B1');
    await addAppNotification('recurring', 'N2', 'B2');

    await clearAllNotifications();
    const list = await getAppNotifications();
    assert.strictEqual(list.length, 0);
  });
});
