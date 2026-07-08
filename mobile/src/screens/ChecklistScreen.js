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
  const pct = section.total ? Math.round((section.completed / section.total) * 100) : 0;

  return (
    <TouchableOpacity
      style={[styles.sectionPill, active && styles.sectionPillActive]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Text style={[styles.sectionPillText, active && styles.sectionPillTextActive]} numberOfLines={1}>
        {section.section_name}
      </Text>
      <Text style={[styles.sectionPillMeta, active && styles.sectionPillMetaActive]}>
        {section.completed}/{section.total} · {pct}%
      </Text>
    </TouchableOpacity>
  );
}

function ChecklistItem({ item, readOnly, saving, onToggle }) {
  return (
    <TouchableOpacity
      style={[styles.itemRow, item.is_completed && styles.itemRowDone]}
      onPress={() => !readOnly && !saving && onToggle(item)}
      activeOpacity={readOnly ? 1 : 0.82}
    >
      <View style={[styles.checkCircle, item.is_completed && styles.checkCircleDone]}>
        {saving ? (
          <ActivityIndicator size="small" />
        ) : (
          <Text style={[styles.checkText, item.is_completed && styles.checkTextDone]}>
            {item.is_completed ? "✓" : ""}
          </Text>
        )}
      </View>

      <View style={styles.itemBody}>
        <Text style={[styles.itemText, item.is_completed && styles.itemTextDone]}>
          {item.task_text}
        </Text>

        <View style={styles.itemMetaRow}>
          <Text style={styles.itemMeta}>
            {item.expected_minutes ? `${item.expected_minutes} min` : "No time"}
          </Text>
          {item.is_required && (
            <View style={styles.requiredPill}>
              <Text style={styles.requiredText}>Required</Text>
            </View>
          )}
        </View>

        {!!item.notes && <Text style={styles.itemNote}>{item.notes}</Text>}
      </View>
    </TouchableOpacity>
  );
}

