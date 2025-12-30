import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getMonthlyTotal, getYearlyTotal } from '../database/database';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#3B82F6',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return;
    }
  } else {
    console.log('Must use physical device for Push Notifications');
  }

  return token;
}

// Schedule end of month notification
export async function scheduleEndOfMonthNotification() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
  
  const triggerDate = new Date(year, month, lastDayOfMonth, 20, 0, 0);
  
  // If we're past that date this month, schedule for next month
  if (now > triggerDate) {
    const nextMonth = month + 1;
    const nextYear = nextMonth > 11 ? year + 1 : year;
    const adjustedMonth = nextMonth > 11 ? 0 : nextMonth;
    const lastDayNextMonth = new Date(nextYear, adjustedMonth + 1, 0).getDate();
    triggerDate.setFullYear(nextYear);
    triggerDate.setMonth(adjustedMonth);
    triggerDate.setDate(lastDayNextMonth);
  }

  try {
    const monthStr = (month + 1).toString().padStart(2, '0');
    const yearStr = year.toString();
    const total = await getMonthlyTotal(monthStr, yearStr);
    
    let secondsUntilTrigger = Math.floor((triggerDate.getTime() - now.getTime()) / 1000);
    
    // Ensure minimum 60 seconds delay to prevent immediate triggers
    if (secondsUntilTrigger < 60) {
      console.log('Trigger too soon, rescheduling for next month');
      return;
    }
    
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '📊 Monthly Summary Ready!',
        body: `${getMonthName(month)} is ending. Your balance: €${total.toFixed(2)}. Tap to view stats.`,
        data: { screen: '(tabs)/stats' },
      },
      trigger: {
        seconds: secondsUntilTrigger,
        channelId: 'default',
      },
    });
    
    console.log(`End of month notification scheduled for ${triggerDate.toLocaleDateString()} at ${triggerDate.toLocaleTimeString()}`);
  } catch (error) {
    console.error('Error scheduling end of month notification:', error);
  }
}

// Schedule end of year notification
export async function scheduleEndOfYearNotification() {
  const now = new Date();
  const year = now.getFullYear();
  
  const triggerDate = new Date(year, 11, 31, 20, 0, 0);
  
  if (now > triggerDate) {
    triggerDate.setFullYear(year + 1);
  }

  try {
    const yearStr = year.toString();
    const total = await getYearlyTotal(yearStr);
    
    let secondsUntilTrigger = Math.floor((triggerDate.getTime() - now.getTime()) / 1000);
    
    // Ensure minimum 60 seconds delay to prevent immediate triggers
    if (secondsUntilTrigger < 60) {
      console.log('Trigger too soon, rescheduling for next year');
      return;
    }
    
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🎉 Year End Summary!',
        body: `${year} is ending! Your yearly balance: €${total.toFixed(2)}. Check your full stats!`,
        data: { screen: '(tabs)/stats' },
      },
      trigger: {
        seconds: secondsUntilTrigger,
        channelId: 'default',
      },
    });
    
    console.log(`End of year notification scheduled for ${triggerDate.toLocaleDateString()} at ${triggerDate.toLocaleTimeString()}`);
  } catch (error) {
    console.error('Error scheduling end of year notification:', error);
  }
}

// Cancel all scheduled notifications
export async function cancelAllNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
  console.log('All notifications cancelled');
}

// Get all scheduled notifications
export async function getScheduledNotifications() {
  return await Notifications.getAllScheduledNotificationsAsync();
}

// Helper function to get month name
function getMonthName(monthIndex: number): string {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return months[monthIndex];
}

// Schedule both monthly and yearly notifications
export async function scheduleAllNotifications() {
  await cancelAllNotifications();
  await scheduleEndOfMonthNotification();
  await scheduleEndOfYearNotification();
  console.log('All notifications scheduled');
}

// Send immediate notification (for testing)
export async function sendTestNotification() {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '🧪 Test Notification',
      body: 'This is a test notification from your Budget App!',
      data: { screen: '(tabs)/stats' },
    },
    trigger: null, 
  });
}
