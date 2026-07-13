import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import {
  SafeAreaView,
} from "react-native-safe-area-context";

import {
  fetchNightlyNumbersReportDetail,
  fetchNightlyNumbersReports,
} from "../api/client";

import {
  colors,
  radius,
  spacing,
} from "../styles/theme";

import NightlyNumbersFormScreen
  from "./NightlyNumbersFormScreen";


function metricText(label, value) {
  if (
    value === null
    || value === undefined
    || value === ""
  ) {
    return null;
  }

  return `${label} ${value}`;
}


function ReportRow({
  row,
  onPress,
}) {
  const report = row.report;

  const metrics = report
    ? [
        metricText(
          "ADT",
          report.adt
        ),
        metricText(
          "Load",
          report.load_time
        ),
        metricText(
          "Food",
          report.food_variance
        ),
      ].filter(Boolean)
    : [];

  return (
    <TouchableOpacity
      style={styles.reportCard}
      onPress={
        report
          ? onPress
          : undefined
      }
      activeOpacity={0.86}
    >
      <View style={styles.reportTop}>
        <View>
          <Text style={styles.storeLabel}>
            STORE
          </Text>

          <Text style={styles.storeNumber}>
            {row.store.store_number}
          </Text>

          <Text style={styles.storeName}>
            {
              row.store.name
              || row.store.area_name
              || "TrueOps store"
            }
          </Text>
        </View>

        <View
          style={[
            styles.statusBadge,
            row.submitted
              ? styles.statusSubmitted
              : styles.statusMissing,
          ]}
        >
          <Text
            style={[
              styles.statusText,
              row.submitted
                ? styles.statusTextSubmitted
                : styles.statusTextMissing,
            ]}
          >
            {
              row.submitted
                ? "Submitted"
                : "Missing"
            }
          </Text>
        </View>
      </View>

      {
        row.submitted ? (
          <>
            <Text style={styles.managerText}>
              {
                report.manager_name
                || "Nightly report"
              }
            </Text>

            <Text style={styles.metricLine}>
              {
                metrics.length
                  ? metrics.join("  ·  ")
                  : "Tap to view report"
              }
            </Text>

            <Text style={styles.openText}>
              View report ›
            </Text>
          </>
        ) : (
          <Text style={styles.missingText}>
            No Nightly Numbers report has
            been submitted for this date.
          </Text>
        )
      }
    </TouchableOpacity>
  );
}


function ReportDetail({
  report,
  onBack,
}) {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={
          styles.content
        }
      >
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBack}
          >
            <Text style={styles.backText}>
              ‹
            </Text>
          </TouchableOpacity>

          <View style={styles.headerCopy}>
            <Text style={styles.kicker}>
              NIGHTLY NUMBERS
            </Text>

            <Text style={styles.title}>
              Store {report.store_number}
            </Text>

            <Text style={styles.subtitle}>
              {report.report_date}
            </Text>
          </View>
        </View>

        <View style={styles.detailCard}>
          {
            (report.fields || []).map(
              (field) => {
                let value = field.value;

                if (
                  field.field_type
                  === "checkbox"
                ) {
                  value = value
                    ? "Yes"
                    : "No";
                }

                if (
                  value === null
                  || value === undefined
                  || value === ""
                ) {
                  value = "Not provided";
                }

                return (
                  <View
                    key={
                      `${field.id}-${field.field_key}`
                    }
                    style={styles.detailRow}
                  >
                    <Text
                      style={styles.detailLabel}
                    >
                      {field.field_label}
                    </Text>

                    <Text
                      style={styles.detailValue}
                    >
                      {String(value)}
                    </Text>
                  </View>
                );
              }
            )
          }
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}


