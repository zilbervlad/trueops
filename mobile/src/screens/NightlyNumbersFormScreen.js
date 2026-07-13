import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import {
  SafeAreaView,
} from "react-native-safe-area-context";

import {
  fetchNightlyNumbersForm,
  fetchNightlyNumbersStores,
  submitNightlyNumbers,
} from "../api/client";

import {
  colors,
  radius,
  spacing,
} from "../styles/theme";


function formatFieldValue(field) {
  const value = field?.value;

  if (field?.field_type === "checkbox") {
    return Boolean(value);
  }

  if (
    value === null
    || value === undefined
  ) {
    return "";
  }

  return String(value);
}


function FieldControl({
  field,
  value,
  onChange,
}) {
  const requiredMark = field.is_required
    ? " *"
    : "";

  if (field.field_type === "checkbox") {
    return (
      <View style={styles.checkboxCard}>
        <View style={styles.checkboxCopy}>
          <Text style={styles.fieldLabel}>
            {field.field_label}
            {requiredMark}
          </Text>

          <Text style={styles.checkboxHint}>
            {value ? "Yes" : "No"}
          </Text>
        </View>

        <Switch
          value={Boolean(value)}
          onValueChange={onChange}
          trackColor={{
            false: "#cbd5e1",
            true: colors.primarySoft,
          }}
          thumbColor={
            value
              ? colors.primaryDark
              : "#ffffff"
          }
        />
      </View>
    );
  }

  const multiline = (
    field.field_type === "textarea"
  );

  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>
        {field.field_label}
        {requiredMark}
      </Text>

      <TextInput
        value={String(value ?? "")}
        onChangeText={onChange}
        placeholder={
          field.placeholder
          || (
            multiline
              ? "Add details..."
              : "Enter value"
          )
        }
        placeholderTextColor={colors.faint}
        multiline={multiline}
        keyboardType="default"
        textAlignVertical={
          multiline
            ? "top"
            : "center"
        }
        style={[
          styles.input,
          multiline && styles.textArea,
        ]}
      />
    </View>
  );
}


