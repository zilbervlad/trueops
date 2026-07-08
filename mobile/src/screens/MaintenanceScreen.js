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

function getStatusStyle(status) {
  if (status === "complete") return styles.statusComplete;
  if (status === "in_progress") return styles.statusProgress;
  if (status === "assigned") return styles.statusAssigned;
  return styles.statusOpen;
}

function TicketCard({ ticket, onCycleStatus }) {
  return (
    <View style={styles.ticketCard}>
      <View style={styles.ticketTop}>
        <View style={styles.ticketBody}>
          <View style={styles.ticketMetaTop}>
            <Text style={styles.ticketStore}>Store {ticket.store_number}</Text>
            <Text style={styles.ticketSource}>{ticket.source_type === "svr" ? "SVR" : "Manual"}</Text>
          </View>

          <Text style={styles.ticketTitle}>{ticket.title}</Text>
        </View>

        <TouchableOpacity
          style={[styles.statusPill, getStatusStyle(ticket.status)]}
          onPress={() => onCycleStatus(ticket)}
          activeOpacity={0.85}
        >
          <Text style={styles.statusText}>{pretty(ticket.status)}</Text>
        </TouchableOpacity>
      </View>

      {!!ticket.details && <Text style={styles.ticketDetails}>{ticket.details}</Text>}

      <View style={styles.ticketFooter}>
        <View style={styles.priorityPill}>
          <Text style={styles.priorityText}>{pretty(ticket.priority || "normal")}</Text>
        </View>

        <Text style={styles.nextText}>Tap status to advance</Text>
      </View>
    </View>
  );
}

