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
    console.warn("Push notifications require a physical device.");
    return null;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("messages", {
      name: "Messages",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      sound: "default",
      enableVibrate: true,
      showBadge: true,
    });
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

  console.log("Push token registered:", {
    platform: Platform.OS,
    deviceName: Device.deviceName || "TrueOps mobile",
    tokenPreview: `${token.slice(0, 24)}...`,
  });

  return token;
}
