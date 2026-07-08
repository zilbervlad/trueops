import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import AdminScreen from "./AdminScreen";
import { fetchAdminCompanies, loadMe, switchAdminCompany } from "../api/client";
import { colors, spacing } from "../styles/theme";

const PUBLIC_URLS = {
  privacy: "https://true-ops.net/privacy",
  support: "https://true-ops.net/support",
  terms: "https://true-ops.net/terms",
  deleteAccount: "https://true-ops.net/delete-account",
};

function prettyRole(role) {
  return String(role || "User")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function isAdmin(user) {
  const role = String(user?.role || "").toLowerCase();
  return role === "admin" || role === "platform_admin";
}

function isPlatformAdmin(user) {
  return String(user?.role || "").toLowerCase() === "platform_admin";
}

function openUrl(url) {
  Linking.openURL(url);
}

function confirmSignOut(onLogout) {
  Alert.alert(
    "Sign out?",
    "You will return to the TrueOps login screen.",
    [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: onLogout,
      },
    ]
  );
}

function MenuCard({ title, text, onPress, danger = false }) {
  return (
    <Pressable style={[styles.menuCard, danger && styles.dangerCard]} onPress={onPress}>
      <View style={styles.menuTextWrap}>
        <Text style={[styles.menuTitle, danger && styles.dangerTitle]}>{title}</Text>
        <Text style={styles.menuText}>{text}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

export default function MoreScreen({ context, onLogout, onContextChange }) {
  const [activeScreen, setActiveScreen] = useState("menu");
  const [companies, setCompanies] = useState([]);
  const [companiesLoading, setCompaniesLoading] = useState(false);
  const [companiesError, setCompaniesError] = useState("");
  const [switchingCompanyId, setSwitchingCompanyId] = useState(null);
  const user = context?.user;

  async function loadCompanies() {
    if (!isPlatformAdmin(user)) return;

    try {
      setCompaniesLoading(true);
      setCompaniesError("");
      const data = await fetchAdminCompanies();
      setCompanies(data.companies || []);
    } catch (err) {
      setCompaniesError(err.message || "Could not load companies.");
    } finally {
      setCompaniesLoading(false);
    }
  }

  async function handleSwitchCompany(company) {
    if (!company?.id || company.id === user?.company_id || switchingCompanyId) return;

    try {
      setSwitchingCompanyId(company.id);
      await switchAdminCompany(company.id);
      const data = await loadMe();

      if (onContextChange) {
        onContextChange(data.context);
      }

      Alert.alert("Company switched", `Now viewing ${company.name}.`);
    } catch (err) {
      Alert.alert("Could not switch company", err.message || "Please try again.");
    } finally {
      setSwitchingCompanyId(null);
    }
  }

  useEffect(() => {
    loadCompanies();
  }, [user?.id, user?.company_id, user?.role]);

  if (activeScreen === "admin") {
    return <AdminScreen onBack={() => setActiveScreen("menu")} />;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.page} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.kicker}>TRUEOPS</Text>
          <Text style={styles.title}>More</Text>
          <Text style={styles.subtitle}>Account, access, support, and legal.</Text>
        </View>

        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(user?.name || "U").slice(0, 1).toUpperCase()}</Text>
          </View>

          <View style={styles.profileBody}>
            <Text style={styles.profileName}>{user?.name}</Text>
            <Text style={styles.profileMeta}>{prettyRole(user?.role)} · @{user?.username}</Text>
          </View>
        </View>

        {isPlatformAdmin(user) && (
          <>
            <Text style={styles.sectionTitle}>Company Switcher</Text>

            <View style={styles.companyCard}>
              {companiesLoading ? (
                <View style={styles.companyLoadingRow}>
                  <ActivityIndicator color={colors.primary} />
                  <Text style={styles.companyLoadingText}>Loading companies…</Text>
                </View>
              ) : companiesError ? (
                <View style={styles.companyLoadingRow}>
                  <Text style={styles.companyErrorText}>{companiesError}</Text>
                </View>
              ) : companies.length === 0 ? (
                <View style={styles.companyLoadingRow}>
                  <Text style={styles.companyLoadingText}>No companies available.</Text>
                </View>
              ) : (
                companies.map((company) => {
                  const active = company.id === user?.company_id;
                  const switching = switchingCompanyId === company.id;

                  return (
                    <Pressable
                      key={company.id}
                      style={[styles.companyRow, active && styles.companyRowActive]}
                      onPress={() => handleSwitchCompany(company)}
                      disabled={active || switchingCompanyId}
                    >
                      <View style={styles.companyTextWrap}>
                        <Text style={[styles.companyName, active && styles.companyNameActive]}>
                          {company.name}
                        </Text>
                        <Text style={styles.companySlug}>
                          {company.slug || `company-${company.id}`}
                        </Text>
                      </View>

                      <Text style={[styles.companyStatus, active && styles.companyStatusActive]}>
                        {switching ? "Switching…" : active ? "Active" : "Switch"}
                      </Text>
                    </Pressable>
                  );
                })
              )}
            </View>
          </>
        )}

        {isAdmin(user) && (
          <>
            <Text style={styles.sectionTitle}>Admin</Text>
            <MenuCard
              title="Admin Center"
              text="Manage users and refresh default chats."
              onPress={() => setActiveScreen("admin")}
            />
          </>
        )}

        <Text style={styles.sectionTitle}>Help & Legal</Text>

        <MenuCard
          title="Support"
          text="Get help with login, access, messages, and operations tools."
          onPress={() => openUrl(PUBLIC_URLS.support)}
        />

        <MenuCard
          title="Privacy Policy"
          text="See how TrueOps handles account, device, and operational data."
          onPress={() => openUrl(PUBLIC_URLS.privacy)}
        />

        <MenuCard
          title="Terms of Use"
          text="Review the rules for authorized TrueOps access."
          onPress={() => openUrl(PUBLIC_URLS.terms)}
        />

        <MenuCard
          title="Delete Account"
          text="Request permanent deletion of your TrueOps account."
          onPress={() => openUrl(PUBLIC_URLS.deleteAccount)}
          danger
        />

        <Pressable style={styles.logoutButton} onPress={() => confirmSignOut(onLogout)}>
          <Text style={styles.logoutText}>Sign Out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.navy },
  page: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 96 },
  header: { marginBottom: 12 },
  kicker: { color: colors.primarySoft, fontSize: 11, fontWeight: "900", letterSpacing: 1.1 },
  title: { fontSize: 28, fontWeight: "900", color: "#ffffff", letterSpacing: -0.8, marginTop: 1 },
  subtitle: { color: "#94a3b8", fontWeight: "800", marginTop: 3, fontSize: 13 },
  profileCard: {
    backgroundColor: colors.card,
    borderRadius: 22,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 15,
    backgroundColor: colors.primaryTint,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: colors.primaryDark, fontWeight: "900", fontSize: 16 },
  profileBody: { flex: 1 },
  profileName: { color: colors.text, fontSize: 16, fontWeight: "900" },
  profileMeta: { color: colors.muted, fontWeight: "800", marginTop: 2, fontSize: 12 },
  sectionTitle: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 8,
    marginTop: 10,
  },

  companyCard: {
    backgroundColor: colors.card,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    overflow: "hidden",
    marginBottom: 8,
  },
  companyLoadingRow: {
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  companyLoadingText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "800",
  },
  companyRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  companyRowActive: {
    backgroundColor: colors.primaryTint,
  },
  companyTextWrap: {
    flex: 1,
  },
  companyName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900",
  },
  companyNameActive: {
    color: colors.primaryDark,
  },
  companySlug: {
    color: colors.faint,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 2,
  },
  companyStatus: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900",
  },
  companyStatusActive: {
    color: colors.primaryDark,
  },

  menuCard: {
    backgroundColor: colors.card,
    borderRadius: 21,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  dangerCard: {
    backgroundColor: colors.dangerSoft,
    borderColor: "#fecaca",
  },
  menuTextWrap: { flex: 1, paddingRight: spacing.sm },
  menuTitle: { color: colors.text, fontSize: 15, fontWeight: "900" },
  dangerTitle: { color: colors.danger },
  menuText: { color: colors.muted, fontWeight: "800", marginTop: 2, lineHeight: 16, fontSize: 12 },
  chevron: { color: colors.faint, fontSize: 24, fontWeight: "700" },
  logoutButton: {
    backgroundColor: colors.dangerSoft,
    borderRadius: 21,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#fecaca",
    marginTop: 12,
  },
  logoutText: {
    color: colors.danger,
    fontWeight: "900",
    fontSize: 15,
  },
});
