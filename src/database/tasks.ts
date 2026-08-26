import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { getPeriodSummary } from './database';

export const MONTHLY_STATS_TASK = 'MONTHLY_STATS_TASK';

TaskManager.defineTask(MONTHLY_STATS_TASK, async () => {
  try {
    const now = new Date();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const year = now.getFullYear().toString();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    const startDate = `${year}-${month}-01T00:00:00.000Z`;
    const endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}T23:59:59.999Z`;

    const summary = await getPeriodSummary(startDate, endDate);

    const isEndOfMonth = now.getDate() >= 28;

    if (isEndOfMonth) {
      console.log(`[Monthly Task] Net Cash Flow: ${summary.netBalance.toFixed(2)} (Savings Rate: ${summary.savingsRate}%)`);
    }

    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.error('Background task error:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});
