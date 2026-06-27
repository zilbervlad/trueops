import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
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

export default function SvrScreen({ onBack }) {
  const [stores, setStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState("");
  const [storePickerOpen, setStorePickerOpen] = useState(false);
  const [templatePayload, setTemplatePayload] = useState(null);
  const [values, setValues] = useState({});
  const [managerOnDuty, setManagerOnDuty] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fields = templatePayload?.fields || [];

  const visibleFields = useMemo(
    () =>
      fields.filter(
        (field) =>
          !["manager_on_duty", "store_number", "date"].includes(field.field_key)
      ),
    [fields]
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
      const storeResponse = await fetchSvrStores();
      const visibleStores = storeResponse.stores || [];
      setStores(visibleStores);

      const firstStore = selectedStore || visibleStores[0]?.store_number || "";
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
            <View>
              <Text style={styles.heroKicker}>Visit Date</Text>
              <Text style={styles.heroTitle}>{templatePayload?.visit_date || "Today"}</Text>
              <Text style={styles.heroText}>{prettyCount(visibleFields)} to review</Text>
            </View>

            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>SVR</Text>
            </View>
          </View>

          <StorePicker
            stores={stores}
            selectedStore={selectedStore}
            open={storePickerOpen}
            onToggle={() => setStorePickerOpen((value) => !value)}
            onSelect={handleStoreSelect}
          />

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
              <Text style={styles.sectionTitle}>Report notes</Text>
              <Text style={styles.sectionSubtitle}>Grouped for faster entry</Text>
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

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </KeyboardAvoidingView>
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
    gap: spacing.sm,
  },
  loadingText: {
    color: colors.muted,
    fontWeight: "800",
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  headerText: {
    flex: 1,
  },
  kicker: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.1,
  },
  title: {
    color: colors.text,
    fontSize: 32,
    fontWeight: "900",
    letterSpacing: -1,
    marginTop: 2,
  },
  subtitle: {
    color: colors.muted,
    marginTop: 4,
    fontWeight: "700",
    lineHeight: 19,
  },
  backButton: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.lg,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  backButtonText: {
    color: colors.text,
    fontWeight: "900",
  },
  heroCard: {
    backgroundColor: colors.navy,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowColor: colors.shadow,
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
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
    fontSize: 28,
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
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  heroBadgeText: {
    color: "#ffffff",
    fontWeight: "900",
  },
  controlCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
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
    borderRadius: radius.xl,
    padding: spacing.md,
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
    color: colors.muted,
    fontWeight: "800",
    marginTop: 2,
  },
  groupCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderColor: colors.borderSoft,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
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
    color: colors.muted,
    fontSize: 12,
    fontWeight: "900",
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
    minHeight: 92,
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
    borderRadius: radius.md,
    paddingVertical: 11,
    alignItems: "center",
  },
  yesNoButtonActive: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  yesNoText: {
    color: colors.text,
    fontWeight: "900",
  },
  yesNoTextActive: {
    color: "#ffffff",
  },
  submitButton: {
    backgroundColor: colors.text,
    borderRadius: radius.lg,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: spacing.sm,
    shadowColor: colors.shadow,
    shadowOpacity: 0.12,
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
  },
});
