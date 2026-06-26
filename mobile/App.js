import "react-native-gesture-handler";

import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { StatusBar } from "expo-status-bar";

import { loadMe, logout } from "./src/api/client";
import HomeScreen from "./src/screens/HomeScreen";
import LoginScreen from "./src/screens/LoginScreen";
import MessagesScreen from "./src/screens/MessagesScreen";
import MoreScreen from "./src/screens/MoreScreen";
import OpsScreen from "./src/screens/OpsScreen";
import ReportsScreen from "./src/screens/ReportsScreen";
import { colors } from "./src/styles/theme";

const Tab = createBottomTabNavigator();

export default function App() {
  const [booting, setBooting] = useState(true);
  const [context, setContext] = useState(null);

  useEffect(() => {
    async function boot() {
      try {
        const data = await loadMe();
        setContext(data.context);
      } catch {
        setContext(null);
      } finally {
        setBooting(false);
      }
    }

    boot();
  }, []);

  async function handleLogout() {
    await logout();
    setContext(null);
  }

  if (booting) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!context) {
    return (
      <>
        <StatusBar style="dark" />
        <LoginScreen onLogin={setContext} />
      </>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: colors.primary,
            tabBarInactiveTintColor: colors.muted,
            tabBarStyle: {
              height: 86,
              paddingTop: 8,
              paddingBottom: 24,
              borderTopColor: colors.border,
            },
            tabBarLabelStyle: {
              fontSize: 12,
              fontWeight: "800",
            },
          }}
        >
          <Tab.Screen name="Home">
            {() => <HomeScreen context={context} />}
          </Tab.Screen>

          <Tab.Screen name="Messages" component={MessagesScreen} />
          <Tab.Screen name="Ops" component={OpsScreen} />
          <Tab.Screen name="Reports" component={ReportsScreen} />

          <Tab.Screen name="More">
            {() => <MoreScreen context={context} onLogout={handleLogout} />}
          </Tab.Screen>
        </Tab.Navigator>
      </NavigationContainer>
    </>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
});
