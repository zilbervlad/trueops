import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, radius } from "../styles/theme";

function prettyRole(role) {
  return String(role || "User")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function HomeScreen({ context }) {
  const user = context?.user;
  const company = context?.company;
  const stores = context?.stores || [];
  const modules = context?.modules || [];

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        style={styles.page}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.kicker}>TRUEOPS MOBILE</Text>
            <Text style={styles.title} numberOfLines={1}>
              {user?.name || "Welcome"}
            </Text>
          </View>

          <View style={styles.badge}>
            <Text style={styles.badgeText}>{prettyRole(user?.role)}</Text>
          </View>
        </View>

        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>{company?.name || "Company"}</Text>
          <Text style={styles.heroTitle}>Run the day from here.</Text>
          <Text style={styles.heroText}>
            Messages, checklists, reports, and store follow-up built for the floor — not a desktop squeezed onto a phone.
          </Text>
        </View>

        <View style={styles.grid}>
          <View style={styles.metricCard}>
            <Text style={styles.metricNumber}>{stores.length}</Text>
            <Text style={styles.metricLabel}>Visible stores</Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricNumber}>{modules.filter((item) => item.enabled).length}</Text>
            <Text style={styles.metricLabel}>Active tools</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Today</Text>

          <View style={styles.actionCard}>
            <View style={styles.dot} />
            <View style={styles.actionTextWrap}>
              <Text style={styles.actionTitle}>Messages are live</Text>
              <Text style={styles.actionText}>
                Company, role, store, area, and direct chats are connected to TrueOps.
              </Text>
            </View>
          </View>

          <View style={styles.actionCard}>
            <View style={[styles.dot, styles.dotSoft]} />
            <View style={styles.actionTextWrap}>
              <Text style={styles.actionTitle}>Next mobile modules</Text>
              <Text style={styles.actionText}>
                Daily Checklist and SVR will plug into this same mobile shell.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  page: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 22,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14,
  },
  kicker: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  title: {
    color: colors.text,
    fontSize: 27,
    fontWeight: "900",
    maxWidth: 215,
  },
  badge: {
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: "#b7ebe2",
  },
  badgeText: {
    color: colors.tealInk,
    fontSize: 11,
    fontWeight: "900",
  },
  heroCard: {
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    padding: 18,
    marginBottom: 12,
  },
  heroLabel: {
    color: "#ccfbf1",
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 7,
  },
  heroTitle: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "900",
    marginBottom: 7,
    letterSpacing: -0.4,
  },
  heroText: {
    color: "#e0f2f1",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  grid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metricNumber: {
    color: colors.text,
    fontSize: 23,
    fontWeight: "900",
    marginBottom: 2,
  },
  metricLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 1,
  },
  actionCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 11,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: colors.primary,
    marginTop: 5,
  },
  dotSoft: {
    backgroundColor: colors.warning,
  },
  actionTextWrap: {
    flex: 1,
  },
  actionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900",
    marginBottom: 3,
  },
  actionText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
});
