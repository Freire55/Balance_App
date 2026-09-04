import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import {
  checkAndSendEndOfMonthSummary,
  checkAndSendEndOfYearSummary,
  checkBudgetThresholds,
} from '../services/notifications';
import { processRecurringTransactions } from './recurringEngine';

export const FINANCE_BACKGROUND_SYNC_TASK = 'FINANCE_BACKGROUND_SYNC_TASK';
export const MONTHLY_STATS_TASK = FINANCE_BACKGROUND_SYNC_TASK; // Alias

TaskManager.defineTask(FINANCE_BACKGROUND_SYNC_TASK, async () => {
  try {
    console.log('[BackgroundTasks] Running background finance sync...');
    
    // 1. Process recurring payments & bill notifications
    await processRecurringTransactions();

    // 2. Check End-of-Month summary
    await checkAndSendEndOfMonthSummary();

    // 3. Check End-of-Year review
    await checkAndSendEndOfYearSummary();

    // 4. Check category budget thresholds
    await checkBudgetThresholds();

    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.error('[BackgroundTasks] Error during background task execution:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

/**
 * Register background synchronization task on app boot.
 */
export async function registerBackgroundTasks(): Promise<void> {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(FINANCE_BACKGROUND_SYNC_TASK);
    if (!isRegistered) {
      await BackgroundFetch.registerTaskAsync(FINANCE_BACKGROUND_SYNC_TASK, {
        minimumInterval: 60 * 60 * 6, // 6 hours interval
        stopOnTerminate: false,
        startOnBoot: true,
      });
      console.log('[BackgroundTasks] Registered FINANCE_BACKGROUND_SYNC_TASK successfully.');
    }
  } catch (error) {
    console.warn('[BackgroundTasks] Background fetch registration note:', error);
  }
}
