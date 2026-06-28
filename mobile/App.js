import "react-native-gesture-handler";

import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { StatusBar } from "expo-status-bar";

import { loadMe, logout } from "./src/api/client";
import HomeScreen from "./src/screens/HomeScreen";
import LoginScreen from "./src/screens/LoginScreen";
import MessagesScreen from "./src/screens/MessagesScreen";
import MoreScreen from "./src/screens/MoreScreen";
import OpsScreen from "./src/screens/OpsScreen";
import { colors } from "./src/styles/theme";
import { registerForPushNotifications } from "./src/services/push";

const Tab = createBottomTabNavigator();

export default function App() {
  const [booting, setBooting] = useState(true);
  const [context, setContext] = useState(null);

  useEffect(() => {
    async function boot() {
      try {
        const data = await loadMe();
        setContext(data.context);

        try {
          await registerForPushNotifications();
        } catch {
          // Push is helpful, not required for app startup.
        }
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
        <LoginScreen
          onLogin={async (nextContext) => {
            setContext(nextContext);

            try {
              await registerForPushNotifications();
            } catch {
              // Push is helpful, not required for login.
            }
          }}
        />
      </>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            headerShown: false,
            tabBarActiveTintColor: colors.primary,
            tabBarInactiveTintColor: colors.faint,
            tabBarStyle: {
              height: 78,
              paddingTop: 8,
              paddingBottom: 14,
              borderTopColor: colors.borderSoft,
              borderTopWidth: 1,
              backgroundColor: colors.card,
              shadowColor: colors.shadow,
              shadowOpacity: 0.07,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: -7 },
              elevation: 8,
            },
            tabBarItemStyle: {
              paddingVertical: 3,
            },
            tabBarLabelStyle: {
              fontSize: 11,
              fontWeight: "900",
              letterSpacing: 0.1,
              marginTop: 2,
            },
            tabBarIcon: ({ color, focused }) => {
              const icons = {
                Home: "H",
                Messages: "M",
                Ops: "O",
                More: "•",
              };

              return (
                <View style={[styles.tabIcon, focused && styles.tabIconActive]}>
                  <Text style={[styles.tabIconText, { color }]}>{icons[route.name] || "•"}</Text>
                </View>
              );
            },
          })}
        >
          <Tab.Screen name="Home">
            {({ navigation }) => <HomeScreen context={context} navigation={navigation} />}
          </Tab.Screen>

          <Tab.Screen name="Messages" component={MessagesScreen} />
          <Tab.Screen name="Ops" component={OpsScreen} />

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
  tabIcon: {
    minWidth: 30,
    height: 24,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  tabIconActive: {
    backgroundColor: colors.primarySoft,
  },
  tabIconText: {
    fontSize: 12,
    fontWeight: "900",
  },
});
