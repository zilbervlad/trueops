import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { fetchChecklistHeatmap } from "../api/client";
import { colors } from "../styles/theme";

function firstName(context) {
  return (context?.user?.name || context?.user?.username || "there").split(" ")[0];
}

function todayLabel() {
  return new Date().toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function statusColor(status) {
  if (status === "green") return colors.success;
  if (status === "yellow") return colors.warning;
  if (status === "red") return colors.danger;
  return colors.faint;
}

function HeatmapStoreCard({ item, onPress }) {
  const dotColor = statusColor(item.status);

  return (
    <Pressable style={({ pressed }) => [styles.storeCard, pressed && styles.cardPressed]} onPress={onPress}>
      <View style={[styles.statusDot, { backgroundColor: dotColor }]} />

      <View style={styles.storeMain}>
        <View style={styles.storeTopRow}>
          <Text style={styles.storeNumber}>#{item.store_number}</Text>
          <Text style={styles.statusLabel}>{item.status_label}</Text>
        </View>

        <Text style={styles.storeName} numberOfLines={1}>
          {item.name}
        </Text>

        <Text style={styles.areaName} numberOfLines={1}>
          {item.area_name || "No area"}
        </Text>
      </View>

      <View style={styles.scoreBlock}>
        <Text style={styles.scoreNumber}>{item.percent_complete}%</Text>
        <Text style={styles.scoreLabel}>Book</Text>
      </View>

      <View style={styles.scoreBlock}>
        <Text style={styles.scoreNumber}>{item.integrity_score}%</Text>
        <Text style={styles.scoreLabel}>Integrity</Text>
      </View>
    </Pressable>
  );
}

export default function HomeScreen({ context, navigation }) {
  const [heatmap, setHeatmap] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function loadHeatmap({ silent = false } = {}) {
    try {
      if (!silent) setLoading(true);
      setError("");

      const data = await fetchChecklistHeatmap();
      setHeatmap(data);
    } catch (err) {
      setError(err.message || "Could not load checklist heat map.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadHeatmap();
  }, []);

  const stores = heatmap?.stores || [];
  const summary = heatmap?.summary || {};

  const sortedStores = useMemo(() => {
    const rank = { red: 0, gray: 1, yellow: 2, green: 3 };

    return [...stores].sort((a, b) => {
      const statusDiff = (rank[a.status] ?? 9) - (rank[b.status] ?? 9);
      if (statusDiff !== 0) return statusDiff;

      const scoreDiff = (a.percent_complete || 0) - (b.percent_complete || 0);
      if (scoreDiff !== 0) return scoreDiff;

      return String(a.store_number).localeCompare(String(b.store_number));
    });
  }, [stores]);

  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.kicker}>TRUEOPS</Text>
          <Text style={styles.title}>Hi, {firstName(context)}</Text>
          <Text style={styles.subtitle}>Checklist Book Heat Map · {todayLabel()}</Text>
        </View>

        <Pressable style={styles.refreshButton} onPress={() => loadHeatmap({ silent: true })}>
          <Text style={styles.refreshText}>Refresh</Text>
        </Pressable>
      </View>

      <View style={styles.summaryCard}>
        <View>
          <Text style={styles.summaryKicker}>TODAY</Text>
          <Text style={styles.summaryTitle}>Checklist Book</Text>
          <Text style={styles.summarySub}>
            {summary.total || 0} stores · Avg {summary.average_percent || 0}%
          </Text>
        </View>

        <View style={styles.summaryGrid}>
          <View style={styles.summaryPill}>
            <Text style={styles.greenText}>{summary.green || 0}</Text>
            <Text style={styles.pillLabel}>Strong</Text>
          </View>

          <View style={styles.summaryPill}>
            <Text style={styles.yellowText}>{summary.yellow || 0}</Text>
            <Text style={styles.pillLabel}>Watch</Text>
          </View>

          <View style={styles.summaryPill}>
            <Text style={styles.redText}>{summary.red || 0}</Text>
            <Text style={styles.pillLabel}>Behind</Text>
          </View>
        </View>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.listHeader}>
        <Text style={styles.sectionTitle}>Stores</Text>
        <Text style={styles.sectionMeta}>worst first</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.stateText}>Loading heat map…</Text>
        </View>
      ) : (
        <FlatList
          data={sortedStores}
          keyExtractor={(item) => String(item.store_number)}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadHeatmap({ silent: true });
              }}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No checklist data</Text>
              <Text style={styles.emptyText}>Stores will show here once they are available.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <HeatmapStoreCard
              item={item}
              onPress={() => navigation?.navigate?.("Ops")}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.navy },
  header: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  headerText: { flex: 1 },
  kicker: {
    color: colors.primarySoft,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    color: "#ffffff",
    letterSpacing: -0.8,
    marginTop: 1,
  },
  subtitle: {
    color: "#94a3b8",
    marginTop: 3,
    fontWeight: "800",
    fontSize: 13,
    lineHeight: 17,
  },
  refreshButton: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  refreshText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "900",
  },
  summaryCard: {
    backgroundColor: "#ffffff",
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 24,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  summaryKicker: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.4,
  },
  summaryTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.6,
    marginTop: 2,
  },
  summarySub: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 2,
  },
  summaryGrid: {
    flexDirection: "row",
    gap: 7,
    alignItems: "center",
  },
  summaryPill: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingHorizontal: 9,
    paddingVertical: 8,
    minWidth: 48,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  greenText: { color: colors.success, fontSize: 17, fontWeight: "900" },
  yellowText: { color: colors.warning, fontSize: 17, fontWeight: "900" },
  redText: { color: colors.danger, fontSize: 17, fontWeight: "900" },
  pillLabel: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: "900",
    marginTop: 1,
  },
  error: {
    marginHorizontal: 16,
    marginBottom: 10,
    color: colors.danger,
    fontWeight: "800",
    backgroundColor: colors.dangerSoft,
    borderRadius: 18,
    padding: 12,
  },
  listHeader: {
    paddingHorizontal: 16,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: -0.4,
  },
  sectionMeta: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "900",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 116,
    gap: 8,
  },
  storeCard: {
    backgroundColor: "#ffffff",
    borderRadius: 22,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  cardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  statusDot: {
    width: 11,
    height: 44,
    borderRadius: 999,
  },
  storeMain: { flex: 1 },
  storeTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  storeNumber: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900",
  },
  statusLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "900",
  },
  storeName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800",
    marginTop: 2,
  },
  areaName: {
    color: colors.faint,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 2,
  },
  scoreBlock: {
    width: 54,
    alignItems: "center",
  },
  scoreNumber: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900",
  },
  scoreLabel: {
    color: colors.faint,
    fontSize: 9,
    fontWeight: "900",
    marginTop: 1,
  },
  center: {
    padding: 18,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  stateText: {
    color: "#cbd5e1",
    fontSize: 13,
    fontWeight: "800",
  },
  emptyCard: {
    backgroundColor: "#ffffff",
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    alignItems: "center",
    marginTop: 20,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "900",
    textAlign: "center",
  },
  emptyText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
    lineHeight: 18,
    marginTop: 6,
  },
});
