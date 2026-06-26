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

function StorePicker({ stores, selectedStore, open, onToggle, onSelect }) {
  const selected = stores.find((store) => store.store_number === selectedStore);

  return (
    <View style={styles.card}>
      <TouchableOpacity style={styles.storeButton} onPress={onToggle} activeOpacity={0.85}>
        <View>
          <Text style={styles.label}>Store</Text>
          <Text style={styles.storeText}>
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
              <Text style={styles.storeRowText}>
                {store.store_number} · {store.name}
              </Text>
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

  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{field.field_label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="Add notes..."
        placeholderTextColor={colors.faint}
        multiline={field.field_type !== "text"}
        style={[styles.input, field.field_type !== "text" && styles.textArea]}
      />
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
    () => fields.filter((field) => field.field_key !== "manager_on_duty"),
    [fields]
  );

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
          <ActivityIndicator />
          <Text style={styles.loadingText}>Loading SVR…</Text>
        </View>
      </SafeAreaView>
    );
  }

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
              <Text style={styles.subtitle}>Create a store visit report from mobile.</Text>
            </View>

            {onBack && (
              <TouchableOpacity style={styles.backButton} onPress={onBack}>
                <Text style={styles.backButtonText}>Ops</Text>
              </TouchableOpacity>
            )}
          </View>

          <StorePicker
            stores={stores}
            selectedStore={selectedStore}
            open={storePickerOpen}
            onToggle={() => setStorePickerOpen((value) => !value)}
            onSelect={handleStoreSelect}
          />

          <View style={styles.card}>
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

            <Text style={styles.label}>Visit date</Text>
            <View style={styles.dateBox}>
              <Text style={styles.dateText}>{templatePayload?.visit_date || "Today"}</Text>
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Report fields</Text>
            <Text style={styles.sectionSubtitle}>{visibleFields.length} fields</Text>
          </View>

          {visibleFields.map((field) => (
            <FieldInput
              key={`${field.id}-${field.field_key}`}
              field={field}
              value={values[field.field_key] || ""}
              onChange={(value) => updateValue(field.field_key, value)}
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
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: 110 },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  loadingText: { color: colors.muted, fontWeight: "800" },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  headerText: { flex: 1, paddingRight: 12 },
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
    lineHeight: 20,
  },
  backButton: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  backButtonText: { color: colors.text, fontWeight: "900" },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
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
  storeText: { color: colors.text, fontSize: 17, fontWeight: "900" },
  chevron: { color: colors.muted, fontSize: 24, fontWeight: "900" },
  storeList: { marginTop: spacing.md, gap: 8 },
  storeRow: {
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  storeRowActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  storeRowText: { color: colors.text, fontWeight: "900" },
  storeRowArea: { color: colors.muted, marginTop: 2, fontWeight: "700" },
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
    minHeight: 46,
  },
  textArea: { minHeight: 104, textAlignVertical: "top" },
  dateBox: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  dateText: { color: colors.text, fontWeight: "900" },
  sectionHeader: { marginTop: 4, marginBottom: spacing.sm },
  sectionTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.4,
  },
  sectionSubtitle: { color: colors.muted, fontWeight: "800", marginTop: 3 },
  fieldWrap: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderColor: colors.border,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: 10,
  },
  readOnlyField: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderColor: colors.border,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: 10,
  },
  fieldLabel: {
    color: colors.text,
    fontWeight: "900",
    fontSize: 15,
    lineHeight: 21,
    marginBottom: 9,
  },
  readOnlyValue: { color: colors.muted, fontWeight: "800" },
  yesNoRow: { flexDirection: "row", gap: 8 },
  yesNoButton: {
    flex: 1,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: "center",
  },
  yesNoButtonActive: { backgroundColor: colors.text, borderColor: colors.text },
  yesNoText: { color: colors.text, fontWeight: "900" },
  yesNoTextActive: { color: "#ffffff" },
  submitButton: {
    backgroundColor: colors.text,
    borderRadius: radius.lg,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: spacing.md,
  },
  submitButtonDisabled: { opacity: 0.7 },
  submitButtonText: { color: "#ffffff", fontSize: 16, fontWeight: "900" },
  bottomSpacer: { height: 30 },
});
