import * as Notifications from 'expo-notifications';
import { Tabs, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import "../global.css";
import NavBar from "./components/NavBar";
import { connectDb, initDatabase, resetDatabase, seedDatabase } from "./database/database";
import {
  registerForPushNotificationsAsync,
  scheduleAllNotifications
} from './notifications/notificationService';
import { processRecurringTransactions } from './utils/recurringProcessor';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function RootLayout() {
  const [isDbReady, setIsDbReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    async function initializeApp() {
      try {
        // --- Database Setup ---
        await connectDb();
        // await resetDatabase();
        await initDatabase();
        setIsDbReady(true);

        // --- Notifications Setup ---
        await registerForPushNotificationsAsync();
        await scheduleAllNotifications();

        // --- Process Recurring Transactions ---
        await processRecurringTransactions();
        
        console.log('App initialized with notifications');
      } catch (error) {
        console.error("Failed to initialize app:", error);
      }
    }

    initializeApp();
  }, []);

  // Handle notification taps to redirect user to Stats
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const screen = response.notification.request.content.data.screen as string;
      if (screen) router.push(screen as any);
    });
    return () => subscription.remove();
  }, []);

  if (!isDbReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#19E1FF" />
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: 'none' },
      }}
      tabBar={() => <NavBar />}
    >
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen name="(tabs)/home" />
      <Tabs.Screen name="(tabs)/stats" />
      <Tabs.Screen name="(tabs)/newTransaction" options={{ href: null }} />
      <Tabs.Screen name="(tabs)/history" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#071A2F',
  },
});