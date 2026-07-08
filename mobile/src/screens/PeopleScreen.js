import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { createDirectThread, loadMessagePeople } from "../api/client";
import { colors } from "../styles/theme";

function initialsFor(person) {
  const name = (person.name || person.username || "?").trim();
  const parts = name.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return name.slice(0, 2).toUpperCase();
}

function prettyRole(role) {
  const value = (role || "").replace(/_/g, " ").trim();
  if (!value) return "Team Member";
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function phoneFor(person) {
  return (
    person.phone ||
    person.phone_number ||
    person.mobile_phone ||
    person.cell_phone ||
    ""
  ).trim();
}

async function openPhoneLink(type, person) {
  const phone = phoneFor(person);

  if (!phone) {
    Alert.alert("No phone number", "This person does not have a phone number saved yet.");
    return;
  }

  const scheme = type === "sms" ? "sms" : "tel";
  const url = `${scheme}:${phone.replace(/[^+\d]/g, "")}`;

  const supported = await Linking.canOpenURL(url);

  if (!supported) {
    Alert.alert("Not available", type === "sms" ? "Text messaging is not available here." : "Calling is not available here.");
    return;
  }

  await Linking.openURL(url);
}

function PersonCard({ person, onMessage }) {
  const scope = person.store_number
    ? `Store ${person.store_number}`
    : person.area_name || "Company";

  return (
    <Pressable style={({ pressed }) => [styles.personCard, pressed && styles.cardPressed]}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initialsFor(person)}</Text>
      </View>

      <View style={styles.personBody}>
        <View style={styles.personTopRow}>
          <Text style={styles.personName} numberOfLines={1}>
            {person.name || person.username}
          </Text>
          <View style={styles.rolePill}>
            <Text style={styles.roleText}>{prettyRole(person.role)}</Text>
          </View>
        </View>

        <Text style={styles.personMeta} numberOfLines={1}>
          {scope}
          {person.email ? ` · ${person.email}` : ""}
        </Text>

        <Text style={styles.personUsername} numberOfLines={1}>
          @{person.username}
        </Text>

        <View style={styles.actionRow}>
          <Pressable style={styles.actionButtonPrimary} onPress={() => onMessage(person)}>
            <Text style={styles.actionButtonPrimaryText}>Message</Text>
          </Pressable>

          <Pressable style={styles.actionButton} onPress={() => openPhoneLink("tel", person)}>
            <Text style={styles.actionButtonText}>Call</Text>
          </Pressable>

          <Pressable style={styles.actionButton} onPress={() => openPhoneLink("sms", person)}>
            <Text style={styles.actionButtonText}>Text</Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

export default function PeopleScreen({ navigation }) {
  const [people, setPeople] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function handleMessage(person) {
    try {
      const data = await createDirectThread(person.id);

      if (navigation?.navigate) {
        navigation.navigate("Messages", {
          threadId: data.thread?.id,
        });
      }
    } catch (err) {
      Alert.alert("Could not open chat", err.message || "Please try again.");
    }
  }

  async function loadPeople({ silent = false } = {}) {
    try {
      if (!silent) setLoading(true);
      setError("");

      const data = await loadMessagePeople();
      setPeople(data.people || []);
    } catch (err) {
      setError(err.message || "Could not load people.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadPeople();
  }, []);

  const filteredPeople = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return people;

    return people.filter((person) => {
      const haystack = [
        person.name,
        person.username,
        person.role,
        person.store_number,
        person.area_name,
        person.email,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(needle);
    });
  }, [people, search]);

  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.kicker}>TRUEOPS</Text>
          <Text style={styles.title}>People</Text>
          <Text style={styles.subtitle}>Find active people in your company.</Text>
        </View>

        <View style={styles.countBadge}>
          <Text style={styles.countNumber}>{people.length}</Text>
          <Text style={styles.countLabel}>people</Text>
        </View>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.searchCard}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search name, role, store, area..."
          placeholderTextColor={colors.faint}
          style={styles.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <View style={styles.listHeader}>
        <Text style={styles.sectionTitle}>Directory</Text>
        <Text style={styles.sectionMeta}>{filteredPeople.length} shown</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.stateText}>Loading people…</Text>
        </View>
      ) : (
        <FlatList
          data={filteredPeople}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadPeople({ silent: true });
              }}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>
                {search.trim() ? "No matching people" : "No people yet"}
              </Text>
              <Text style={styles.emptyText}>
                {search.trim()
                  ? "Try a different name, role, store, or area."
                  : "People will show here once users are active."}
              </Text>
            </View>
          }
          renderItem={({ item }) => <PersonCard person={item} onMessage={handleMessage} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.navy },
  header: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  headerText: { flex: 1 },
  kicker: {
    color: colors.primarySoft,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    color: "#ffffff",
    letterSpacing: -0.8,
    marginTop: 1,
  },
  subtitle: {
    color: "#94a3b8",
    marginTop: 3,
    fontWeight: "800",
    fontSize: 13,
    lineHeight: 17,
  },
  countBadge: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 64,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  countNumber: { color: colors.text, fontSize: 16, fontWeight: "900" },
  countLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "900",
    marginTop: -1,
  },
  error: {
    marginHorizontal: 16,
    marginBottom: 10,
    color: colors.danger,
    fontWeight: "800",
    backgroundColor: colors.dangerSoft,
    borderRadius: 18,
    padding: 12,
  },
  searchCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 6,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    marginHorizontal: 16,
    marginBottom: 10,
  },
  searchInput: {
    backgroundColor: colors.surface,
    borderRadius: 17,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
  },
  listHeader: {
    paddingHorizontal: 16,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: -0.4,
  },
  sectionMeta: { color: "#94a3b8", fontSize: 12, fontWeight: "900" },
  listContent: { paddingHorizontal: 16, paddingBottom: 116, gap: 8 },
  personCard: {
    backgroundColor: "#ffffff",
    borderColor: colors.borderSoft,
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  cardPressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: colors.primaryTint,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: colors.primaryDark, fontSize: 14, fontWeight: "900" },
  personBody: { flex: 1 },
  personTopRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  personName: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: -0.25,
  },
  rolePill: {
    backgroundColor: colors.primaryTint,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.primarySoft,
  },
  roleText: { color: colors.primaryDark, fontSize: 10, fontWeight: "900" },
  personMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 2,
  },
  personUsername: {
    color: colors.faint,
    fontSize: 11,
    fontWeight: "900",
    marginTop: 2,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 9,
  },
  actionButtonPrimary: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  actionButtonPrimaryText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "900",
  },
  actionButton: {
    backgroundColor: colors.primaryTint,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: colors.primarySoft,
  },
  actionButtonText: {
    color: colors.primaryDark,
    fontSize: 11,
    fontWeight: "900",
  },

  center: {
    padding: 18,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  stateText: { color: "#cbd5e1", fontSize: 13, fontWeight: "800" },
  emptyCard: {
    backgroundColor: "#ffffff",
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    alignItems: "center",
    marginTop: 20,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "900",
    textAlign: "center",
  },
  emptyText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
    lineHeight: 18,
    marginTop: 6,
  },
});
