import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import ChecklistScreen from "./ChecklistScreen";
import SvrScreen from "./SvrScreen";
import { colors, radius, spacing } from "../styles/theme";

function ModuleCard({ title, eyebrow, description, onPress }) {
  return (
    <TouchableOpacity style={styles.moduleCard} onPress={onPress} activeOpacity={0.86}>
      <View style={styles.moduleIcon}>
        <Text style={styles.moduleIconText}>{title.slice(0, 1)}</Text>
      </View>

      <View style={styles.moduleBody}>
        <Text style={styles.moduleEyebrow}>{eyebrow}</Text>
        <Text style={styles.moduleTitle}>{title}</Text>
        <Text style={styles.moduleDescription}>{description}</Text>
      </View>

      <Text style={styles.arrow}>›</Text>
    </TouchableOpacity>
  );
}

export default function OpsScreen() {
  const [activeModule, setActiveModule] = useState("menu");

  if (activeModule === "checklist") {
    return <ChecklistScreen onBack={() => setActiveModule("menu")} />;
  }

  if (activeModule === "svr") {
    return <SvrScreen onBack={() => setActiveModule("menu")} />;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.kicker}>TRUEOPS MOBILE</Text>
        <Text style={styles.title}>Ops</Text>
        <Text style={styles.subtitle}>Run the core store rhythm from one place.</Text>

        <View style={styles.hero}>
          <Text style={styles.heroTitle}>Modules</Text>
          <Text style={styles.heroText}>
            Start with working tools. We’ll do the full UI pass after every module is alive.
          </Text>
        </View>

        <ModuleCard
          title="Daily Checklist"
          eyebrow="Store rhythm"
          description="Open, dayshift, 3 O’Clock Restock, and Manager’s Walk."
          onPress={() => setActiveModule("checklist")}
        />

        <ModuleCard
          title="SVR"
          eyebrow="Supervisor visit"
          description="Create a supervisor visit report and sync maintenance/focus items."
          onPress={() => setActiveModule("svr")}
        />

        <ModuleCard
          title="Maintenance"
          eyebrow="Coming next"
          description="View and update store maintenance tickets."
          onPress={() => setActiveModule("maintenance")}
        />

        {activeModule === "maintenance" && (
          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>Maintenance is next</Text>
            <Text style={styles.noticeText}>
              We’ll wire this after SVR is saving cleanly from the phone.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: 110 },
  kicker: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
  },
  title: {
    color: colors.text,
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: -1,
  },
  subtitle: {
    color: colors.muted,
    marginTop: 4,
    marginBottom: spacing.md,
    fontWeight: "700",
  },
  hero: {
    backgroundColor: colors.text,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  heroTitle: { color: "#ffffff", fontSize: 20, fontWeight: "900" },
  heroText: { color: "#dbeafe", marginTop: 6, fontWeight: "700", lineHeight: 21 },
  moduleCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  moduleIcon: {
    width: 48,
    height: 48,
    borderRadius: 18,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  moduleIconText: { color: colors.primary, fontSize: 20, fontWeight: "900" },
  moduleBody: { flex: 1 },
  moduleEyebrow: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    marginBottom: 3,
  },
  moduleTitle: { color: colors.text, fontSize: 18, fontWeight: "900" },
  moduleDescription: { color: colors.muted, fontWeight: "700", lineHeight: 20, marginTop: 3 },
  arrow: { color: colors.muted, fontSize: 34, fontWeight: "700" },
  notice: {
    backgroundColor: "#fff7ed",
    borderColor: "#fed7aa",
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  noticeTitle: { color: "#9a3412", fontWeight: "900" },
  noticeText: { color: "#9a3412", fontWeight: "700", marginTop: 3 },
});
