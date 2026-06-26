import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  fetchChecklistStores,
  fetchTodayChecklist,
  saveChecklistManager,
  toggleChecklistItem,
} from "../api/client";
import { colors, radius, spacing } from "../styles/theme";

function SectionPill({ section, active, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.sectionPill, active && styles.sectionPillActive]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Text style={[styles.sectionPillText, active && styles.sectionPillTextActive]}>
        {section.section_name}
      </Text>
      <Text style={[styles.sectionPillMeta, active && styles.sectionPillMetaActive]}>
        {section.completed}/{section.total}
      </Text>
    </TouchableOpacity>
  );
}

function ChecklistItem({ item, readOnly, onToggle }) {
  return (
    <TouchableOpacity
      style={[styles.itemCard, item.is_completed && styles.itemCardDone]}
      onPress={() => !readOnly && onToggle(item)}
      activeOpacity={readOnly ? 1 : 0.82}
    >
      <View style={[styles.checkCircle, item.is_completed && styles.checkCircleDone]}>
        <Text style={[styles.checkText, item.is_completed && styles.checkTextDone]}>
          {item.is_completed ? "✓" : ""}
        </Text>
      </View>

      <View style={styles.itemBody}>
        <Text style={[styles.itemText, item.is_completed && styles.itemTextDone]}>
          {item.task_text}
        </Text>
        <Text style={styles.itemMeta}>
          {item.expected_minutes ? `${item.expected_minutes} min` : "No time set"}
          {item.is_required ? " · Required" : ""}
        </Text>
        {!!item.notes && <Text style={styles.itemNote}>{item.notes}</Text>}
      </View>
    </TouchableOpacity>
  );
}

