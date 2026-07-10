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

export default function ChecklistScreen({ onBack, initialStore = "" }) {
  const [stores, setStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState(
    String(initialStore || "")
  );
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
  const weeklyFocus = payload?.weekly_focus || {};
  const cleaningFocus = weeklyFocus.cleaning || [];
  const storeGoals = weeklyFocus.goals || [];
  const otherFocus = weeklyFocus.other || [];
  const hasWeeklyFocus =
    cleaningFocus.length > 0 ||
    storeGoals.length > 0 ||
    otherFocus.length > 0;

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
    load({ storeNumber: String(initialStore || "") });
  }, [initialStore]);

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
          <View style={styles.scoreTopRow}>
            <View>
              <Text style={styles.scoreKicker}>TODAY'S EXECUTION</Text>
              <Text style={styles.scoreMain}>{complete}%</Text>
              <Text style={styles.scoreSub}>Checklist complete</Text>
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

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.max(0, Math.min(100, complete))}%` }]} />
          </View>
        </View>

        {hasWeeklyFocus ? (
          <View style={styles.weeklyFocusCard}>
            <View style={styles.weeklyFocusHeader}>
              <View>
                <Text style={styles.weeklyFocusKicker}>THIS WEEK</Text>
                <Text style={styles.weeklyFocusTitle}>Store Focus</Text>
              </View>

              <View style={styles.weeklyFocusCount}>
                <Text style={styles.weeklyFocusCountText}>
                  {cleaningFocus.length + storeGoals.length + otherFocus.length}
                </Text>
              </View>
            </View>

            {cleaningFocus.length ? (
              <View style={styles.focusSection}>
                <View style={styles.focusSectionHeader}>
                  <View style={[styles.focusIcon, styles.focusIconCleaning]}>
                    <Text style={styles.focusIconText}>✦</Text>
                  </View>

                  <View>
                    <Text style={styles.focusSectionTitle}>Cleaning Focus</Text>
                    <Text style={styles.focusSectionMeta}>
                      {cleaningFocus.length} priority
                      {cleaningFocus.length === 1 ? "" : " items"}
                    </Text>
                  </View>
                </View>

                {cleaningFocus.map((item) => (
                  <View
                    key={`cleaning-${item.id}`}
                    style={[
                      styles.focusItem,
                      item.is_completed && styles.focusItemComplete,
                    ]}
                  >
                    <View
                      style={[
                        styles.focusBullet,
                        item.is_completed && styles.focusBulletComplete,
                      ]}
                    />

                    <Text
                      style={[
                        styles.focusItemText,
                        item.is_completed && styles.focusItemTextComplete,
                      ]}
                    >
                      {item.item_text}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            {storeGoals.length ? (
              <View style={styles.focusSection}>
                <View style={styles.focusSectionHeader}>
                  <View style={[styles.focusIcon, styles.focusIconGoal]}>
                    <Text style={styles.focusIconText}>◎</Text>
                  </View>

                  <View>
                    <Text style={styles.focusSectionTitle}>Store Goals</Text>
                    <Text style={styles.focusSectionMeta}>
                      {storeGoals.length} goal
                      {storeGoals.length === 1 ? "" : "s"}
                    </Text>
                  </View>
                </View>

                {storeGoals.map((item) => (
                  <View
                    key={`goal-${item.id}`}
                    style={[
                      styles.focusItem,
                      item.is_completed && styles.focusItemComplete,
                    ]}
                  >
                    <View
                      style={[
                        styles.focusBullet,
                        styles.focusBulletGoal,
                        item.is_completed && styles.focusBulletComplete,
                      ]}
                    />

                    <Text
                      style={[
                        styles.focusItemText,
                        item.is_completed && styles.focusItemTextComplete,
                      ]}
                    >
                      {item.item_text}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            {otherFocus.length ? (
              <View style={styles.focusSection}>
                <View style={styles.focusSectionHeader}>
                  <View style={[styles.focusIcon, styles.focusIconOther]}>
                    <Text style={styles.focusIconText}>!</Text>
                  </View>

                  <View>
                    <Text style={styles.focusSectionTitle}>Additional Focus</Text>
                    <Text style={styles.focusSectionMeta}>
                      {otherFocus.length} item
                      {otherFocus.length === 1 ? "" : "s"}
                    </Text>
                  </View>
                </View>

                {otherFocus.map((item) => (
                  <View
                    key={`other-${item.id}`}
                    style={[
                      styles.focusItem,
                      item.is_completed && styles.focusItemComplete,
                    ]}
                  >
                    <View
                      style={[
                        styles.focusBullet,
                        styles.focusBulletOther,
                        item.is_completed && styles.focusBulletComplete,
                      ]}
                    />

                    <Text
                      style={[
                        styles.focusItemText,
                        item.is_completed && styles.focusItemTextComplete,
                      ]}
                    >
                      {item.item_text}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

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
    paddingHorizontal: 16,
    paddingTop: 6,
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
    alignItems: "center",
    marginBottom: 12,
    gap: 12,
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
    fontSize: 27,
    fontWeight: "900",
    letterSpacing: -0.8,
    marginTop: 1,
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
    backgroundColor: "#17233a",
    borderRadius: 24,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    shadowColor: colors.shadow,
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 9 },
    elevation: 7,
  },
  scoreTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 14,
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.13)",
    overflow: "hidden",
    marginTop: 16,
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: colors.primary,
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
    fontSize: 40,
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
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 16,
    paddingHorizontal: 11,
    paddingVertical: 9,
    minWidth: 68,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
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
  weeklyFocusCard: {
    backgroundColor: "#ffffff",
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    marginBottom: 12,
    shadowColor: colors.shadow,
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  weeklyFocusHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  weeklyFocusKicker: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  weeklyFocusTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: -0.4,
    marginTop: 2,
  },
  weeklyFocusCount: {
    minWidth: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primaryTint,
    alignItems: "center",
    justifyContent: "center",
  },
  weeklyFocusCountText: {
    color: colors.primary,
    fontWeight: "900",
    fontSize: 14,
  },
  focusSection: {
    backgroundColor: colors.surface,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: 12,
    marginTop: 8,
  },
  focusSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  focusIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  focusIconCleaning: {
    backgroundColor: colors.successSoft,
  },
  focusIconGoal: {
    backgroundColor: colors.primarySoft,
  },
  focusIconOther: {
    backgroundColor: colors.warningSoft,
  },
  focusIconText: {
    color: colors.text,
    fontWeight: "900",
    fontSize: 15,
  },
  focusSectionTitle: {
    color: colors.text,
    fontWeight: "900",
    fontSize: 15,
  },
  focusSectionMeta: {
    color: colors.muted,
    fontWeight: "700",
    fontSize: 11,
    marginTop: 1,
  },
  focusItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
  },
  focusItemComplete: {
    opacity: 0.65,
  },
  focusBullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
    marginTop: 6,
  },
  focusBulletGoal: {
    backgroundColor: colors.primary,
  },
  focusBulletOther: {
    backgroundColor: colors.warning,
  },
  focusBulletComplete: {
    backgroundColor: colors.faint,
  },
  focusItemText: {
    flex: 1,
    color: colors.textSoft,
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 20,
  },
  focusItemTextComplete: {
    color: colors.muted,
    textDecorationLine: "line-through",
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
    borderRadius: 22,
    padding: 14,
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
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    borderRadius: 16,
    paddingHorizontal: 13,
    paddingVertical: 9,
    minWidth: 132,
  },
  sectionPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  sectionPillText: {
    color: "#dbeafe",
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
    color: "#94a3b8",
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
    borderRadius: 17,
    paddingHorizontal: 13,
    paddingVertical: 12,
    marginBottom: 8,
    flexDirection: "row",
    gap: 12,
    shadowColor: colors.shadow,
    shadowOpacity: 0.035,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  itemRowDone: {
    backgroundColor: "#f4fbf7",
    borderColor: "#d7f0df",
  },
  checkCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
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
    fontWeight: "800",
    lineHeight: 20,
    letterSpacing: -0.1,
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
