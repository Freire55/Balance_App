import { Tabs } from "expo-router";
import "../global.css";
import NavBar from "./components/NavBar";

export default function RootLayout() {
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
      <Tabs.Screen name="(tabs)/budget" />
      <Tabs.Screen name="(tabs)/settings" />
    </Tabs>
  );
}