export default function NightlyNumbersScreen({
  onBack,
}) {
  const [
    activeView,
    setActiveView,
  ] = useState("dashboard");

  const [
    reportPayload,
    setReportPayload,
  ] = useState(null);

  const [
    selectedReport,
    setSelectedReport,
  ] = useState(null);

  const [
    reportDate,
    setReportDate,
  ] = useState("");

  const [loading, setLoading] = useState(
    true
  );

  const [
    detailLoading,
    setDetailLoading,
  ] = useState(false);

  const [error, setError] = useState("");


  const rows = (
    reportPayload?.reports || []
  );


  const progressPercent = useMemo(
    () => {
      const total = (
        reportPayload?.store_count || 0
      );

      const submitted = (
        reportPayload?.submitted_count
        || 0
      );

      return total
        ? Math.round(
            (submitted / total) * 100
          )
        : 0;
    },
    [reportPayload]
  );


  const loadReports = useCallback(
    async (
      selectedDate = ""
    ) => {
      setLoading(true);
      setError("");

      try {
        const response = (
          await fetchNightlyNumbersReports(
            selectedDate
          )
        );

        setReportPayload(response);

        setReportDate(
          response.report_date || ""
        );
      } catch (loadError) {
        setError(
          loadError.message
          || "Could not load Nightly Numbers."
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );


  useEffect(
    () => {
      loadReports();
    },
    [loadReports]
  );


  async function openReport(
    reportId
  ) {
    setDetailLoading(true);

    try {
      const response = (
        await fetchNightlyNumbersReportDetail(
          reportId
        )
      );

      setSelectedReport(
        response.report
      );

      setActiveView("detail");
    } catch (detailError) {
      Alert.alert(
        "Could not open report",
        detailError.message
        || "The report could not be loaded."
      );
    } finally {
      setDetailLoading(false);
    }
  }


  if (activeView === "form") {
    return (
      <NightlyNumbersFormScreen
        onBack={async () => {
          setActiveView(
            "dashboard"
          );

          await loadReports(
            reportDate
          );
        }}
      />
    );
  }


  if (
    activeView === "detail"
    && selectedReport
  ) {
    return (
      <ReportDetail
        report={selectedReport}
        onBack={() => {
          setSelectedReport(null);
          setActiveView(
            "dashboard"
          );
        }}
      />
    );
  }


  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={
          styles.content
        }
      >
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBack}
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
              Review nightly results across
              your visible stores.
            </Text>
          </View>

          {
            reportPayload?.can_submit
            && (
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => (
                  setActiveView("form")
                )}
              >
                <Text style={styles.addText}>
                  +
                </Text>
              </TouchableOpacity>
            )
          }
        </View>


        {
          loading ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator
                color={colors.primarySoft}
              />

              <Text style={styles.loadingText}>
                Loading Nightly Numbers…
              </Text>
            </View>
          ) : error ? (
            <View style={styles.errorCard}>
              <Text style={styles.errorTitle}>
                Could not load reports
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
                    <Text style={styles.summaryLabel}>
                      SUBMISSION STATUS
                    </Text>

                    <Text style={styles.summaryValue}>
                      {
                        reportPayload
                          ?.submitted_count
                        || 0
                      }
                      {" of "}
                      {
                        reportPayload
                          ?.store_count
                        || 0
                      }
                    </Text>
                  </View>

                  <Text style={styles.percentText}>
                    {progressPercent}%
                  </Text>
                </View>

                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width:
                          `${progressPercent}%`,
                      },
                    ]}
                  />
                </View>
              </View>


              <View style={styles.dateCard}>
                <Text style={styles.dateLabel}>
                  Report Date
                </Text>

                <TextInput
                  value={reportDate}
                  onChangeText={
                    setReportDate
                  }
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={
                    colors.faint
                  }
                  style={styles.dateInput}
                />

                <TouchableOpacity
                  style={styles.loadButton}
                  onPress={() => (
                    loadReports(
                      reportDate
                    )
                  )}
                >
                  <Text style={styles.loadText}>
                    Load Date
                  </Text>
                </TouchableOpacity>
              </View>


              {
                detailLoading
                && (
                  <View
                    style={
                      styles.detailLoading
                    }
                  >
                    <ActivityIndicator
                      color={
                        colors.primarySoft
                      }
                    />

                    <Text
                      style={
                        styles.loadingText
                      }
                    >
                      Opening report…
                    </Text>
                  </View>
                )
              }


              <View style={styles.sectionRow}>
                <Text style={styles.sectionTitle}>
                  Stores
                </Text>

                <Text style={styles.sectionMeta}>
                  {rows.length} visible
                </Text>
              </View>


              {
                rows.map((row) => (
                  <ReportRow
                    key={
                      row.store.store_number
                    }
                    row={row}
                    onPress={() => (
                      openReport(
                        row.report.id
                      )
                    )}
                  />
                ))
              }
            </>
          )
        }
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
    paddingBottom: 100,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 14,
  },

  headerCopy: {
    flex: 1,
  },

  backButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor:
      "rgba(255,255,255,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },

  backText: {
    color: "#ffffff",
    fontSize: 32,
    lineHeight: 34,
  },

  addButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor:
      colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },

  addText: {
    color: colors.navy,
    fontSize: 28,
    lineHeight: 30,
    fontWeight: "900",
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
  },

  subtitle: {
    color: "#94a3b8",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
    marginTop: 3,
  },

  loadingCard: {
    minHeight: 180,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },

  loadingText: {
    color: "#94a3b8",
    fontWeight: "800",
  },

  errorCard: {
    backgroundColor: "#fff1f2",
    borderRadius: 20,
    padding: 16,
  },

  errorTitle: {
    color: "#9f1239",
    fontWeight: "900",
  },

  errorText: {
    color: "#be123c",
    marginTop: 5,
  },

  summaryCard: {
    backgroundColor: colors.card,
    borderRadius: 22,
    padding: 15,
    marginBottom: 11,
  },

  summaryTop: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  summaryLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "900",
  },

  summaryValue: {
    color: colors.navy,
    fontSize: 28,
    fontWeight: "900",
  },

  percentText: {
    color: colors.primaryDark,
    fontSize: 22,
    fontWeight: "900",
  },

  progressTrack: {
    height: 8,
    backgroundColor: "#e2e8f0",
    borderRadius: 999,
    overflow: "hidden",
    marginTop: 12,
  },

  progressFill: {
    height: "100%",
    backgroundColor:
      colors.primaryDark,
  },

  dateCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 14,
    marginBottom: 12,
  },

  dateLabel: {
    color: colors.navy,
    fontWeight: "900",
    marginBottom: 6,
  },

  dateInput: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.lg,
    paddingHorizontal: 12,
  },

  loadButton: {
    minHeight: 42,
    marginTop: 9,
    backgroundColor:
      colors.primaryTint,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
  },

  loadText: {
    color: colors.primaryDark,
    fontWeight: "900",
  },

  sectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },

  sectionTitle: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "900",
  },

  sectionMeta: {
    color: "#94a3b8",
    fontWeight: "800",
  },

  reportCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 14,
    marginBottom: 10,
  },

  reportTop: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  storeLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "900",
  },

  storeNumber: {
    color: colors.navy,
    fontSize: 23,
    fontWeight: "900",
  },

  storeName: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
  },

  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    alignSelf: "flex-start",
  },

  statusSubmitted: {
    backgroundColor: "#dcfce7",
  },

  statusMissing: {
    backgroundColor: "#fee2e2",
  },

  statusText: {
    fontSize: 11,
    fontWeight: "900",
  },

  statusTextSubmitted: {
    color: "#166534",
  },

  statusTextMissing: {
    color: "#991b1b",
  },

  managerText: {
    color: colors.navy,
    fontWeight: "900",
    marginTop: 12,
  },

  metricLine: {
    color: colors.muted,
    fontWeight: "800",
    marginTop: 5,
  },

  openText: {
    color: colors.primaryDark,
    fontWeight: "900",
    marginTop: 10,
  },

  missingText: {
    color: colors.muted,
    lineHeight: 18,
    marginTop: 12,
  },

  detailLoading: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },

  detailCard: {
    backgroundColor: colors.card,
    borderRadius: 22,
    padding: 15,
  },

  detailRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor:
      colors.borderSoft,
  },

  detailLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "900",
  },

  detailValue: {
    color: colors.navy,
    fontSize: 15,
    fontWeight: "800",
    marginTop: 4,
  },
});