export default function ChecklistScreen({ onBack }) {
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
  const [showIncompleteOnly, setShowIncompleteOnly] = useState(false);
  const [managerOpen, setManagerOpen] = useState(false);

  const checklist = payload?.checklist;
  const store = payload?.store;

  const activeSection = useMemo(() => {
    const sections = checklist?.sections || [];
    return sections.find((section) => section.section_name === activeSectionName) || sections[0];
  }, [checklist, activeSectionName]);

  const visibleItems = useMemo(() => {
    const items = activeSection?.items || [];
    return items.filter((item) => !showIncompleteOnly || !item.is_completed);
  }, [activeSection, showIncompleteOnly]);

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

      setManagerOpen(false);
    } catch (error) {
      Alert.alert("Checklist", error.message || "Could not save managers.");
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingText}>Loading today’s checklist…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const sections = checklist?.sections || [];
  const complete = Math.round(checklist?.percent_complete || 0);
  const integrity = Math.round(checklist?.integrity_score || 0);
  const walk = Math.round(checklist?.manager_walk_integrity || 0);
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
          <View style={styles.headerText}>
            <Text style={styles.kicker}>DAILY RHYTHM</Text>
            <Text style={styles.title}>Checklist</Text>
            <Text style={styles.subtitle}>
              {store?.store_number || selectedStore} · {store?.name || "Store"} · {checklist?.checklist_date || "Today"}
            </Text>
          </View>

          {onBack ? (
            <TouchableOpacity style={styles.backButton} onPress={onBack}>
              <Text style={styles.backButtonText}>Ops</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.scoreCard}>
          <View>
            <Text style={styles.scoreKicker}>Today</Text>
            <Text style={styles.scoreMain}>{complete}%</Text>
            <Text style={styles.scoreSub}>overall complete</Text>
          </View>

          <View style={styles.scoreStats}>
            <View style={styles.scoreStat}>
              <Text style={styles.scoreStatValue}>{integrity}</Text>
              <Text style={styles.scoreStatLabel}>Integrity</Text>
            </View>
            <View style={styles.scoreStat}>
              <Text style={styles.scoreStatValue}>{walk}</Text>
              <Text style={styles.scoreStatLabel}>Walk</Text>
            </View>
          </View>
        </View>

        {readOnly && (
          <View style={styles.warningCard}>
            <Text style={styles.warningTitle}>Read only</Text>
            <Text style={styles.warningText}>Past ops days cannot be edited from mobile.</Text>
          </View>
        )}

        <View style={styles.controlCard}>
          <TouchableOpacity
            style={styles.storeButton}
            activeOpacity={0.85}
            onPress={() => setStorePickerOpen((value) => !value)}
          >
            <View style={styles.storeButtonTextWrap}>
              <Text style={styles.label}>Store</Text>
              <Text style={styles.storeText} numberOfLines={1}>
                {store?.store_number || selectedStore} · {store?.name || "Select store"}
              </Text>
            </View>
            <Text style={styles.chevron}>{storePickerOpen ? "⌃" : "⌄"}</Text>
          </TouchableOpacity>

          {storePickerOpen && (
            <View style={styles.storeList}>
              {stores.map((item) => (
                <TouchableOpacity
                  key={`${item.company_id || "x"}-${item.store_number}`}
                  style={[
                    styles.storeRow,
                    item.store_number === selectedStore && styles.storeRowActive,
                  ]}
                  onPress={() => handleStoreSelect(item.store_number)}
                >
                  <Text style={styles.storeRowText}>{item.store_number} · {item.name}</Text>
                  <Text style={styles.storeRowArea}>{item.area_name || "No area"}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <TouchableOpacity
            style={styles.managerToggle}
            onPress={() => setManagerOpen((value) => !value)}
            activeOpacity={0.85}
          >
            <View>
              <Text style={styles.label}>Managers</Text>
              <Text style={styles.managerSummary} numberOfLines={1}>
                Open: {openingManager || "—"} · Close: {closingManager || "—"}
              </Text>
            </View>
            <Text style={styles.chevron}>{managerOpen ? "⌃" : "⌄"}</Text>
          </TouchableOpacity>

          {managerOpen && (
            <View style={styles.managerPanel}>
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
          <View style={styles.sectionHeaderText}>
            <Text style={styles.sectionTitle}>{activeSection?.section_name || "Checklist"}</Text>
            <Text style={styles.sectionSubtitle}>
              {activeSection?.completed || 0} of {activeSection?.total || 0} complete
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.filterButton, showIncompleteOnly && styles.filterButtonActive]}
            onPress={() => setShowIncompleteOnly((value) => !value)}
            activeOpacity={0.85}
          >
            <Text style={[styles.filterButtonText, showIncompleteOnly && styles.filterButtonTextActive]}>
              {showIncompleteOnly ? "Incomplete" : "All"}
            </Text>
          </TouchableOpacity>
        </View>

        {visibleItems.map((item) => (
          <ChecklistItem
            key={item.id}
            item={item}
            readOnly={readOnly}
            saving={savingItemId === item.id}
            onToggle={handleToggle}
          />
        ))}

        {visibleItems.length === 0 && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Section complete</Text>
            <Text style={styles.emptyText}>Everything in this section is checked off.</Text>
          </View>
        )}

        <View style={styles.bottomSpacer} />
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
    padding: spacing.lg,
    paddingBottom: 110,
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  loadingText: {
    color: colors.muted,
    fontWeight: "800",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  headerText: {
    flex: 1,
  },
  kicker: {
    color: colors.primarySoft,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.1,
  },
  title: {
    color: "#ffffff",
    fontSize: 32,
    fontWeight: "900",
    letterSpacing: -1,
    marginTop: 2,
  },
  subtitle: {
    color: "#94a3b8",
    marginTop: 4,
    fontWeight: "700",
    lineHeight: 19,
  },
  backButton: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 18,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  backButtonText: {
    color: colors.text,
    fontWeight: "900",
  },
  scoreCard: {
    backgroundColor: colors.navy,
    borderRadius: 26,
    padding: spacing.lg,
    marginBottom: spacing.md,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    shadowColor: colors.shadow,
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  scoreKicker: {
    color: colors.navySoft,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  scoreMain: {
    color: "#ffffff",
    fontSize: 44,
    fontWeight: "900",
    letterSpacing: -1.2,
    marginTop: 2,
  },
  scoreSub: {
    color: colors.navySoft,
    fontWeight: "800",
    marginTop: -2,
  },
  scoreStats: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  scoreStat: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minWidth: 74,
    alignItems: "center",
  },
  scoreStatValue: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "900",
  },
  scoreStatLabel: {
    color: colors.navySoft,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    marginTop: 1,
  },
  warningCard: {
    backgroundColor: colors.warningSoft,
    borderColor: "#fed7aa",
    borderWidth: 1,
    borderRadius: 18,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  warningTitle: {
    color: "#9a3412",
    fontWeight: "900",
  },
  warningText: {
    color: "#9a3412",
    marginTop: 2,
    fontWeight: "700",
  },
  controlCard: {
    backgroundColor: colors.card,
    borderRadius: 26,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    marginBottom: spacing.md,
  },
  storeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  storeButtonTextWrap: {
    flex: 1,
  },
  label: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginBottom: 6,
  },
  storeText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
  },
  chevron: {
    color: colors.faint,
    fontSize: 22,
    fontWeight: "900",
  },
  storeList: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  storeRow: {
    padding: 11,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  storeRowActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryTint,
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
  managerToggle: {
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    paddingTop: spacing.md,
    marginTop: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  managerSummary: {
    color: colors.textSoft,
    fontWeight: "800",
  },
  managerPanel: {
    paddingTop: spacing.md,
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
  saveButton: {
    backgroundColor: colors.text,
    borderRadius: 18,
    paddingVertical: 13,
    alignItems: "center",
  },
  saveButtonText: {
    color: "#ffffff",
    fontWeight: "900",
  },
  sectionScroller: {
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  sectionPill: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 18,
    paddingHorizontal: 13,
    paddingVertical: 10,
    minWidth: 138,
  },
  sectionPillActive: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  sectionPillText: {
    color: colors.text,
    fontWeight: "900",
    maxWidth: 150,
  },
  sectionPillTextActive: {
    color: "#ffffff",
  },
  sectionPillMeta: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 3,
  },
  sectionPillMetaActive: {
    color: colors.navySoft,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  sectionHeaderText: {
    flex: 1,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 21,
    fontWeight: "900",
    letterSpacing: -0.4,
  },
  sectionSubtitle: {
    color: "#ffffff",
    fontWeight: "800",
    marginTop: 2,
  },
  filterButton: {
    backgroundColor: colors.card,
    borderColor: colors.borderSoft,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  filterButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterButtonText: {
    color: colors.text,
    fontWeight: "900",
    fontSize: 12,
  },
  filterButtonTextActive: {
    color: "#ffffff",
  },
  itemRow: {
    backgroundColor: colors.card,
    borderColor: colors.borderSoft,
    borderWidth: 1,
    borderRadius: 18,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: "row",
    gap: spacing.md,
  },
  itemRowDone: {
    backgroundColor: colors.surface,
  },
  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
    backgroundColor: colors.card,
  },
  checkCircleDone: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  checkText: {
    color: colors.faint,
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
    fontWeight: "850",
    lineHeight: 20,
  },
  itemTextDone: {
    color: colors.muted,
    textDecorationLine: "line-through",
  },
  itemMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: 6,
  },
  itemMeta: {
    color: colors.faint,
    fontSize: 12,
    fontWeight: "800",
  },
  requiredPill: {
    backgroundColor: colors.warningSoft,
    borderRadius: radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  requiredText: {
    color: "#92400e",
    fontSize: 10,
    fontWeight: "900",
  },
  itemNote: {
    color: colors.muted,
    marginTop: 6,
    fontWeight: "700",
    lineHeight: 18,
  },
  emptyCard: {
    backgroundColor: colors.card,
    borderColor: colors.borderSoft,
    borderWidth: 1,
    borderRadius: 26,
    padding: spacing.xl,
    alignItems: "center",
  },
  emptyTitle: {
    color: colors.text,
    fontWeight: "900",
    fontSize: 18,
  },
  emptyText: {
    color: colors.muted,
    fontWeight: "700",
    marginTop: 4,
    textAlign: "center",
  },
  bottomSpacer: {
    height: 30,
  },
});
