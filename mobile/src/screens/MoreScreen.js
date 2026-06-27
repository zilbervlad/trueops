import { useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import AdminScreen from "./AdminScreen";
import { colors, radius, spacing } from "../styles/theme";

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

function openUrl(url) {
  Linking.openURL(url);
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

export default function MoreScreen({ context, onLogout }) {
  const [activeScreen, setActiveScreen] = useState("menu");
  const user = context?.user;

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

        <Pressable style={styles.logoutButton} onPress={onLogout}>
          <Text style={styles.logoutText}>Log Out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  page: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: 110 },
  header: { marginBottom: spacing.md },
  kicker: { color: colors.primary, fontSize: 11, fontWeight: "900", letterSpacing: 1.1 },
  title: { fontSize: 32, fontWeight: "900", color: colors.text, letterSpacing: -1, marginTop: 2 },
  subtitle: { color: colors.muted, fontWeight: "800", marginTop: 4 },
  profileCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 17,
    backgroundColor: colors.primaryTint,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: colors.primaryDark, fontWeight: "900", fontSize: 18 },
  profileBody: { flex: 1 },
  profileName: { color: colors.text, fontSize: 18, fontWeight: "900" },
  profileMeta: { color: colors.muted, fontWeight: "800", marginTop: 3 },
  sectionTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  menuCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  dangerCard: {
    backgroundColor: colors.dangerSoft,
    borderColor: "#fecaca",
  },
  menuTextWrap: { flex: 1, paddingRight: spacing.sm },
  menuTitle: { color: colors.text, fontSize: 17, fontWeight: "900" },
  dangerTitle: { color: colors.danger },
  menuText: { color: colors.muted, fontWeight: "800", marginTop: 3, lineHeight: 18 },
  chevron: { color: colors.faint, fontSize: 30, fontWeight: "700" },
  logoutButton: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.xl,
    paddingVertical: 15,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#fecaca",
    marginTop: spacing.md,
  },
  logoutText: {
    color: colors.danger,
    fontWeight: "900",
    fontSize: 16,
  },
});