export default function NightlyNumbersFormScreen({
  onBack,
}) {
  const [stores, setStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState("");
  const [reportDate, setReportDate] = useState("");
  const [businessDate, setBusinessDate] = useState("");

  const [fields, setFields] = useState([]);
  const [values, setValues] = useState({});

  const [
    hasExistingReport,
    setHasExistingReport,
  ] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");


  const requiredFields = useMemo(
    () => (
      fields.filter(
        (field) => field.is_required
      )
    ),
    [fields]
  );


  const completedRequiredCount = useMemo(
    () => (
      requiredFields.filter((field) => {
        const value = values[field.field_key];

        if (
          field.field_type === "checkbox"
        ) {
          return value === true;
        }

        return (
          String(value ?? "").trim() !== ""
        );
      }).length
    ),
    [requiredFields, values]
  );


  const completionPercent = (
    requiredFields.length
      ? Math.round(
          (
            completedRequiredCount
            / requiredFields.length
          ) * 100
        )
      : 100
  );


  const loadForm = useCallback(
    async (
      storeNumber,
      selectedDate = ""
    ) => {
      const response = (
        await fetchNightlyNumbersForm(
          storeNumber,
          selectedDate
        )
      );

      const nextFields = (
        response.fields || []
      );

      const nextValues = {};

      for (const field of nextFields) {
        nextValues[field.field_key] = (
          formatFieldValue(field)
        );
      }

      setFields(nextFields);
      setValues(nextValues);

      setSelectedStore(
        response.store?.store_number
        || storeNumber
        || ""
      );

      setReportDate(
        response.report_date
        || ""
      );

      setBusinessDate(
        response.business_date
        || ""
      );

      setHasExistingReport(
        Boolean(
          response.has_existing_report
        )
      );
    },
    []
  );


  const load = useCallback(
    async () => {
      setLoading(true);
      setError("");

      try {
        const storeResponse = (
          await fetchNightlyNumbersStores()
        );

        const visibleStores = (
          storeResponse.stores || []
        );

        setStores(visibleStores);

        if (!storeResponse.can_submit) {
          setError(
            "Nightly Numbers submission is available to store managers."
          );
          return;
        }

        const initialStore = (
          visibleStores[0]?.store_number
          || ""
        );

        if (!initialStore) {
          setError(
            "No store is assigned to your account."
          );
          return;
        }

        await loadForm(initialStore);
      } catch (loadError) {
        setError(
          loadError.message
          || "Could not load Nightly Numbers."
        );
      } finally {
        setLoading(false);
      }
    },
    [loadForm]
  );


  useEffect(
    () => {
      load();
    },
    [load]
  );


  function updateValue(
    fieldKey,
    value
  ) {
    setValues((current) => ({
      ...current,
      [fieldKey]: value,
    }));
  }


  async function reloadSelectedDate() {
    if (
      !selectedStore
      || !reportDate
    ) {
      Alert.alert(
        "Date required",
        "Enter a report date in YYYY-MM-DD format."
      );
      return;
    }

    setLoading(true);
    setError("");

    try {
      await loadForm(
        selectedStore,
        reportDate
      );
    } catch (loadError) {
      setError(
        loadError.message
        || "Could not load that report date."
      );
    } finally {
      setLoading(false);
    }
  }


  async function handleSubmit() {
    const missing = (
      requiredFields.filter((field) => {
        const value = values[field.field_key];

        if (
          field.field_type === "checkbox"
        ) {
          return value !== true;
        }

        return (
          String(value ?? "").trim() === ""
        );
      })
    );

    if (missing.length) {
      Alert.alert(
        "Required fields",
        `Complete: ${missing
          .map(
            (field) => field.field_label
          )
          .join(", ")}`
      );
      return;
    }

    setSaving(true);

    try {
      const response = (
        await submitNightlyNumbers({
          store_number: selectedStore,
          report_date: reportDate,
          values,
        })
      );

      setHasExistingReport(true);

      if (response.email_sent) {
        Alert.alert(
          "Nightly Numbers sent",
          "The report was saved and emailed using the normal TrueOps recipient rules."
        );
      } else {
        Alert.alert(
          "Saved — email issue",
          response.email_error
          || "The report was saved, but the email could not be sent."
        );
      }
    } catch (saveError) {
      Alert.alert(
        "Could not save",
        saveError.message
        || "Nightly Numbers could not be saved."
      );
    } finally {
      setSaving(false);
    }
  }


  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator
            size="large"
            color={colors.primarySoft}
          />

          <Text style={styles.loadingText}>
            Loading Nightly Numbers…
          </Text>
        </View>
      </SafeAreaView>
    );
  }


  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.safe}
        behavior={
          Platform.OS === "ios"
            ? "padding"
            : undefined
        }
      >
        <ScrollView
          style={styles.container}
          contentContainerStyle={
            styles.content
          }
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.headerRow}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={onBack}
              activeOpacity={0.85}
            >
              <Text style={styles.backText}>
                ‹
              </Text>
            </TouchableOpacity>

            <View style={styles.headerCopy}>
              <Text style={styles.kicker}>
                TRUEOPS
              </Text>

              <Text style={styles.title}>
                Nightly Numbers
              </Text>

              <Text style={styles.subtitle}>
                Save the nightly report and send the normal TrueOps email.
              </Text>
            </View>
          </View>


          {error ? (
            <View style={styles.errorCard}>
              <Text style={styles.errorTitle}>
                Nightly Numbers unavailable
              </Text>

              <Text style={styles.errorText}>
                {error}
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.summaryCard}>
                <View style={styles.summaryTop}>
                  <View>
                    <Text style={styles.summaryKicker}>
                      Store
                    </Text>

                    <Text style={styles.summaryTitle}>
                      {selectedStore}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.statusPill,
                      hasExistingReport
                      && styles.statusPillExisting,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        hasExistingReport
                        && styles.statusTextExisting,
                      ]}
                    >
                      {
                        hasExistingReport
                          ? "Editing saved report"
                          : "New report"
                      }
                    </Text>
                  </View>
                </View>

                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width:
                          `${completionPercent}%`,
                      },
                    ]}
                  />
                </View>

                <Text style={styles.progressText}>
                  {
                    completedRequiredCount
                  }
                  {" of "}
                  {
                    requiredFields.length
                  }
                  {" required fields complete"}
                </Text>
              </View>


              <View style={styles.dateCard}>
                <Text style={styles.fieldLabel}>
                  Report Date
                </Text>

                <TextInput
                  value={reportDate}
                  onChangeText={setReportDate}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={
                    colors.faint
                  }
                  style={styles.input}
                />

                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={
                    reloadSelectedDate
                  }
                  activeOpacity={0.86}
                >
                  <Text style={styles.secondaryText}>
                    Load This Date
                  </Text>
                </TouchableOpacity>

                <Text style={styles.dateHint}>
                  Current TrueOps business date:
                  {" "}
                  {businessDate}
                </Text>
              </View>


              <View style={styles.formCard}>
                <View style={styles.formHeader}>
                  <Text style={styles.formTitle}>
                    Store Report
                  </Text>

                  <Text style={styles.formMeta}>
                    {fields.length} fields
                  </Text>
                </View>

                {
                  fields.map((field) => (
                    <FieldControl
                      key={
                        `${field.id}-${field.field_key}`
                      }
                      field={field}
                      value={
                        values[field.field_key]
                      }
                      onChange={(value) => (
                        updateValue(
                          field.field_key,
                          value
                        )
                      )}
                    />
                  ))
                }
              </View>


              <TouchableOpacity
                style={[
                  styles.submitButton,
                  saving
                  && styles.submitButtonDisabled,
                ]}
                onPress={handleSubmit}
                disabled={saving}
                activeOpacity={0.88}
              >
                {
                  saving ? (
                    <ActivityIndicator
                      color="#ffffff"
                    />
                  ) : (
                    <Text style={styles.submitText}>
                      Save & Email Nightly Numbers
                    </Text>
                  )
                }
              </TouchableOpacity>


              <Text style={styles.footerNote}>
                Saving again for the same store and date updates the existing report. Changes appear on TrueOps web immediately.
              </Text>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
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
    gap: spacing.md,
  },

  loadingText: {
    color: "#cbd5e1",
    fontSize: 14,
    fontWeight: "800",
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 14,
  },

  backButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },

  backText: {
    color: "#ffffff",
    fontSize: 32,
    lineHeight: 34,
    fontWeight: "500",
  },

  headerCopy: {
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
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: -0.8,
    marginTop: 1,
  },

  subtitle: {
    color: "#94a3b8",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
    marginTop: 3,
  },

  errorCard: {
    backgroundColor: "#fff1f2",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#fecdd3",
    padding: 16,
  },

  errorTitle: {
    color: "#9f1239",
    fontSize: 16,
    fontWeight: "900",
  },

  errorText: {
    color: "#be123c",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
    marginTop: 5,
  },

  summaryCard: {
    backgroundColor: colors.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: 15,
    marginBottom: 11,
  },

  summaryTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  summaryKicker: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },

  summaryTitle: {
    color: colors.navy,
    fontSize: 25,
    fontWeight: "900",
    marginTop: 1,
  },

  statusPill: {
    borderRadius: 999,
    backgroundColor: colors.primaryTint,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  statusPillExisting: {
    backgroundColor: "#dcfce7",
  },

  statusText: {
    color: colors.primaryDark,
    fontSize: 11,
    fontWeight: "900",
  },

  statusTextExisting: {
    color: "#166534",
  },

  progressTrack: {
    height: 8,
    backgroundColor: "#e2e8f0",
    borderRadius: 999,
    overflow: "hidden",
    marginTop: 14,
  },

  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: colors.primaryDark,
  },

  progressText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 7,
  },

  dateCard: {
    backgroundColor: colors.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: 15,
    marginBottom: 11,
  },

  formCard: {
    backgroundColor: colors.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: 15,
    marginBottom: 12,
  },

  formHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },

  formTitle: {
    color: colors.navy,
    fontSize: 18,
    fontWeight: "900",
  },

  formMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "900",
  },

  fieldWrap: {
    marginTop: 14,
  },

  fieldLabel: {
    color: colors.navy,
    fontSize: 13,
    fontWeight: "900",
    marginBottom: 7,
  },

  input: {
    minHeight: 48,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: "#f8fafc",
    color: colors.navy,
    fontSize: 15,
    fontWeight: "700",
    paddingHorizontal: 13,
  },

  textArea: {
    minHeight: 104,
    paddingTop: 12,
    paddingBottom: 12,
  },

  checkboxCard: {
    minHeight: 66,
    marginTop: 13,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: "#f8fafc",
    paddingHorizontal: 13,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  checkboxCopy: {
    flex: 1,
    paddingRight: 12,
  },

  checkboxHint: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
  },

  secondaryButton: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    backgroundColor: colors.primaryTint,
    minHeight: 44,
    marginTop: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  secondaryText: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: "900",
  },

  dateHint: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
    marginTop: 9,
  },

  submitButton: {
    minHeight: 56,
    borderRadius: 18,
    backgroundColor: colors.primaryDark,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },

  submitButtonDisabled: {
    opacity: 0.65,
  },

  submitText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
  },

  footerNote: {
    color: "#94a3b8",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 12,
    paddingHorizontal: 10,
  },
});
