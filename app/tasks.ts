import * as BackgroundFetch from 'expo-background-fetch';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { getMonthlyTotal } from './database/database';

export const MONTHLY_STATS_TASK = 'MONTHLY_STATS_TASK';

TaskManager.defineTask(MONTHLY_STATS_TASK, async () => {
  try {
    const now = new Date();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const year = now.getFullYear().toString();

    const totalBalance = await getMonthlyTotal(month, year);

    const isEndOfMonth = now.getDate() >= 30; 

    if (isEndOfMonth) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "📅 Month-End Summary",
          body: `You're finishing December with a balance of ${totalBalance.toFixed(2)}€. Tap to see your report!`,
          data: { screen: 'stats' },
        },
        trigger: null, 
      });
    }

    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});


