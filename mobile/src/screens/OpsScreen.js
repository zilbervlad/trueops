import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import ChecklistScreen from "./ChecklistScreen";
import SvrScreen from "./SvrScreen";
import MaintenanceScreen from "./MaintenanceScreen";
import { colors, radius, spacing } from "../styles/theme";

const MODULES = [
  {
    key: "checklist",
    title: "Daily Checklist",
    eyebrow: "Store rhythm",
    description: "Open, dayshift, 3 O’Clock Restock, and Manager’s Walk.",
    badge: "Daily",
    icon: "✓",
  },
  {
    key: "svr",
    title: "SVR",
    eyebrow: "Supervisor visit",
    description: "Create visit reports and sync follow-up work.",
    badge: "Visit",
    icon: "↗",
  },
  {
    key: "maintenance",
    title: "Maintenance",
    eyebrow: "Store support",
    description: "Create, track, and move repair tasks forward.",
    badge: "Tickets",
    icon: "⚙",
  },
];

function ModuleCard({ module, onPress }) {
  return (
    <TouchableOpacity style={styles.moduleCard} onPress={onPress} activeOpacity={0.86}>
      <View style={styles.iconWrap}>
        <Text style={styles.iconText}>{module.icon}</Text>
      </View>

      <View style={styles.moduleBody}>
        <View style={styles.moduleTopRow}>
          <Text style={styles.moduleEyebrow}>{module.eyebrow}</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{module.badge}</Text>
          </View>
        </View>

        <Text style={styles.moduleTitle}>{module.title}</Text>
        <Text style={styles.moduleDescription}>{module.description}</Text>
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

  if (activeModule === "maintenance") {
    return <MaintenanceScreen onBack={() => setActiveModule("menu")} />;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.topBar}>
          <View>
            <Text style={styles.kicker}>TRUEOPS</Text>
            <Text style={styles.title}>Ops Center</Text>
            <Text style={styles.subtitle}>Run today’s store execution from one screen.</Text>
          </View>
        </View>

        <View style={styles.commandCard}>
          <View style={styles.commandHeader}>
            <View>
              <Text style={styles.commandKicker}>Live tools</Text>
              <Text style={styles.commandTitle}>Checklist · SVR · Maintenance</Text>
            </View>
            <View style={styles.commandDot} />
          </View>

          <Text style={styles.commandText}>
            Built for quick store checks, visit notes, and follow-up tasks without jumping into the full web app.
          </Text>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Modules</Text>
          <Text style={styles.sectionMeta}>{MODULES.length} active</Text>
        </View>

        {MODULES.map((module) => (
          <ModuleCard
            key={module.key}
            module={module}
            onPress={() => setActiveModule(module.key)}
          />
        ))}

        <View style={styles.smallNote}>
          <Text style={styles.smallNoteText}>
            UI pass 1: cleaner shell. Next pass tightens each module screen.
          </Text>
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
  container: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: 110,
  },
  topBar: {
    marginBottom: spacing.lg,
  },
  kicker: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.1,
  },
  title: {
    color: colors.text,
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: -1.1,
    marginTop: 2,
  },
  subtitle: {
    color: colors.muted,
    marginTop: 5,
    fontWeight: "700",
    lineHeight: 20,
  },
  commandCard: {
    backgroundColor: colors.navy,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    shadowColor: colors.shadow,
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  commandHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  commandKicker: {
    color: colors.navySoft,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  commandTitle: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "900",
    marginTop: 4,
    letterSpacing: -0.3,
  },
  commandText: {
    color: "#dbeafe",
    fontWeight: "700",
    lineHeight: 20,
    marginTop: spacing.md,
  },
  commandDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.success,
    marginTop: 4,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  sectionMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "900",
  },
  moduleCard: {
    backgroundColor: colors.card,
    borderColor: colors.borderSoft,
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    shadowColor: colors.shadow,
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryTint,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: {
    color: colors.primaryDark,
    fontSize: 20,
    fontWeight: "900",
  },
  moduleBody: {
    flex: 1,
  },
  moduleTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  moduleEyebrow: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.7,
    textTransform: "uppercase",
  },
  badge: {
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: {
    color: colors.textSoft,
    fontSize: 10,
    fontWeight: "900",
  },
  moduleTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
    marginTop: 3,
  },
  moduleDescription: {
    color: colors.muted,
    fontWeight: "700",
    lineHeight: 19,
    marginTop: 3,
  },
  arrow: {
    color: colors.faint,
    fontSize: 30,
    fontWeight: "700",
  },
  smallNote: {
    backgroundColor: colors.surface,
    borderColor: colors.borderSoft,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  smallNoteText: {
    color: colors.muted,
    fontWeight: "700",
    lineHeight: 19,
  },
});
