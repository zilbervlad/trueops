import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "trueops_mobile_token";

const LOCAL_API_BASE_URL = "http://127.0.0.1:5000";
const PROD_API_BASE_URL = "https://true-ops.net";

// Local web uses Flask on your Mac.
// Native preview/production builds use the production TrueOps domain.
export const API_BASE_URL = Platform.OS === "web"
  ? LOCAL_API_BASE_URL
  : PROD_API_BASE_URL;

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

export async function request(path, options = {}) {
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

export async function loadThreads() {
  return request("/api/mobile/messages/threads");
}

export async function loadThread(threadId) {
  return request(`/api/mobile/messages/threads/${threadId}`);
}

export async function sendThreadMessage(threadId, body) {
  return request(`/api/mobile/messages/threads/${threadId}/messages`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
}

export async function deleteThreadMessage(threadId, messageId) {
  return request(`/api/mobile/messages/threads/${threadId}/messages/${messageId}/delete`, {
    method: "POST",
  });
}

export async function markThreadRead(threadId) {
  return request(`/api/mobile/messages/threads/${threadId}/read`, {
    method: "POST",
  });
}

export async function loadMessagePeople() {
  return request("/api/mobile/messages/people");
}

export async function createDirectThread(recipientUserId) {
  return request("/api/mobile/messages/direct", {
    method: "POST",
    body: JSON.stringify({ recipient_user_id: recipientUserId }),
  });
}

export async function ensureDefaultMessageThreads() {
  return request("/api/mobile/messages/threads/ensure-defaults", {
    method: "POST",
  });
}

export async function hideThread(threadId) {
  return request(`/api/mobile/messages/threads/${threadId}/hide`, {
    method: "POST",
  });
}

export async function registerPushToken(pushToken, platform, deviceName) {
  return request("/api/mobile/push-token", {
    method: "POST",
    body: JSON.stringify({
      token: pushToken,
      platform,
      device_name: deviceName,
    }),
  });
}


export async function fetchChecklistStores() {
  return request("/api/mobile/checklist/stores");
}

export async function fetchTodayChecklist(storeNumber) {
  const query = storeNumber ? `?store_number=${encodeURIComponent(storeNumber)}` : "";
  return request(`/api/mobile/checklist/today${query}`);
}

export async function toggleChecklistItem(itemId, payload) {
  return request(`/api/mobile/checklist/items/${itemId}/toggle`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function saveChecklistManager(payload) {
  return request("/api/mobile/checklist/manager", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}


export async function fetchSvrStores() {
  return request("/api/mobile/svr/stores");
}

export async function fetchSvrTemplate(storeNumber) {
  const query = storeNumber ? `?store_number=${encodeURIComponent(storeNumber)}` : "";
  return request(`/api/mobile/svr/template${query}`);
}

export async function createSvrReport(payload) {
  return request("/api/mobile/svr/reports", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchRecentSvrReports() {
  return request("/api/mobile/svr/reports/recent");
}


export async function fetchMaintenanceStores() {
  return request("/api/mobile/maintenance/stores");
}

export async function fetchMaintenanceTickets(params = {}) {
  const query = new URLSearchParams();

  if (params.status) query.set("status", params.status);
  if (params.store_number) query.set("store_number", params.store_number);

  const suffix = query.toString() ? `?${query.toString()}` : "";
  return request(`/api/mobile/maintenance/tickets${suffix}`);
}

export async function createMaintenanceTicket(payload) {
  return request("/api/mobile/maintenance/tickets", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateMaintenanceTicketStatus(ticketId, status) {
  return request(`/api/mobile/maintenance/tickets/${ticketId}/status`, {
    method: "POST",
    body: JSON.stringify({ status }),
  });
}

export async function updateMaintenanceTicket(ticketId, payload) {
  return request(`/api/mobile/maintenance/tickets/${ticketId}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchMobileAdminUsers() {
  return request("/api/mobile/admin/users");
}

export async function updateMobileAdminUser(userId, payload) {
  return request(`/api/mobile/admin/users/${userId}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function ensureMobileAdminDefaultThreads() {
  return request("/api/mobile/admin/messages/ensure-defaults", {
    method: "POST",
  });
}

export async function fetchChecklistHeatmap(date) {
  const query = date ? `?date=${encodeURIComponent(date)}` : "";
  return request(`/api/mobile/checklist/heatmap${query}`);
}

export async function fetchAdminCompanies() {
  return request("/api/mobile/admin/companies");
}

export async function switchAdminCompany(companyId) {
  return request("/api/mobile/admin/companies/switch", {
    method: "POST",
    body: JSON.stringify({ company_id: companyId }),
  });
}
