import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  createMaintenanceTicket,
  fetchMaintenanceStores,
  fetchMaintenanceTickets,
  updateMaintenanceTicketStatus,
} from "../api/client";
import { colors, radius, spacing } from "../styles/theme";

const STATUSES = [
  { value: "", label: "All" },
  { value: "open", label: "Open" },
  { value: "assigned", label: "Assigned" },
  { value: "in_progress", label: "In Progress" },
  { value: "complete", label: "Complete" },
];

const NEXT_STATUS = {
  open: "assigned",
  assigned: "in_progress",
  in_progress: "complete",
  complete: "open",
};

function pretty(value) {
  return (value || "open")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function TicketCard({ ticket, onCycleStatus }) {
  return (
    <View style={styles.ticketCard}>
      <View style={styles.ticketTop}>
        <View style={styles.ticketBody}>
          <Text style={styles.ticketStore}>Store {ticket.store_number}</Text>
          <Text style={styles.ticketTitle}>{ticket.title}</Text>
        </View>

        <TouchableOpacity
          style={[styles.statusPill, styles[`status_${ticket.status}`] || styles.status_open]}
          onPress={() => onCycleStatus(ticket)}
          activeOpacity={0.85}
        >
          <Text style={styles.statusText}>{pretty(ticket.status)}</Text>
        </TouchableOpacity>
      </View>

      {!!ticket.details && <Text style={styles.ticketDetails}>{ticket.details}</Text>}

      <View style={styles.metaRow}>
        <Text style={styles.metaText}>Priority: {pretty(ticket.priority || "normal")}</Text>
        <Text style={styles.metaDot}>•</Text>
        <Text style={styles.metaText}>{ticket.source_type === "svr" ? "From SVR" : "Manual"}</Text>
      </View>
    </View>
  );
}

function CreateTicketModal({ visible, stores, defaultStore, onClose, onCreate }) {
  const [storeNumber, setStoreNumber] = useState(defaultStore || "");
  const [storeOpen, setStoreOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [priority, setPriority] = useState("normal");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setStoreNumber(defaultStore || stores[0]?.store_number || "");
    }
  }, [visible, defaultStore, stores]);

  async function save() {
    if (!storeNumber) {
      Alert.alert("Maintenance", "Select a store.");
      return;
    }

    if (!title.trim()) {
      Alert.alert("Maintenance", "Enter a task title.");
      return;
    }

    setSaving(true);

    try {
      await onCreate({
        store_number: storeNumber,
        title: title.trim(),
        details: details.trim(),
        priority,
      });

      setTitle("");
      setDetails("");
      setPriority("normal");
      onClose();
    } catch {
      // alert handled by parent
    } finally {
      setSaving(false);
    }
  }

  const selectedStore = stores.find((store) => store.store_number === storeNumber);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.safe}>
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.kicker}>NEW TASK</Text>
              <Text style={styles.title}>Maintenance</Text>
              <Text style={styles.subtitle}>Create a repair task for a store.</Text>
            </View>

            <TouchableOpacity style={styles.backButton} onPress={onClose}>
              <Text style={styles.backButtonText}>Close</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.label}>Store</Text>
            <TouchableOpacity style={styles.selectButton} onPress={() => setStoreOpen((v) => !v)}>
              <Text style={styles.selectText}>
                {selectedStore ? `${selectedStore.store_number} · ${selectedStore.name}` : "Select store"}
              </Text>
              <Text style={styles.chevron}>{storeOpen ? "⌃" : "⌄"}</Text>
            </TouchableOpacity>

            {storeOpen && (
              <View style={styles.storeList}>
                {stores.map((store) => (
                  <TouchableOpacity
                    key={`${store.company_id}-${store.store_number}`}
                    style={[
                      styles.storeRow,
                      store.store_number === storeNumber && styles.storeRowActive,
                    ]}
                    onPress={() => {
                      setStoreNumber(store.store_number);
                      setStoreOpen(false);
                    }}
                  >
                    <Text style={styles.storeRowText}>{store.store_number} · {store.name}</Text>
                    <Text style={styles.storeRowArea}>{store.area_name || "No area"}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <Text style={styles.label}>Task title</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="What needs fixing?"
              placeholderTextColor={colors.faint}
              style={styles.input}
            />

            <Text style={styles.label}>Details</Text>
            <TextInput
              value={details}
              onChangeText={setDetails}
              placeholder="Add details..."
              placeholderTextColor={colors.faint}
              multiline
              style={[styles.input, styles.textArea]}
            />

            <Text style={styles.label}>Priority</Text>
            <View style={styles.priorityRow}>
              {["low", "normal", "high", "urgent"].map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[styles.priorityButton, priority === option && styles.priorityButtonActive]}
                  onPress={() => setPriority(option)}
                >
                  <Text
                    style={[
                      styles.priorityButtonText,
                      priority === option && styles.priorityButtonTextActive,
                    ]}
                  >
                    {pretty(option)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity
            style={[styles.submitButton, saving && styles.submitButtonDisabled]}
            onPress={save}
            disabled={saving}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Create Task</Text>}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

export default function MaintenanceScreen({ onBack }) {
  const [stores, setStores] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [storeFilter, setStoreFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  const activeCount = useMemo(
    () => tickets.filter((ticket) => ticket.status !== "complete").length,
    [tickets]
  );

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const [storeResponse, ticketResponse] = await Promise.all([
        fetchMaintenanceStores(),
        fetchMaintenanceTickets({
          status: statusFilter,
          store_number: storeFilter,
        }),
      ]);

      setStores(storeResponse.stores || []);
      setTickets(ticketResponse.tickets || []);
    } catch (error) {
      Alert.alert("Maintenance", error.message || "Could not load maintenance.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, storeFilter]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(payload) {
    await createMaintenanceTicket(payload);
    await load();
  }

  async function handleCycleStatus(ticket) {
    const nextStatus = NEXT_STATUS[ticket.status || "open"] || "open";

    try {
      const response = await updateMaintenanceTicketStatus(ticket.id, nextStatus);
      setTickets((current) =>
        current.map((item) => (item.id === ticket.id ? response.ticket : item))
      );
    } catch (error) {
      Alert.alert("Maintenance", error.message || "Could not update status.");
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.kicker}>STORE SUPPORT</Text>
            <Text style={styles.title}>Maintenance</Text>
            <Text style={styles.subtitle}>Create, track, and close repair tasks.</Text>
          </View>

          {onBack && (
            <TouchableOpacity style={styles.backButton} onPress={onBack}>
              <Text style={styles.backButtonText}>Ops</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryNumber}>{activeCount}</Text>
          <Text style={styles.summaryLabel}>open / active tasks</Text>
          <TouchableOpacity style={styles.newButton} onPress={() => setCreateOpen(true)}>
            <Text style={styles.newButtonText}>+ New Task</Text>
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          {STATUSES.map((status) => (
            <TouchableOpacity
              key={status.value || "all"}
              style={[styles.filterPill, statusFilter === status.value && styles.filterPillActive]}
              onPress={() => setStatusFilter(status.value)}
            >
              <Text
                style={[
                  styles.filterPillText,
                  statusFilter === status.value && styles.filterPillTextActive,
                ]}
              >
                {status.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          <TouchableOpacity
            style={[styles.filterPill, storeFilter === "" && styles.filterPillActive]}
            onPress={() => setStoreFilter("")}
          >
            <Text style={[styles.filterPillText, storeFilter === "" && styles.filterPillTextActive]}>
              All Stores
            </Text>
          </TouchableOpacity>

          {stores.map((store) => (
            <TouchableOpacity
              key={`${store.company_id}-${store.store_number}`}
              style={[styles.filterPill, storeFilter === store.store_number && styles.filterPillActive]}
              onPress={() => setStoreFilter(store.store_number)}
            >
              <Text
                style={[
                  styles.filterPillText,
                  storeFilter === store.store_number && styles.filterPillTextActive,
                ]}
              >
                {store.store_number}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {loading ? (
          <View style={styles.stateBox}>
            <ActivityIndicator />
            <Text style={styles.stateText}>Loading tickets…</Text>
          </View>
        ) : tickets.length === 0 ? (
          <View style={styles.stateBox}>
            <Text style={styles.emptyTitle}>No tickets</Text>
            <Text style={styles.stateText}>Nothing matching these filters. Love that for us.</Text>
          </View>
        ) : (
          tickets.map((ticket) => (
            <TicketCard key={ticket.id} ticket={ticket} onCycleStatus={handleCycleStatus} />
          ))
        )}
      </ScrollView>

      <CreateTicketModal
        visible={createOpen}
        stores={stores}
        defaultStore={storeFilter}
        onClose={() => setCreateOpen(false)}
        onCreate={handleCreate}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: 110 },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  headerText: { flex: 1, paddingRight: 12 },
  kicker: { color: colors.primary, fontSize: 12, fontWeight: "900", letterSpacing: 1 },
  title: { color: colors.text, fontSize: 34, fontWeight: "900", letterSpacing: -1 },
  subtitle: { color: colors.muted, marginTop: 4, fontWeight: "700", lineHeight: 20 },
  backButton: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  backButtonText: { color: colors.text, fontWeight: "900" },
  summaryCard: {
    backgroundColor: colors.text,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  summaryNumber: { color: "#ffffff", fontSize: 42, fontWeight: "900" },
  summaryLabel: { color: "#dbeafe", fontWeight: "800", marginBottom: spacing.md },
  newButton: {
    alignSelf: "flex-start",
    backgroundColor: "#ffffff",
    borderRadius: radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  newButtonText: { color: colors.text, fontWeight: "900" },
  filterScroll: { marginBottom: 10 },
  filterPill: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginRight: 8,
  },
  filterPillActive: { backgroundColor: colors.text, borderColor: colors.text },
  filterPillText: { color: colors.text, fontWeight: "900" },
  filterPillTextActive: { color: "#ffffff" },
  stateBox: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: "center",
    gap: 10,
  },
  stateText: { color: colors.muted, fontWeight: "800", textAlign: "center" },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: "900" },
  ticketCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: 12,
  },
  ticketTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  ticketBody: { flex: 1 },
  ticketStore: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  ticketTitle: { color: colors.text, fontSize: 17, fontWeight: "900", lineHeight: 22 },
  ticketDetails: { color: colors.muted, fontWeight: "700", lineHeight: 20, marginTop: 9 },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: colors.surface,
  },
  statusText: { color: colors.text, fontSize: 11, fontWeight: "900" },
  status_open: { backgroundColor: "#fee2e2" },
  status_assigned: { backgroundColor: "#fef3c7" },
  status_in_progress: { backgroundColor: "#dbeafe" },
  status_complete: { backgroundColor: "#dcfce7" },
  metaRow: { flexDirection: "row", alignItems: "center", marginTop: 10, gap: 6 },
  metaText: { color: colors.muted, fontSize: 12, fontWeight: "800" },
  metaDot: { color: colors.faint, fontWeight: "900" },
  formCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  label: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    marginBottom: 7,
  },
  selectButton: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: spacing.md,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  selectText: { color: colors.text, fontWeight: "900", flex: 1 },
  chevron: { color: colors.muted, fontSize: 18, fontWeight: "900" },
  storeList: { gap: 8, marginBottom: spacing.md },
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
  textArea: { minHeight: 100, textAlignVertical: "top" },
  priorityRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  priorityButton: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  priorityButtonActive: { backgroundColor: colors.text, borderColor: colors.text },
  priorityButtonText: { color: colors.text, fontWeight: "900" },
  priorityButtonTextActive: { color: "#ffffff" },
  submitButton: {
    backgroundColor: colors.text,
    borderRadius: radius.lg,
    paddingVertical: 16,
    alignItems: "center",
  },
  submitButtonDisabled: { opacity: 0.7 },
  submitButtonText: { color: "#ffffff", fontSize: 16, fontWeight: "900" },
});
