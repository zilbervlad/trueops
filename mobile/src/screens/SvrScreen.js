import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  createSvrReport,
  fetchRecentSvrReports,
  fetchSvrStores,
  fetchSvrTemplate,
} from "../api/client";
import { colors, radius, spacing } from "../styles/theme";

const FIELD_GROUPS = [
  {
    title: "Store Basics",
    keys: [
      "restroom_notes",
      "checklist_book_notes",
      "one_way_proof",
      "pizza_quality_notes",
      "load_go",
      "load_and_go",
      "last_weeks_svr_review",
      "last_week_svr_review",
    ],
  },
  {
    title: "Store Condition",
    keys: [
      "outside_store_condition_notes",
      "carry_out_notes",
      "store_condition_notes",
      "refrigeration_units_notes",
      "bake_wares_notes",
      "bakewares_notes",
      "oven_heatrack_notes",
    ],
  },
  {
    title: "Follow Up",
    keys: [
      "call_out_calendar_notes",
      "callout_calendar_notes",
      "deposit_log",
      "deposit_log_notes",
      "pest_control",
      "pest_control_notes",
      "cleaning_list_for_week",
      "goals_for_week",
      "maintenance_needs",
    ],
  },
];

function prettyCount(fields) {
  return `${fields.length} ${fields.length === 1 ? "field" : "fields"}`;
}

