import React, { useEffect, useState } from "react";
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

export default function OpsScreen({ route }) {
  const [activeModule, setActiveModule] = useState("menu");

  useEffect(() => {
    const requestedTool = route?.params?.initialTool;
    if (["checklist", "svr", "maintenance"].includes(requestedTool)) {
      setActiveModule(requestedTool);
    }
  }, [route?.params?.initialTool, route?.params?.initialToolNonce]);

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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.navy,
  },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 96,
  },
  topBar: {
    marginBottom: 12,
  },
  kicker: {
    color: colors.primarySoft,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.1,
  },
  title: {
    color: "#ffffff",
    fontSize: 29,
    fontWeight: "900",
    letterSpacing: -0.9,
    marginTop: 1,
  },
  subtitle: {
    color: "#94a3b8",
    marginTop: 3,
    fontWeight: "800",
    lineHeight: 18,
    fontSize: 13,
  },
  commandCard: {
    backgroundColor: colors.navy,
    borderRadius: 22,
    padding: 14,
    marginBottom: 14,
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
    fontSize: 17,
    fontWeight: "900",
    marginTop: 3,
    letterSpacing: -0.25,
  },
  commandText: {
    color: "#dbeafe",
    fontWeight: "700",
    lineHeight: 18,
    marginTop: 10,
    fontSize: 13,
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
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: -0.25,
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
    borderRadius: 22,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 10,
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
    width: 40,
    height: 40,
    borderRadius: 15,
    backgroundColor: colors.primaryTint,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: {
    color: colors.primaryDark,
    fontSize: 18,
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
    fontSize: 16,
    fontWeight: "900",
    marginTop: 2,
  },
  moduleDescription: {
    color: colors.muted,
    fontWeight: "750",
    lineHeight: 17,
    marginTop: 2,
    fontSize: 12,
  },
  arrow: {
    color: colors.faint,
    fontSize: 24,
    fontWeight: "700",
  },
  smallNote: {
    backgroundColor: colors.surface,
    borderColor: colors.borderSoft,
    borderWidth: 1,
    borderRadius: 18,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  smallNoteText: {
    color: colors.muted,
    fontWeight: "700",
    lineHeight: 19,
  },
});
