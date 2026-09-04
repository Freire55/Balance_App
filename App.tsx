import { DarkTheme, DefaultTheme, NavigationContainer } from "@react-navigation/native";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import { LogBox } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "./global.css";
import { AppProvider, useApp } from "./src/context/AppContext";
import { connectDb, initDatabase } from "./src/database/database";
import { registerBackgroundTasks } from "./src/database/tasks";
import RootNavigator from "./src/navigation/RootNavigator";
import {
  requestNotificationPermissions,
  scheduleBackgroundReminders,
  setupNotificationChannels,
} from "./src/services/notifications";

LogBox.ignoreLogs([
  "SafeAreaView has been deprecated",
  "`expo-notifications` functionality is not fully supported in Expo Go",
]);

SplashScreen.preventAutoHideAsync().catch(() => {});

function ThemedNavigation() {
  const { isDark, theme } = useApp();

  const navigationTheme = React.useMemo(() => {
    const base = isDark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        background: theme.bg,
        card: theme.card,
        text: theme.textPrimary,
        border: theme.border,
        primary: theme.primary,
      },
    };
  }, [isDark, theme]);

  return (
    <NavigationContainer theme={navigationTheme}>
      <RootNavigator />
    </NavigationContainer>
  );
}

export default function App() {
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        await connectDb();
        await initDatabase();
      } catch (error) {
        console.error("App initialization error:", error);
      } finally {
        setDbReady(true);
        await SplashScreen.hideAsync().catch(() => {});
      }

      // Non-blocking background initialization after UI is already rendered
      // Background notifications execute silently without popping up on open
      setTimeout(async () => {
        try {
          await setupNotificationChannels();
          await requestNotificationPermissions();
          await registerBackgroundTasks();
          await scheduleBackgroundReminders();
        } catch (e) {
          console.warn("Background tasks initialization note:", e);
        }
      }, 500);
    }

    prepare();
  }, []);

  if (!dbReady) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <AppProvider>
        <ThemedNavigation />
      </AppProvider>
    </SafeAreaProvider>
  );
}