export default function ChecklistScreen() {
  const [stores, setStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState("");
  const [storePickerOpen, setStorePickerOpen] = useState(false);
  const [payload, setPayload] = useState(null);
  const [activeSectionName, setActiveSectionName] = useState("");
  const [openingManager, setOpeningManager] = useState("");
  const [closingManager, setClosingManager] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingItemId, setSavingItemId] = useState(null);

  const checklist = payload?.checklist;
  const store = payload?.store;

  const activeSection = useMemo(() => {
    const sections = checklist?.sections || [];
    return sections.find((section) => section.section_name === activeSectionName) || sections[0];
  }, [checklist, activeSectionName]);

  const load = useCallback(
    async ({ quiet = false, storeNumber = selectedStore } = {}) => {
      if (!quiet) setLoading(true);

      try {
        const storesResponse = await fetchChecklistStores();
        const visibleStores = storesResponse.stores || [];
        setStores(visibleStores);

        const fallbackStore = storeNumber || visibleStores[0]?.store_number || "";
        if (fallbackStore && fallbackStore !== selectedStore) {
          setSelectedStore(fallbackStore);
        }

        const todayResponse = await fetchTodayChecklist(fallbackStore);
        setPayload(todayResponse);

        const loadedChecklist = todayResponse.checklist;
        setOpeningManager(loadedChecklist?.opening_manager || "");
        setClosingManager(loadedChecklist?.closing_manager || "");

        const sections = loadedChecklist?.sections || [];
        if (sections.length && !sections.some((section) => section.section_name === activeSectionName)) {
          setActiveSectionName(sections[0].section_name);
        }
      } catch (error) {
        Alert.alert("Checklist", error.message || "Could not load checklist.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [activeSectionName, selectedStore]
  );

  useEffect(() => {
    load();
  }, []);

  async function handleStoreSelect(storeNumber) {
    setStorePickerOpen(false);
    setSelectedStore(storeNumber);
    await load({ storeNumber });
  }

  async function handleToggle(item) {
    if (!checklist || checklist.read_only || savingItemId) return;

    setSavingItemId(item.id);

    try {
      const response = await toggleChecklistItem(item.id, {
        is_completed: !item.is_completed,
        notes: item.notes || "",
      });
      setPayload((current) => ({
        ...current,
        checklist: response.checklist,
      }));
    } catch (error) {
      Alert.alert("Checklist", error.message || "Could not update item.");
    } finally {
      setSavingItemId(null);
    }
  }

  async function handleSaveManagers() {
    if (!checklist || checklist.read_only) return;

    try {
      const response = await saveChecklistManager({
        store_number: checklist.store_number,
        date: checklist.checklist_date,
        opening_manager: openingManager,
        closing_manager: closingManager,
      });

      setPayload((current) => ({
        ...current,
        checklist: response.checklist,
      }));

      Alert.alert("Saved", "Manager names updated.");
    } catch (error) {
      Alert.alert("Checklist", error.message || "Could not save managers.");
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator />
          <Text style={styles.loadingText}>Loading today’s checklist…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const sections = checklist?.sections || [];
  const complete = checklist?.percent_complete || 0;
  const readOnly = !!checklist?.read_only;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load({ quiet: true });
            }}
          />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.kicker}>DAILY RHYTHM</Text>
            <Text style={styles.title}>Checklist</Text>
            <Text style={styles.subtitle}>
              {store?.name || "Store"} · {checklist?.checklist_date || "Today"}
            </Text>
          </View>

          <View style={styles.scoreBadge}>
            <Text style={styles.score}>{Math.round(complete)}%</Text>
            <Text style={styles.scoreLabel}>Done</Text>
          </View>
        </View>

        {readOnly && (
          <View style={styles.readOnlyCard}>
            <Text style={styles.readOnlyTitle}>Read only</Text>
            <Text style={styles.readOnlyText}>Past ops days cannot be edited from mobile.</Text>
          </View>
        )}

        <View style={styles.card}>
          <TouchableOpacity
            style={styles.storeButton}
            activeOpacity={0.85}
            onPress={() => setStorePickerOpen((value) => !value)}
          >
            <View>
              <Text style={styles.label}>Store</Text>
              <Text style={styles.storeText}>
                {store?.store_number || selectedStore} · {store?.name || "Select store"}
              </Text>
            </View>
            <Text style={styles.chevron}>{storePickerOpen ? "⌃" : "⌄"}</Text>
          </TouchableOpacity>

          {storePickerOpen && (
            <View style={styles.storeList}>
              {stores.map((item) => (
                <TouchableOpacity
                  key={item.store_number}
                  style={[
                    styles.storeRow,
                    item.store_number === selectedStore && styles.storeRowActive,
                  ]}
                  onPress={() => handleStoreSelect(item.store_number)}
                >
                  <Text style={styles.storeRowText}>
                    {item.store_number} · {item.name}
                  </Text>
                  <Text style={styles.storeRowArea}>{item.area_name || ""}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <View style={styles.metricsRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{Math.round(complete)}%</Text>
            <Text style={styles.metricLabel}>Overall</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{Math.round(checklist?.integrity_score || 0)}</Text>
            <Text style={styles.metricLabel}>Integrity</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{Math.round(checklist?.manager_walk_integrity || 0)}</Text>
            <Text style={styles.metricLabel}>Walk</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Managers</Text>

          <Text style={styles.label}>Opening manager</Text>
          <TextInput
            value={openingManager}
            onChangeText={setOpeningManager}
            editable={!readOnly}
            placeholder="Enter name"
            placeholderTextColor={colors.faint}
            style={styles.input}
          />

          <Text style={styles.label}>Closing manager</Text>
          <TextInput
            value={closingManager}
            onChangeText={setClosingManager}
            editable={!readOnly}
            placeholder="Enter name"
            placeholderTextColor={colors.faint}
            style={styles.input}
          />

          {!readOnly && (
            <TouchableOpacity style={styles.saveButton} onPress={handleSaveManagers}>
              <Text style={styles.saveButtonText}>Save managers</Text>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.sectionScroller}
        >
          {sections.map((section) => (
            <SectionPill
              key={section.section_name}
              section={section}
              active={activeSection?.section_name === section.section_name}
              onPress={() => setActiveSectionName(section.section_name)}
            />
          ))}
        </ScrollView>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>{activeSection?.section_name || "Checklist"}</Text>
            <Text style={styles.sectionSubtitle}>
              {activeSection?.completed || 0} of {activeSection?.total || 0} complete
            </Text>
          </View>
          {savingItemId && <ActivityIndicator />}
        </View>

        {(activeSection?.items || []).map((item) => (
          <ChecklistItem
            key={item.id}
            item={item}
            readOnly={readOnly}
            onToggle={handleToggle}
          />
        ))}

        <View style={styles.bottomSpacer} />
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
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  loadingText: {
    color: colors.muted,
    fontWeight: "700",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.md,
  },
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
    fontWeight: "700",
  },
  scoreBadge: {
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: "center",
    minWidth: 78,
  },
  score: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "900",
  },
  scoreLabel: {
    color: "#e0f2fe",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  readOnlyCard: {
    backgroundColor: "#fff7ed",
    borderColor: "#fed7aa",
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  readOnlyTitle: {
    color: "#9a3412",
    fontWeight: "900",
  },
  readOnlyText: {
    color: "#9a3412",
    marginTop: 2,
    fontWeight: "700",
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  storeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  label: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    marginBottom: 7,
  },
  storeText: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "900",
  },
  chevron: {
    color: colors.muted,
    fontSize: 24,
    fontWeight: "900",
  },
  storeList: {
    marginTop: spacing.md,
    gap: 8,
  },
  storeRow: {
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  storeRowActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  storeRowText: {
    color: colors.text,
    fontWeight: "900",
  },
  storeRowArea: {
    color: colors.muted,
    marginTop: 2,
    fontWeight: "700",
  },
  metricsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: spacing.md,
  },
  metricCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metricValue: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "900",
  },
  metricLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "900",
    marginTop: 2,
    textTransform: "uppercase",
  },
  cardTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
    marginBottom: spacing.md,
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontWeight: "800",
    marginBottom: spacing.md,
  },
  saveButton: {
    backgroundColor: colors.text,
    borderRadius: radius.md,
    paddingVertical: 13,
    alignItems: "center",
  },
  saveButtonText: {
    color: "#ffffff",
    fontWeight: "900",
  },
  sectionScroller: {
    gap: 10,
    paddingBottom: spacing.md,
  },
  sectionPill: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.xl,
    paddingHorizontal: 14,
    paddingVertical: 11,
    minWidth: 155,
  },
  sectionPillActive: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  sectionPillText: {
    color: colors.text,
    fontWeight: "900",
    fontSize: 13,
  },
  sectionPillTextActive: {
    color: "#ffffff",
  },
  sectionPillMeta: {
    color: colors.muted,
    fontWeight: "800",
    marginTop: 4,
  },
  sectionPillMetaActive: {
    color: "#dbeafe",
  },
  sectionHeader: {
    marginTop: 4,
    marginBottom: spacing.sm,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.4,
  },
  sectionSubtitle: {
    color: colors.muted,
    fontWeight: "800",
    marginTop: 3,
  },
  itemCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderColor: colors.border,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: 10,
    flexDirection: "row",
    gap: 12,
  },
  itemCardDone: {
    backgroundColor: "#f0fdf4",
    borderColor: "#bbf7d0",
  },
  checkCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  checkCircleDone: {
    backgroundColor: "#16a34a",
    borderColor: "#16a34a",
  },
  checkText: {
    color: colors.card,
    fontWeight: "900",
  },
  checkTextDone: {
    color: "#ffffff",
  },
  itemBody: {
    flex: 1,
  },
  itemText: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "850",
  },
  itemTextDone: {
    color: "#166534",
  },
  itemMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 5,
  },
  itemNote: {
    color: colors.muted,
    marginTop: 6,
    fontWeight: "700",
  },
  bottomSpacer: {
    height: 30,
  },
});
