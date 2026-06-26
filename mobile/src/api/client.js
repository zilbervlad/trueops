import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "trueops_mobile_token";

// iOS simulator / local web default.
// For physical phone testing later, change this to http://YOUR_MAC_IP:5000
export const API_BASE_URL = "http://127.0.0.1:5000";

function isWeb() {
  return Platform.OS === "web";
}

export async function getToken() {
  if (isWeb()) {
    return window.localStorage.getItem(TOKEN_KEY);
  }

  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function saveToken(token) {
  if (isWeb()) {
    window.localStorage.setItem(TOKEN_KEY, token);
    return;
  }

  return SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken() {
  if (isWeb()) {
    window.localStorage.removeItem(TOKEN_KEY);
    return;
  }

  return SecureStore.deleteItemAsync(TOKEN_KEY);
}

async function request(path, options = {}) {
  const token = await getToken();

  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const text = await response.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { success: false, error: text || "Invalid server response." };
  }

  if (!response.ok) {
    const error = new Error(data?.error || `Request failed with ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export async function login(username, password) {
  const data = await request("/api/mobile/login", {
    method: "POST",
    body: JSON.stringify({
      username,
      password,
      platform: Platform.OS,
      device_name: "TrueOps mobile",
    }),
  });

  if (data?.token) {
    await saveToken(data.token);
  }

  return data;
}

export async function loadMe() {
  return request("/api/mobile/me");
}

export async function logout() {
  try {
    await request("/api/mobile/logout", { method: "POST" });
  } finally {
    await clearToken();
  }
}
