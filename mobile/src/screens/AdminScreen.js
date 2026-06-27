import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  ensureMobileAdminDefaultThreads,
  fetchMobileAdminUsers,
  updateMobileAdminUser,
} from "../api/client";
import { colors, radius, spacing } from "../styles/theme";

function pretty(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function UserCard({ user, onPress }) {
  return (
    <TouchableOpacity style={styles.userCard} onPress={() => onPress(user)} activeOpacity={0.86}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{(user.name || user.username || "U").slice(0, 1).toUpperCase()}</Text>
      </View>

      <View style={styles.userBody}>
        <View style={styles.userTopRow}>
          <Text style={styles.userName} numberOfLines={1}>{user.name}</Text>
          {!user.is_active && (
            <View style={styles.inactivePill}>
              <Text style={styles.inactiveText}>Inactive</Text>
            </View>
          )}
        </View>

        <Text style={styles.userMeta} numberOfLines={1}>
          {pretty(user.role)} · {user.store_number ? `Store ${user.store_number}` : user.area_name || "All access"}
        </Text>

        <Text style={styles.username} numberOfLines={1}>@{user.username}</Text>
      </View>

      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

function UserEditor({ visible, user, stores, areas, roles, onClose, onSave }) {
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible && user) {
      setDraft({
        name: user.name || "",
        username: user.username || "",
        role: user.role || "manager",
        area_name: user.area_name || "",
        store_number: user.store_number || "",
        email: user.email || "",
        notification_email: user.notification_email || "",
        email_enabled: !!user.email_enabled,
        is_active: !!user.is_active,
        password: "",
      });
    }
  }, [visible, user]);

  if (!visible || !user || !draft) return null;

  const role = draft.role;
  const needsArea = role === "supervisor";
  const needsStore = role === "manager";

  async function save() {
    setSaving(true);

    try {
      await onSave(user.id, draft);
      onClose();
    } catch {
      // Parent handles alert.
    } finally {
      setSaving(false);
    }
  }

  function patch(field, value) {
    setDraft((current) => ({
      ...current,
      [field]: value,
    }));
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.safe}>
        <ScrollView style={styles.content}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.kicker}>ADMIN EDIT</Text>
              <Text style={styles.title}>User</Text>
              <Text style={styles.subtitle}>{user.name}</Text>
            </View>

            <TouchableOpacity style={styles.backButton} onPress={onClose}>
              <Text style={styles.backButtonText}>Close</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.label}>Name</Text>
            <TextInput value={draft.name} onChangeText={(v) => patch("name", v)} style={styles.input} />

            <Text style={styles.label}>Username</Text>
            <TextInput
              value={draft.username}
              onChangeText={(v) => patch("username", v)}
              autoCapitalize="none"
              style={styles.input}
            />

            <Text style={styles.label}>Role</Text>
            <View style={styles.choiceWrap}>
              {roles.map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[styles.choicePill, draft.role === option && styles.choicePillActive]}
                  onPress={() => {
                    patch("role", option);
                    if (option !== "supervisor") patch("area_name", "");
                    if (option !== "manager") patch("store_number", "");
                  }}
                  activeOpacity={0.86}
                >
                  <Text style={[styles.choiceText, draft.role === option && styles.choiceTextActive]}>
                    {pretty(option)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {needsArea && (
              <>
                <Text style={styles.label}>Area</Text>
                <View style={styles.choiceWrap}>
                  {areas.map((area) => (
                    <TouchableOpacity
                      key={area}
                      style={[styles.choicePill, draft.area_name === area && styles.choicePillActive]}
                      onPress={() => patch("area_name", area)}
                    >
                      <Text style={[styles.choiceText, draft.area_name === area && styles.choiceTextActive]}>
                        {area}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {needsStore && (
              <>
                <Text style={styles.label}>Store</Text>
                <View style={styles.choiceWrap}>
                  {stores.map((store) => (
                    <TouchableOpacity
                      key={`${store.company_id}-${store.store_number}`}
                      style={[styles.choicePill, draft.store_number === store.store_number && styles.choicePillActive]}
                      onPress={() => patch("store_number", store.store_number)}
                    >
                      <Text style={[styles.choiceText, draft.store_number === store.store_number && styles.choiceTextActive]}>
                        {store.store_number}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            <Text style={styles.label}>Email</Text>
            <TextInput
              value={draft.email}
              onChangeText={(v) => patch("email", v)}
              autoCapitalize="none"
              keyboardType="email-address"
              style={styles.input}
            />

            <Text style={styles.label}>Notification email</Text>
            <TextInput
              value={draft.notification_email}
              onChangeText={(v) => patch("notification_email", v)}
              autoCapitalize="none"
              keyboardType="email-address"
              style={styles.input}
            />

            <Text style={styles.label}>New password</Text>
            <TextInput
              value={draft.password}
              onChangeText={(v) => patch("password", v)}
              secureTextEntry
              placeholder="Leave blank to keep current"
              placeholderTextColor={colors.faint}
              style={styles.input}
            />

            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[styles.togglePill, draft.email_enabled && styles.togglePillActive]}
                onPress={() => patch("email_enabled", !draft.email_enabled)}
              >
                <Text style={[styles.toggleText, draft.email_enabled && styles.toggleTextActive]}>
                  Email {draft.email_enabled ? "On" : "Off"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.togglePill, draft.is_active && styles.togglePillActive]}
                onPress={() => patch("is_active", !draft.is_active)}
              >
                <Text style={[styles.toggleText, draft.is_active && styles.toggleTextActive]}>
                  {draft.is_active ? "Active" : "Inactive"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.submitButton, saving && styles.submitButtonDisabled]}
            onPress={save}
            disabled={saving}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Save User</Text>}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

export default function AdminScreen({ onBack }) {
  const [users, setUsers] = useState([]);
  const [stores, setStores] = useState([]);
  const [areas, setAreas] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [savingThreads, setSavingThreads] = useState(false);
  const [search, setSearch] = useState("");

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;

    return users.filter((user) =>
      [
        user.name,
        user.username,
        user.role,
        user.store_number,
        user.area_name,
        user.email,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [users, search]);

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const data = await fetchMobileAdminUsers();
      setUsers(data.users || []);
      setStores(data.stores || []);
      setAreas(data.areas || []);
      setRoles(data.roles || []);
    } catch (error) {
      Alert.alert("Admin", error.message || "Could not load admin center.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function saveUser(userId, payload) {
    try {
      const data = await updateMobileAdminUser(userId, payload);
      setUsers((current) =>
        current.map((user) => (user.id === userId ? data.user : user))
      );
    } catch (error) {
      Alert.alert("Admin", error.message || "Could not save user.");
      throw error;
    }
  }

  async function refreshDefaultThreads() {
    setSavingThreads(true);

    try {
      const data = await ensureMobileAdminDefaultThreads();
      Alert.alert("Messages", `Default chats refreshed. Created: ${data.created || 0}, Updated: ${data.updated || 0}`);
    } catch (error) {
      Alert.alert("Messages", error.message || "Could not refresh default chats.");
    } finally {
      setSavingThreads(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.kicker}>TRUEOPS ADMIN</Text>
            <Text style={styles.title}>Admin Center</Text>
            <Text style={styles.subtitle}>Manage users and refresh mobile chat groups.</Text>
          </View>

          {onBack && (
            <TouchableOpacity style={styles.backButton} onPress={onBack}>
              <Text style={styles.backButtonText}>More</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.heroCard}>
          <View>
            <Text style={styles.heroKicker}>Users</Text>
            <Text style={styles.heroNumber}>{users.length}</Text>
            <Text style={styles.heroText}>visible admin users</Text>
          </View>

          <TouchableOpacity
            style={styles.heroButton}
            onPress={refreshDefaultThreads}
            disabled={savingThreads}
          >
            <Text style={styles.heroButtonText}>
              {savingThreads ? "Refreshing..." : "Refresh Chats"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchCard}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search users, role, store..."
            placeholderTextColor={colors.faint}
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Users</Text>
          <Text style={styles.sectionMeta}>{filteredUsers.length} shown</Text>
        </View>

        {loading ? (
          <View style={styles.stateCard}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.stateText}>Loading admin center…</Text>
          </View>
        ) : (
          filteredUsers.map((user) => (
            <UserCard key={user.id} user={user} onPress={setSelectedUser} />
          ))
        )}
      </ScrollView>

      <UserEditor
        visible={!!selectedUser}
        user={selectedUser}
        stores={stores}
        areas={areas}
        roles={roles}
        onClose={() => setSelectedUser(null)}
        onSave={saveUser}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: 110 },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  headerText: { flex: 1 },
  kicker: { color: colors.primary, fontSize: 11, fontWeight: "900", letterSpacing: 1.1 },
  title: { color: colors.text, fontSize: 32, fontWeight: "900", letterSpacing: -1, marginTop: 2 },
  subtitle: { color: colors.muted, marginTop: 4, fontWeight: "700", lineHeight: 19 },
  backButton: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.lg,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  backButtonText: { color: colors.text, fontWeight: "900" },
  heroCard: {
    backgroundColor: colors.navy,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  heroKicker: { color: colors.navySoft, fontSize: 11, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1 },
  heroNumber: { color: "#fff", fontSize: 42, fontWeight: "900", letterSpacing: -1.2 },
  heroText: { color: colors.navySoft, fontWeight: "800", marginTop: -2 },
  heroButton: {
    backgroundColor: "#fff",
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  heroButtonText: { color: colors.text, fontWeight: "900" },
  searchCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.xl,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  searchInput: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontWeight: "800",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  sectionTitle: { color: colors.text, fontSize: 21, fontWeight: "900", letterSpacing: -0.4 },
  sectionMeta: { color: colors.muted, fontSize: 12, fontWeight: "900" },
  userCard: {
    backgroundColor: colors.card,
    borderColor: colors.borderSoft,
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: colors.primaryTint,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: colors.primaryDark, fontWeight: "900" },
  userBody: { flex: 1 },
  userTopRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  userName: { flex: 1, color: colors.text, fontSize: 16, fontWeight: "900" },
  userMeta: { color: colors.muted, fontWeight: "800", marginTop: 3 },
  username: { color: colors.faint, fontSize: 12, fontWeight: "800", marginTop: 3 },
  inactivePill: { backgroundColor: colors.dangerSoft, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 4 },
  inactiveText: { color: colors.danger, fontSize: 10, fontWeight: "900" },
  chevron: { color: colors.faint, fontSize: 28, fontWeight: "700" },
  stateCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.sm,
  },
  stateText: { color: colors.muted, fontWeight: "800", textAlign: "center" },
  formCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  label: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.borderSoft,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 13,
    paddingVertical: 11,
    color: colors.text,
    fontWeight: "800",
    marginBottom: spacing.md,
    minHeight: 44,
  },
  choiceWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  choicePill: {
    backgroundColor: colors.surface,
    borderColor: colors.borderSoft,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  choicePillActive: { backgroundColor: colors.text, borderColor: colors.text },
  choiceText: { color: colors.text, fontSize: 12, fontWeight: "900" },
  choiceTextActive: { color: "#fff" },
  toggleRow: { flexDirection: "row", gap: spacing.sm },
  togglePill: {
    flex: 1,
    backgroundColor: colors.surface,
    borderColor: colors.borderSoft,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingVertical: 12,
    alignItems: "center",
  },
  togglePillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  toggleText: { color: colors.text, fontWeight: "900" },
  toggleTextActive: { color: "#fff" },
  submitButton: {
    backgroundColor: colors.text,
    borderRadius: radius.lg,
    paddingVertical: 16,
    alignItems: "center",
  },
  submitButtonDisabled: { opacity: 0.7 },
  submitButtonText: { color: "#fff", fontSize: 16, fontWeight: "900" },
});
