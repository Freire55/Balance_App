import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import {
  addAppNotification,
  getAppSettings,
  getBudgets,
  getPeriodSummary,
} from '../database/database';

// Configure notification behavior safely
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
      priority: Notifications.AndroidNotificationPriority.HIGH,
    }),
  });
} catch {
  // Ignored in restricted environments
}

/**
 * Setup notification channels for Android safely.
 */
export async function setupNotificationChannels(): Promise<void> {
  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'General Alerts',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#6366F1',
      });
      await Notifications.setNotificationChannelAsync('recurring', {
        name: 'Recurring Transactions',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#8B5CF6',
      });
      await Notifications.setNotificationChannelAsync('reports', {
        name: 'Financial Reports & Balances',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#10B981',
      });
      await Notifications.setNotificationChannelAsync('budgets', {
        name: 'Budget & Limit Alerts',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#F43F5E',
      });
    } catch {
      // In Expo Go, notification channels are simulated or restricted
    }
  }
}

/**
 * Request notification permissions safely.
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    return finalStatus === 'granted';
  } catch (error) {
    console.error('[Notifications] Permission error:', error);
    return false;
  }
}

/**
 * Send an immediate local notification (if notifications are enabled in settings).
 */
export async function sendLocalNotification(
  title: string,
  body: string,
  data: Record<string, any> = {},
  channelId: string = 'default'
): Promise<void> {
  try {
    const settings = await getAppSettings();
    if (!settings.notificationsEnabled) return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: true,
        ...(Platform.OS === 'android' ? { channelId } : {}),
      },
      trigger: null, // trigger immediately
    });
  } catch (error) {
    console.error('[Notifications] Error scheduling notification:', error);
  }
}

/**
 * Notify when recurring transactions are processed.
 */
export async function notifyRecurringProcessed(
  count: number,
  ruleDescriptions: string[]
): Promise<void> {
  if (count <= 0) return;

  const settings = await getAppSettings();
  const title = `Recurring Transaction${count > 1 ? 's' : ''} Processed`;
  const body = count === 1
    ? `${ruleDescriptions[0] || '1 recurring payment'} was recorded today.`
    : `${count} recurring payments recorded (${ruleDescriptions.slice(0, 2).join(', ')}${count > 2 ? '...' : ''}).`;

  // Always record in In-App Notification Center
  await addAppNotification('recurring', title, body, JSON.stringify({ count }));

  if (settings.notificationsEnabled && settings.notifyRecurring) {
    await sendLocalNotification(title, body, { type: 'recurring' }, 'recurring');
  }
}

/**
 * Check and generate End of Month balance notification.
 * Triggered on startup or background task when date is >= 28th.
 */
