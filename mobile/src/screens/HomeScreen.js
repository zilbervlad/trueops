import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { loadThreads } from "../api/client";
import { colors, radius, spacing } from "../styles/theme";

function prettyRole(role) {
  return String(role || "User")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatTime(value) {
  if (!value) return "";

  try {
    const date = new Date(value);
    return date.toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function initials(name) {
  const parts = String(name || "T")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return String(name || "T").slice(0, 1).toUpperCase();
}

function threadTypeLabel(type) {
  const labels = {
    company: "Company",
    store: "Store",
    area: "Area",
    role: "Role",
    direct: "Direct",
  };

  return labels[type] || "Thread";
}

function RecentChatCard({ thread }) {
  const last = thread.last_message;
  const preview = last
    ? `${last.is_mine ? "You" : last.sender_name}: ${last.body}`
    : "No messages yet";

  return (
    <View style={styles.chatCard}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials(thread.name)}</Text>
      </View>

      <View style={styles.chatBody}>
        <View style={styles.chatTop}>
          <Text style={styles.chatName} numberOfLines={1}>
            {thread.name}
          </Text>

          {thread.unread_count > 0 ? (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{thread.unread_count}</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.chatPreview} numberOfLines={1}>
          {preview}
        </Text>

        <Text style={styles.chatMeta}>
          {threadTypeLabel(thread.thread_type)}
          {last?.created_at ? ` · ${formatTime(last.created_at)}` : ""}
        </Text>
      </View>
    </View>
  );
}

export default function HomeScreen({ context }) {
  const user = context?.user;
  const company = context?.company;
  const stores = context?.stores || [];
  const modules = context?.modules || [];

  const [threads, setThreads] = useState([]);
  const [threadsLoading, setThreadsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const activeTools = useMemo(
    () => modules.filter((item) => item.enabled).length,
    [modules]
  );

  const recentThreads = useMemo(() => threads.slice(0, 3), [threads]);

  const loadHome = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setThreadsLoading(true);

    try {
      const data = await loadThreads();
      setThreads(data.threads || []);
    } catch {
      setThreads([]);
    } finally {
      setThreadsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadHome();
  }, [loadHome]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        style={styles.page}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadHome({ quiet: true });
            }}
          />
        }
      >
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.kicker}>TRUEOPS</Text>
            <Text style={styles.title} numberOfLines={1}>
              {user?.name || "Welcome"}
            </Text>
            <Text style={styles.subtitle}>
              {company?.name || "Company"} · {prettyRole(user?.role)}
            </Text>
          </View>

          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>{prettyRole(user?.role)}</Text>
          </View>
        </View>

        <View style={styles.heroCard}>
          <Text style={styles.heroKicker}>Today</Text>
          <Text style={styles.heroTitle}>Run the day.</Text>
          <Text style={styles.heroText}>
            Messages, Checklist, SVR, and Maintenance are ready from mobile.
          </Text>
        </View>

        <View style={styles.grid}>
          <View style={styles.metricCard}>
            <Text style={styles.metricNumber}>{stores.length}</Text>
            <Text style={styles.metricLabel}>Stores</Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricNumber}>{activeTools}</Text>
            <Text style={styles.metricLabel}>Tools</Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricNumber}>{threads.length}</Text>
            <Text style={styles.metricLabel}>Chats</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent chats</Text>
          <Text style={styles.sectionMeta}>Latest 3</Text>
        </View>

        {threadsLoading ? (
          <View style={styles.stateCard}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.stateText}>Loading chats…</Text>
          </View>
        ) : recentThreads.length ? (
          <View style={styles.chatList}>
            {recentThreads.map((thread) => (
              <RecentChatCard key={thread.id} thread={thread} />
            ))}
          </View>
        ) : (
          <View style={styles.stateCard}>
            <Text style={styles.emptyTitle}>No recent chats</Text>
            <Text style={styles.stateText}>Your latest conversations will show here.</Text>
          </View>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Quick actions</Text>
          <Text style={styles.sectionMeta}>Ops</Text>
        </View>

        <View style={styles.quickGrid}>
          <View style={styles.quickCard}>
            <Text style={styles.quickIcon}>✓</Text>
            <View style={styles.quickBody}>
              <Text style={styles.quickTitle}>Checklist</Text>
              <Text style={styles.quickText}>Daily store rhythm</Text>
            </View>
          </View>

          <View style={styles.quickCard}>
            <Text style={styles.quickIcon}>↗</Text>
            <View style={styles.quickBody}>
              <Text style={styles.quickTitle}>SVR</Text>
              <Text style={styles.quickText}>Visit report</Text>
            </View>
          </View>

          <View style={styles.quickCard}>
            <Text style={styles.quickIcon}>⚙</Text>
            <View style={styles.quickBody}>
              <Text style={styles.quickTitle}>Maintenance</Text>
              <Text style={styles.quickText}>Open tasks</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  page: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: 110,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
    marginBottom: spacing.md,
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
    fontSize: 31,
    fontWeight: "900",
    letterSpacing: -1,
    marginTop: 2,
  },
  subtitle: {
    color: colors.muted,
    marginTop: 3,
    fontWeight: "800",
  },
  roleBadge: {
    backgroundColor: colors.primaryTint,
    borderRadius: radius.pill,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: colors.primarySoft,
  },
  roleBadgeText: {
    color: colors.primaryDark,
    fontSize: 11,
    fontWeight: "900",
  },
  heroCard: {
    backgroundColor: colors.navy,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
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
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  heroTitle: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: -0.7,
    marginTop: 4,
  },
  heroText: {
    color: colors.navySoft,
    fontWeight: "800",
    lineHeight: 20,
    marginTop: 5,
  },
  grid: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  metricCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  metricNumber: {
    color: colors.text,
    fontSize: 23,
    fontWeight: "900",
    marginBottom: 2,
  },
  metricLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "900",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  sectionMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "900",
  },
  chatList: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  chatCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    flexDirection: "row",
    gap: spacing.md,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: colors.primaryTint,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: colors.primaryDark,
    fontWeight: "900",
  },
  chatBody: {
    flex: 1,
  },
  chatTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  chatName: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
  },
  unreadBadge: {
    backgroundColor: colors.primary,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  unreadText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "900",
  },
  chatPreview: {
    color: colors.muted,
    fontWeight: "800",
    marginTop: 3,
  },
  chatMeta: {
    color: colors.faint,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 4,
  },
  stateCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.lg,
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
  },
  stateText: {
    color: colors.muted,
    fontWeight: "800",
    textAlign: "center",
  },
  quickGrid: {
    gap: spacing.sm,
  },
  quickCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  quickIcon: {
    width: 34,
    color: colors.primary,
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center",
  },
  quickBody: {
    flex: 1,
  },
  quickTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
  },
  quickText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 2,
  },
});