function StoreSelect({ stores, storeNumber, open, onToggle, onSelect }) {
  const selected = stores.find((store) => store.store_number === storeNumber);

  return (
    <View>
      <Text style={styles.label}>Store</Text>
      <TouchableOpacity style={styles.selectButton} onPress={onToggle} activeOpacity={0.85}>
        <Text style={styles.selectText} numberOfLines={1}>
          {selected ? `${selected.store_number} · ${selected.name}` : "Select store"}
        </Text>
        <Text style={styles.chevron}>{open ? "⌃" : "⌄"}</Text>
      </TouchableOpacity>

      {open && (
        <View style={styles.storeList}>
          {stores.map((store) => (
            <TouchableOpacity
              key={`${store.company_id}-${store.store_number}`}
              style={[
                styles.storeRow,
                store.store_number === storeNumber && styles.storeRowActive,
              ]}
              onPress={() => onSelect(store.store_number)}
              activeOpacity={0.85}
            >
              <Text style={styles.storeRowText}>{store.store_number} · {store.name}</Text>
              <Text style={styles.storeRowArea}>{store.area_name || "No area"}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
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
      setStoreOpen(false);
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
            <StoreSelect
              stores={stores}
              storeNumber={storeNumber}
              open={storeOpen}
              onToggle={() => setStoreOpen((value) => !value)}
              onSelect={(nextStore) => {
                setStoreNumber(nextStore);
                setStoreOpen(false);
              }}
            />

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
              placeholder="Add useful details..."
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
                  activeOpacity={0.85}
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
            activeOpacity={0.85}
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

        <View style={styles.heroCard}>
          <View>
            <Text style={styles.heroKicker}>Active Work</Text>
            <Text style={styles.heroNumber}>{activeCount}</Text>
            <Text style={styles.heroText}>open / active tasks</Text>
          </View>

          <TouchableOpacity style={styles.newButton} onPress={() => setCreateOpen(true)} activeOpacity={0.85}>
            <Text style={styles.newButtonText}>+ New</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.filterBlock}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterContent}>
            {STATUSES.map((status) => (
              <TouchableOpacity
                key={status.value || "all"}
                style={[styles.filterPill, statusFilter === status.value && styles.filterPillActive]}
                onPress={() => setStatusFilter(status.value)}
                activeOpacity={0.85}
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

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterContent}>
            <TouchableOpacity
              style={[styles.filterPill, storeFilter === "" && styles.filterPillActive]}
              onPress={() => setStoreFilter("")}
              activeOpacity={0.85}
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
                activeOpacity={0.85}
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
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Tickets</Text>
          <Text style={styles.sectionMeta}>{tickets.length} shown</Text>
        </View>

        {loading ? (
          <View style={styles.stateBox}>
            <ActivityIndicator color={colors.primary} />
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
  heroCard: {
    backgroundColor: colors.navy,
    borderRadius: 26,
    padding: spacing.lg,
    marginBottom: spacing.md,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
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
  heroNumber: {
    color: "#ffffff",
    fontSize: 42,
    fontWeight: "900",
    letterSpacing: -1.2,
    marginTop: 2,
  },
  heroText: {
    color: colors.navySoft,
    fontWeight: "800",
    marginTop: -2,
  },
  newButton: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    paddingHorizontal: 17,
    paddingVertical: 12,
  },
  newButtonText: {
    color: colors.text,
    fontWeight: "900",
  },
  filterBlock: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  filterContent: {
    gap: spacing.sm,
    paddingRight: spacing.lg,
  },
  filterPill: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  filterPillActive: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  filterPillText: {
    color: colors.text,
    fontWeight: "900",
    fontSize: 12,
  },
  filterPillTextActive: {
    color: "#ffffff",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 21,
    fontWeight: "900",
    letterSpacing: -0.4,
  },
  sectionMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "900",
  },
  stateBox: {
    backgroundColor: colors.card,
    borderColor: colors.borderSoft,
    borderWidth: 1,
    borderRadius: 26,
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.sm,
  },
  stateText: {
    color: colors.muted,
    fontWeight: "800",
    textAlign: "center",
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
  },
  ticketCard: {
    backgroundColor: colors.card,
    borderColor: colors.borderSoft,
    borderWidth: 1,
    borderRadius: 26,
    padding: spacing.md,
    marginBottom: spacing.sm,
    shadowColor: colors.shadow,
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  ticketTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  ticketBody: {
    flex: 1,
  },
  ticketMetaTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: 4,
  },
  ticketStore: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  ticketSource: {
    color: colors.faint,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  ticketTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 21,
  },
  ticketDetails: {
    color: colors.muted,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: spacing.sm,
  },
  statusPill: {
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 7,
    minWidth: 74,
    alignItems: "center",
  },
  statusText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "900",
  },
  statusOpen: {
    backgroundColor: colors.dangerSoft,
  },
  statusAssigned: {
    backgroundColor: colors.warningSoft,
  },
  statusProgress: {
    backgroundColor: colors.infoSoft,
  },
  statusComplete: {
    backgroundColor: colors.successSoft,
  },
  ticketFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    paddingTop: spacing.sm,
  },
  priorityPill: {
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  priorityText: {
    color: colors.textSoft,
    fontSize: 11,
    fontWeight: "900",
  },
  nextText: {
    color: colors.faint,
    fontSize: 11,
    fontWeight: "800",
  },
  formCard: {
    backgroundColor: colors.card,
    borderColor: colors.borderSoft,
    borderWidth: 1,
    borderRadius: 26,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  label: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginBottom: 6,
  },
  selectButton: {
    backgroundColor: colors.surface,
    borderColor: colors.borderSoft,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 13,
    paddingVertical: 11,
    marginBottom: spacing.md,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  selectText: {
    color: colors.text,
    fontWeight: "900",
    flex: 1,
  },
  chevron: {
    color: colors.faint,
    fontSize: 18,
    fontWeight: "900",
  },
  storeList: {
    gap: spacing.sm,
    marginBottom: spacing.md,
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
    minHeight: 96,
    textAlignVertical: "top",
  },
  priorityRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  priorityButton: {
    backgroundColor: colors.surface,
    borderColor: colors.borderSoft,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  priorityButtonActive: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  priorityButtonText: {
    color: colors.text,
    fontWeight: "900",
  },
  priorityButtonTextActive: {
    color: "#ffffff",
  },
  submitButton: {
    backgroundColor: colors.text,
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: "center",
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
});