export async function checkAndSendEndOfMonthSummary(): Promise<void> {
  try {
    const now = new Date();
    const currentDay = now.getDate();
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    // Trigger on the final 3 days of the month
    if (currentDay < lastDayOfMonth - 2) return;

    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    const mStr = String(m).padStart(2, '0');
    const monthKey = `${y}-${mStr}`;
    const startDate = `${y}-${mStr}-01T00:00:00.000Z`;
    const endDate = `${y}-${mStr}-${String(lastDayOfMonth).padStart(2, '0')}T23:59:59.999Z`;

    const settings = await getAppSettings();
    const monthName = now.toLocaleDateString('en-US', { month: 'long' });

    // Check if we already notified for this specific month
    const { connectDb } = await import('../database/database');
    const db = await connectDb();
    const existing = await db.getAllAsync<{ id: number }>(
      `SELECT id FROM app_notifications WHERE type = 'month_end' AND data LIKE ?`,
      [`%${monthKey}%`]
    );

    if (existing.length > 0) return; // Already notified this month

    const summary = await getPeriodSummary(startDate, endDate);
    const sign = summary.netBalance >= 0 ? '+' : '';
    const formattedNet = `${sign}${settings.currencySymbol}${Math.abs(summary.netBalance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const title = `End of Month Balance • ${monthName}`;
    const body = `Net Cash Flow: ${formattedNet} (${summary.savingsRate}% saved) across ${summary.transactionCount} transactions.`;

    await addAppNotification('month_end', title, body, JSON.stringify({ monthKey, summary }));

    if (settings.notificationsEnabled && settings.notifyMonthEnd) {
      await sendLocalNotification(title, body, { type: 'month_end', monthKey }, 'reports');
    }
  } catch (error) {
    console.error('[Notifications] Error in checkAndSendEndOfMonthSummary:', error);
  }
}

/**
 * Check and generate End of Year balance review notification.
 * Triggered in late December (Dec 28-31) or early January (Jan 1-3).
 */
export async function checkAndSendEndOfYearSummary(): Promise<void> {
  try {
    const now = new Date();
    const month = now.getMonth(); // 0 = Jan, 11 = Dec
    const day = now.getDate();

    let targetYear = now.getFullYear();
    if (month === 0 && day <= 5) {
      // In early January, summarize previous year
      targetYear = now.getFullYear() - 1;
    } else if (month === 11 && day >= 28) {
      targetYear = now.getFullYear();
    } else {
      return; // Not year-end period
    }

    const yearKey = String(targetYear);
    const startDate = `${targetYear}-01-01T00:00:00.000Z`;
    const endDate = `${targetYear}-12-31T23:59:59.999Z`;

    const settings = await getAppSettings();

    const { connectDb } = await import('../database/database');
    const db = await connectDb();
    const existing = await db.getAllAsync<{ id: number }>(
      `SELECT id FROM app_notifications WHERE type = 'year_end' AND data LIKE ?`,
      [`%${yearKey}%`]
    );

    if (existing.length > 0) return; // Already notified for this year

    const summary = await getPeriodSummary(startDate, endDate);
    const sign = summary.netBalance >= 0 ? '+' : '';
    const formattedNet = `${sign}${settings.currencySymbol}${Math.abs(summary.netBalance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const title = `Annual Financial Review • ${targetYear}`;
    const body = `Total Net Balance: ${formattedNet} (${summary.savingsRate}% savings rate) across ${summary.transactionCount} transactions!`;

    await addAppNotification('year_end', title, body, JSON.stringify({ yearKey, summary }));

    if (settings.notificationsEnabled && settings.notifyYearEnd) {
      await sendLocalNotification(title, body, { type: 'year_end', yearKey }, 'reports');
    }
  } catch (error) {
    console.error('[Notifications] Error in checkAndSendEndOfYearSummary:', error);
  }
}

/**
 * Check category budgets and fire alerts if threshold (80% or 100%) is crossed.
 */
export async function checkBudgetThresholds(): Promise<void> {
  try {
    const settings = await getAppSettings();
    const budgets = await getBudgets();
    if (budgets.length === 0) return;

    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const { connectDb } = await import('../database/database');
    const db = await connectDb();

    for (const b of budgets) {
      const pct = b.percentage_used || 0;
      if (pct >= 80) {
        const thresholdLevel = pct >= 100 ? '100' : '80';
        const notifKey = `budget_${b.category_id}_${monthKey}_${thresholdLevel}`;

        const existing = await db.getAllAsync<{ id: number }>(
          `SELECT id FROM app_notifications WHERE data LIKE ?`,
          [`%${notifKey}%`]
        );

        if (existing.length === 0) {
          const title = pct >= 100
            ? `Budget Exceeded: ${b.category_name}`
            : `Budget Warning: ${b.category_name}`;
          const body = pct >= 100
            ? `You have spent 100% of your ${b.category_name} budget (${settings.currencySymbol}${b.spent_amount?.toFixed(2)} / ${settings.currencySymbol}${b.monthly_limit.toFixed(2)}).`
            : `You have used ${pct}% of your ${b.category_name} monthly budget (${settings.currencySymbol}${b.spent_amount?.toFixed(2)} / ${settings.currencySymbol}${b.monthly_limit.toFixed(2)}).`;

          await addAppNotification('budget', title, body, JSON.stringify({ notifKey, categoryId: b.category_id }));

          if (settings.notificationsEnabled && settings.notifyBudgets) {
            await sendLocalNotification(title, body, { type: 'budget' }, 'budgets');
          }
        }
      }
    }
  } catch (error) {
    console.error('[Notifications] Error in checkBudgetThresholds:', error);
  }
}

/**
 * Send an immediate test notification.
 */
export async function sendTestNotification(): Promise<void> {
  const title = 'Budget App Notification Active';
  const body = 'Your recurring bill reminders, balance reports, and budget alerts are working perfectly!';
  await addAppNotification('system', title, body);
  await sendLocalNotification(title, body, { type: 'system' }, 'default');
}

/**
 * Schedules native OS-level background notifications (Month-end report reminder).
 * This executes via the device's native scheduler while the app is in the background or closed.
 */
export async function scheduleBackgroundReminders(): Promise<void> {
  try {
    const settings = await getAppSettings();
    if (!settings.notificationsEnabled) return;

    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const hasMonthEnd = scheduled.some((n) => n.identifier === 'MONTH_END_REMINDER');

    if (!hasMonthEnd && settings.notifyMonthEnd) {
      await Notifications.scheduleNotificationAsync({
        identifier: 'MONTH_END_REMINDER',
        content: {
          title: 'Monthly Financial Summary Ready',
          body: 'Tap to review your month-end balance, savings rate, and category spending.',
          data: { type: 'month_end' },
          sound: true,
          ...(Platform.OS === 'android' ? { channelId: 'reports' } : {}),
        },
        trigger: {
          type: 'monthly',
          day: 28,
          hour: 20,
          minute: 0,
        } as any,
      });
    }
  } catch (e) {
    console.warn('[Notifications] Error scheduling background reminders:', e);
  }
}