function StorePicker({ stores, selectedStore, open, onToggle, onSelect }) {
  const selected = stores.find((store) => store.store_number === selectedStore);

  return (
    <View style={styles.controlCard}>
      <TouchableOpacity style={styles.storeButton} onPress={onToggle} activeOpacity={0.85}>
        <View style={styles.storeTextWrap}>
          <Text style={styles.label}>Store</Text>
          <Text style={styles.storeText} numberOfLines={1}>
            {selected ? `${selected.store_number} · ${selected.name}` : "Select store"}
          </Text>
        </View>
        <Text style={styles.chevron}>{open ? "⌃" : "⌄"}</Text>
      </TouchableOpacity>

      {open && (
        <View style={styles.storeList}>
          {stores.map((store) => (
            <TouchableOpacity
              key={`${store.company_id}-${store.store_number}`}
              style={[
                styles.storeRow,
                store.store_number === selectedStore && styles.storeRowActive,
              ]}
              onPress={() => onSelect(store.store_number)}
              activeOpacity={0.85}
            >
              <Text style={styles.storeRowText}>{store.store_number} · {store.name}</Text>
              <Text style={styles.storeRowArea}>
                {store.area_name || "No area"} · Company {store.company_id}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

function FieldInput({ field, value, onChange }) {
  if (field.field_key === "store_number" || field.field_key === "date") {
    return (
      <View style={styles.readOnlyField}>
        <Text style={styles.fieldLabel}>{field.field_label}</Text>
        <Text style={styles.readOnlyValue}>{value || "Auto-filled"}</Text>
      </View>
    );
  }

  if (field.field_type === "yesno") {
    return (
      <View style={styles.fieldWrap}>
        <Text style={styles.fieldLabel}>{field.field_label}</Text>
        <View style={styles.yesNoRow}>
          {["Yes", "No", "N/A"].map((option) => (
            <TouchableOpacity
              key={option}
              style={[styles.yesNoButton, value === option && styles.yesNoButtonActive]}
              onPress={() => onChange(option)}
              activeOpacity={0.85}
            >
              <Text style={[styles.yesNoText, value === option && styles.yesNoTextActive]}>
                {option}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  }

  const isLong = field.field_type !== "text";

  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{field.field_label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="Add notes..."
        placeholderTextColor={colors.faint}
        multiline={isLong}
        style={[styles.input, isLong && styles.textArea]}
      />
    </View>
  );
}

function FieldGroup({ title, fields, values, onChange }) {
  if (!fields.length) return null;

  return (
    <View style={styles.groupCard}>
      <View style={styles.groupHeader}>
        <Text style={styles.groupTitle}>{title}</Text>
        <Text style={styles.groupMeta}>{prettyCount(fields)}</Text>
      </View>

      {fields.map((field) => (
        <FieldInput
          key={`${field.id}-${field.field_key}`}
          field={field}
          value={values[field.field_key] || ""}
          onChange={(value) => onChange(field.field_key, value)}
        />
      ))}
    </View>
  );
}


function PreviousVisitCard({
  report,
  expanded,
  onToggle,
  onPhotoPress,
}) {
  if (!report) {
    return (
      <View style={styles.previousCard}>
        <View style={styles.previousHeader}>
          <View style={styles.previousHeaderText}>
            <Text style={styles.previousKicker}>PREVIOUS VISIT</Text>
            <Text style={styles.previousTitle}>No prior SVR found</Text>
            <Text style={styles.previousSubtitle}>
              Prior visit photos will appear here once available.
            </Text>
          </View>
        </View>
      </View>
    );
  }

  const photos = report.photos || [];

  return (
    <View style={styles.previousCard}>
      <TouchableOpacity
        style={styles.previousHeader}
        onPress={onToggle}
        activeOpacity={0.85}
      >
        <View style={styles.previousHeaderText}>
          <Text style={styles.previousKicker}>PREVIOUS VISIT</Text>
          <Text style={styles.previousTitle}>
            {report.visit_date || "Prior SVR"}
          </Text>
          <Text style={styles.previousSubtitle}>
            {report.supervisor_name || "Supervisor"}
            {report.manager_on_duty
              ? ` · Manager: ${report.manager_on_duty}`
              : ""}
          </Text>
        </View>

        <View style={styles.previousBadge}>
          <Text style={styles.previousBadgeText}>
            {photos.length} photo{photos.length === 1 ? "" : "s"}
          </Text>
          <Text style={styles.previousChevron}>
            {expanded ? "⌃" : "⌄"}
          </Text>
        </View>
      </TouchableOpacity>

      {expanded ? (
        <View style={styles.previousBody}>
          {photos.length ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.previousPhotoRow}
            >
              {photos.map((photo) => (
                <TouchableOpacity
                  key={photo.id}
                  style={styles.previousPhotoButton}
                  onPress={() => onPhotoPress(photo)}
                  activeOpacity={0.88}
                >
                  <Image
                    source={{
                      uri: photo.thumbnail_url || photo.image_url,
                    }}
                    style={styles.previousPhoto}
                    resizeMode="cover"
                  />

                  {photo.caption ? (
                    <Text
                      style={styles.previousPhotoCaption}
                      numberOfLines={1}
                    >
                      {photo.caption}
                    </Text>
                  ) : null}
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <Text style={styles.previousEmptyText}>
              This visit did not include photos.
            </Text>
          )}
        </View>
      ) : null}
    </View>
  );
}

export default function SvrScreen({ onBack }) {
  const [stores, setStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState("");
  const [storePickerOpen, setStorePickerOpen] = useState(false);
  const [templatePayload, setTemplatePayload] = useState(null);
  const [values, setValues] = useState({});
  const [managerOnDuty, setManagerOnDuty] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [canCreateReport, setCanCreateReport] = useState(false);
  const [recentReports, setRecentReports] = useState([]);
  const [previousExpanded, setPreviousExpanded] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  const fields = templatePayload?.fields || [];

  const visibleFields = useMemo(
    () =>
      fields.filter(
        (field) =>
          !["manager_on_duty", "store_number", "date"].includes(field.field_key)
      ),
    [fields]
  );

  const answeredCount = visibleFields.filter(
    (field) => String(values[field.field_key] || "").trim()
  ).length;

  const completionPercent = visibleFields.length
    ? Math.round((answeredCount / visibleFields.length) * 100)
    : 0;

  const previousReport = useMemo(
    () =>
      recentReports.find(
        (report) =>
          String(report.store_number) === String(selectedStore)
      ) || null,
    [recentReports, selectedStore]
  );

  const groupedFields = useMemo(() => {
    const used = new Set();
    const groups = FIELD_GROUPS.map((group) => {
      const matched = visibleFields.filter((field) => group.keys.includes(field.field_key));
      matched.forEach((field) => used.add(field.field_key));
      return { ...group, fields: matched };
    });

    const otherFields = visibleFields.filter((field) => !used.has(field.field_key));

    if (otherFields.length) {
      groups.push({
        title: "Other Notes",
        keys: [],
        fields: otherFields,
      });
    }

    return groups;
  }, [visibleFields]);

  const loadTemplate = useCallback(
    async (storeNumber) => {
      const response = await fetchSvrTemplate(storeNumber);
      setTemplatePayload(response);
      setCanCreateReport(Boolean(response.can_create_svr));

      const nextValues = {};
      for (const field of response.fields || []) {
        if (field.field_key === "store_number") {
          nextValues[field.field_key] = response.store?.store_number || "";
        } else if (field.field_key === "date") {
          nextValues[field.field_key] = response.visit_date || "";
        } else if (field.field_key === "manager_on_duty") {
          nextValues[field.field_key] = managerOnDuty;
        } else {
          nextValues[field.field_key] = "";
        }
      }

      setValues(nextValues);
    },
    [managerOnDuty]
  );

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const [storeResponse, recentResponse] = await Promise.all([
        fetchSvrStores(),
        fetchRecentSvrReports(),
      ]);

      const visibleStores = storeResponse.stores || [];
      setStores(visibleStores);
      setRecentReports(recentResponse.reports || []);

      const firstStore =
        selectedStore || visibleStores[0]?.store_number || "";
      setSelectedStore(firstStore);

      if (firstStore) {
        await loadTemplate(firstStore);
      }
    } catch (error) {
      Alert.alert("SVR", error.message || "Could not load SVR.");
    } finally {
      setLoading(false);
    }
  }, [loadTemplate, selectedStore]);

  useEffect(() => {
    load();
  }, []);

  async function handleStoreSelect(storeNumber) {
    setSelectedStore(storeNumber);
    setStorePickerOpen(false);
    setTemplatePayload(null);
    setValues({});
    setPreviousExpanded(true);
    setSelectedPhoto(null);

    try {
      await loadTemplate(storeNumber);
    } catch (error) {
      Alert.alert("SVR", error.message || "Could not load store template.");
    }
  }

  function updateValue(fieldKey, value) {
    setValues((current) => ({
      ...current,
      [fieldKey]: value,
    }));
  }

  async function handleSubmit() {
    if (!selectedStore) {
      Alert.alert("SVR", "Select a store first.");
      return;
    }

    if (!canCreateReport) {
      Alert.alert("SVR locked", "Only supervisors and above can create Supervisor Visit Reports.");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        store_number: selectedStore,
        visit_date: templatePayload?.visit_date,
        manager_on_duty: managerOnDuty,
        values,
      };

      const response = await createSvrReport(payload);

      Alert.alert("SVR saved", `Report #${response.report?.id || ""} was created.`, [
        {
          text: "OK",
          onPress: () => {
            setManagerOnDuty("");
            loadTemplate(selectedStore);
          },
        },
      ]);
    } catch (error) {
      Alert.alert("SVR", error.message || "Could not save SVR.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingText}>Loading SVR…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const selected = stores.find((store) => store.store_number === selectedStore);

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.safe}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.kicker}>SUPERVISOR VISIT</Text>
              <Text style={styles.title}>SVR</Text>
              <Text style={styles.subtitle}>
                {selected ? `${selected.store_number} · ${selected.name}` : "Store visit report"}
              </Text>
            </View>

            {onBack && (
              <TouchableOpacity style={styles.backButton} onPress={onBack}>
                <Text style={styles.backButtonText}>Ops</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.heroCard}>
            <View style={styles.heroTopRow}>
              <View>
                <Text style={styles.heroKicker}>VISIT PROGRESS</Text>
                <Text style={styles.heroTitle}>{completionPercent}%</Text>
                <Text style={styles.heroText}>
                  {answeredCount} of {visibleFields.length} fields completed
                </Text>
              </View>

              <View style={styles.heroDateBlock}>
                <Text style={styles.heroDateLabel}>VISIT DATE</Text>
                <Text style={styles.heroDateValue}>
                  {templatePayload?.visit_date || "Today"}
                </Text>
              </View>
            </View>

            <View style={styles.heroProgressTrack}>
              <View
                style={[
                  styles.heroProgressFill,
                  { width: `${Math.max(0, Math.min(100, completionPercent))}%` },
                ]}
              />
            </View>
          </View>

          <StorePicker
            stores={stores}
            selectedStore={selectedStore}
            open={storePickerOpen}
            onToggle={() => setStorePickerOpen((value) => !value)}
            onSelect={handleStoreSelect}
          />

          <PreviousVisitCard
            report={previousReport}
            expanded={previousExpanded}
            onToggle={() =>
              setPreviousExpanded((value) => !value)
            }
            onPhotoPress={setSelectedPhoto}
          />

          {!canCreateReport ? (
            <View style={styles.lockedCard}>
              <Text style={styles.lockedTitle}>Supervisor access required</Text>
              <Text style={styles.lockedText}>
                SVRs are Supervisor Visit Reports. Managers can view SVR information for their store, but only supervisors and above can create or submit new reports.
              </Text>
            </View>
          ) : null}

          {canCreateReport ? (
            <>
          <View style={styles.detailCard}>
            <Text style={styles.cardTitle}>Visit details</Text>

            <Text style={styles.label}>Manager on duty</Text>
            <TextInput
              value={managerOnDuty}
              onChangeText={(text) => {
                setManagerOnDuty(text);
                updateValue("manager_on_duty", text);
              }}
              placeholder="Enter manager name"
              placeholderTextColor={colors.faint}
              style={styles.input}
            />
          </View>

          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Visit review</Text>
              <Text style={styles.sectionSubtitle}>Complete each section below</Text>
            </View>
          </View>

          {groupedFields.map((group) => (
            <FieldGroup
              key={group.title}
              title={group.title}
              fields={group.fields}
              values={values}
              onChange={updateValue}
            />
          ))}

          <TouchableOpacity
            style={[styles.submitButton, saving && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.submitButtonText}>Save SVR</Text>
            )}
          </TouchableOpacity>

            </>
          ) : null}

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={Boolean(selectedPhoto)}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedPhoto(null)}
      >
        <View style={styles.photoModal}>
          <TouchableOpacity
            style={styles.photoModalClose}
            onPress={() => setSelectedPhoto(null)}
            activeOpacity={0.85}
          >
            <Text style={styles.photoModalCloseText}>Close</Text>
          </TouchableOpacity>

          {selectedPhoto ? (
            <>
              <Image
                source={{ uri: selectedPhoto.image_url }}
                style={styles.photoModalImage}
                resizeMode="contain"
              />

              {selectedPhoto.caption ? (
                <Text style={styles.photoModalCaption}>
                  {selectedPhoto.caption}
                </Text>
              ) : null}
            </>
          ) : null}
        </View>
      </Modal>
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
    alignItems: "center",
    justifyContent: "space-between",
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
  heroCard: {
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
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 12,
  },
  heroDateBlock: {
    alignItems: "flex-end",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  heroDateLabel: {
    color: colors.navySoft,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.9,
  },
  heroDateValue: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
    marginTop: 3,
  },
  heroProgressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.13)",
    overflow: "hidden",
    marginTop: 16,
  },
  heroProgressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  heroKicker: {
    color: colors.navySoft,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  heroTitle: {
    color: "#ffffff",
    fontSize: 38,
    fontWeight: "900",
    letterSpacing: -0.7,
    marginTop: 3,
  },
  heroText: {
    color: colors.navySoft,
    fontWeight: "800",
    marginTop: 2,
  },
  heroBadge: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  heroBadgeText: {
    color: "#ffffff",
    fontWeight: "900",
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
  storeTextWrap: {
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
  detailCard: {
    backgroundColor: colors.card,
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    marginBottom: spacing.md,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
    marginBottom: spacing.md,
  },
  sectionHeader: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
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
  groupCard: {
    backgroundColor: colors.card,
    borderRadius: 22,
    borderColor: colors.borderSoft,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
    shadowColor: colors.shadow,
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  groupTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: -0.2,
  },
  groupMeta: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "900",
    backgroundColor: colors.primaryTint,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
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
  textArea: {
    minHeight: 82,
    textAlignVertical: "top",
  },
  fieldWrap: {
    marginBottom: spacing.sm,
  },
  readOnlyField: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderColor: colors.borderSoft,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  fieldLabel: {
    color: colors.text,
    fontWeight: "900",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 7,
  },
  readOnlyValue: {
    color: colors.muted,
    fontWeight: "800",
  },
  yesNoRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  yesNoButton: {
    flex: 1,
    backgroundColor: colors.surface,
    borderColor: colors.borderSoft,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  yesNoButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  yesNoText: {
    color: colors.text,
    fontWeight: "900",
  },
  yesNoTextActive: {
    color: "#ffffff",
  },

  lockedCard: {
    backgroundColor: "#fff7ed",
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: "#fed7aa",
    marginBottom: spacing.md,
  },
  lockedTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#9a3412",
    marginBottom: 6,
  },
  lockedText: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700",
    color: "#9a3412",
  },

  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: spacing.sm,
    shadowColor: colors.shadow,
    shadowOpacity: 0.20,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
    elevation: 5,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
  },
  bottomSpacer: {
    height: 30,
  },,

  previousCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 22,
    marginBottom: 12,
    overflow: "hidden",
  },
  previousHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: 16,
  },
  previousHeaderText: {
    flex: 1,
  },
  previousKicker: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
  },
  previousTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "900",
    marginTop: 3,
  },
  previousSubtitle: {
    color: colors.muted,
    fontWeight: "700",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  previousBadge: {
    alignItems: "flex-end",
    gap: 3,
  },
  previousBadgeText: {
    color: colors.primary,
    fontWeight: "900",
    fontSize: 11,
  },
  previousChevron: {
    color: colors.muted,
    fontSize: 18,
    fontWeight: "900",
  },
  previousBody: {
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    paddingBottom: 16,
  },
  previousPhotoRow: {
    paddingHorizontal: 16,
    paddingTop: 14,
    gap: 10,
  },
  previousPhotoButton: {
    width: 132,
  },
  previousPhoto: {
    width: 132,
    height: 104,
    borderRadius: 14,
    backgroundColor: colors.bg,
  },
  previousPhotoCaption: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
    marginTop: 5,
  },
  previousEmptyText: {
    color: colors.muted,
    fontWeight: "700",
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  photoModal: {
    flex: 1,
    backgroundColor: "rgba(2, 6, 23, 0.96)",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },
  photoModalClose: {
    position: "absolute",
    top: 54,
    right: 20,
    zIndex: 2,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderRadius: 18,
    paddingHorizontal: 15,
    paddingVertical: 9,
  },
  photoModalCloseText: {
    color: "#ffffff",
    fontWeight: "900",
  },
  photoModalImage: {
    width: "100%",
    height: "76%",
  },
  photoModalCaption: {
    color: "#ffffff",
    fontWeight: "800",
    textAlign: "center",
    marginTop: 14,
  },

});
