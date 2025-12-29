import { Tabs } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import "../global.css";
import NavBar from "./components/NavBar";
import { connectDb, initDatabase } from "./database/database";

export default function RootLayout() {
    const [isDbReady, setIsDbReady] = useState(false);

    useEffect(() => {
      async function initializeDatabase() {
        try {
          // 1. AWAIT the database connection
          await connectDb(); 
          
          // 2. AWAIT the table creation
          await initDatabase(); 
          
          // 3. Mark the database as ready
          setIsDbReady(true);
          console.log("Database initialized successfully.");
        } catch (error) {
          console.error("Failed to initialize database:", error);
          // Handle error state (e.g., show an error screen)
        }
      }

      initializeDatabase();
    }, []);

    // Show a loading screen while the database is being initialized
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