import { Platform } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";

import { registerPushToken } from "../api/client";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotifications() {
  if (Platform.OS === "web") {
    return null;
  }

  if (!Device.isDevice) {
    return null;
  }

  const existing = await Notifications.getPermissionsAsync();
  let finalStatus = existing.status;

  if (existing.status !== "granted") {
    const requested = await Notifications.requestPermissionsAsync();
    finalStatus = requested.status;
  }

  if (finalStatus !== "granted") {
    return null;
  }

  const projectId =
    Constants?.expoConfig?.extra?.eas?.projectId ??
    Constants?.easConfig?.projectId;

  if (!projectId) {
    console.warn("Missing EAS projectId for push notifications.");
    return null;
  }

  const tokenResult = await Notifications.getExpoPushTokenAsync({
    projectId,
  });

  const token = tokenResult.data;

  await registerPushToken(
    token,
    Platform.OS,
    Device.deviceName || "TrueOps mobile"
  );

  return token;
}
