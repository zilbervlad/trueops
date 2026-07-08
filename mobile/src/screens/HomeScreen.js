import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { loadThreads } from "../api/client";
import { colors } from "../styles/theme";

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

function getGreeting(name) {
  const hour = new Date().getHours();
  const firstName = String(name || "there").trim().split(/\s+/)[0];

  if (hour < 12) return `Good morning, ${firstName}`;
  if (hour < 17) return `Good afternoon, ${firstName}`;
  return `Good evening, ${firstName}`;
}

function SummaryStat({ value, label }) {
  return (
    <View style={styles.summaryStat}>
      <Text style={styles.summaryStatValue}>{value}</Text>
      <Text style={styles.summaryStatLabel}>{label}</Text>
    </View>
  );
}

function ChatRow({ thread, onPress }) {
  const last = thread.last_message;
  const preview = last
    ? `${last.is_mine ? "You" : last.sender_name}: ${last.body}`
    : "No messages yet";

  return (
    <Pressable style={({ pressed }) => [styles.chatRow, pressed && styles.chatRowPressed]} onPress={onPress}>
      <View style={styles.chatAvatar}>
        <Text style={styles.chatAvatarText}>{initials(thread.name)}</Text>
      </View>

      <View style={styles.chatBody}>
        <View style={styles.chatTop}>
          <Text style={styles.chatName} numberOfLines={1}>
            {thread.name}
          </Text>

          {thread.unread_count > 0 ? (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{thread.unread_count}</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.chatPreview} numberOfLines={1}>
          {preview}
        </Text>

        <Text style={styles.chatMeta}>
          {last?.created_at ? formatTime(last.created_at) : "Recent conversation"}
        </Text>
      </View>
    </Pressable>
  );
}

export default function HomeScreen({ context, navigation }) {
  const user = context?.user;
  const company = context?.company;

  const [threads, setThreads] = useState([]);
  const [threadsLoading, setThreadsLoading] = useState(true);

  useEffect(() => {
    async function loadHome() {
      try {
        const data = await loadThreads();
        setThreads(data.threads || []);
      } catch {
        setThreads([]);
      } finally {
        setThreadsLoading(false);
      }
    }

    loadHome();
  }, []);

  const recentThreads = useMemo(() => threads.slice(0, 4), [threads]);

  const unreadCount = useMemo(
    () => threads.reduce((sum, thread) => sum + (thread.unread_count || 0), 0),
    [threads]
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        style={styles.page}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.summaryCard}>
          <View style={styles.summaryTop}>
            <View style={styles.summaryText}>
              <Text style={styles.summaryKicker}>TRUEOPS</Text>
              <Text style={styles.summaryTitle} numberOfLines={1}>{getGreeting(user?.name)}</Text>
              <Text style={styles.summarySubtitle}>
                {prettyRole(user?.role)} · {company?.name || "TrueOps"}
              </Text>
            </View>

            <View style={styles.profileCircle}>
              <Text style={styles.profileCircleText}>{initials(user?.name)}</Text>
            </View>
          </View>

          <View style={styles.summaryDivider} />

          <View style={styles.summaryStatsRow}>
            <SummaryStat value={unreadCount} label="UNREAD" />
            <View style={styles.summaryStatsDivider} />
            <SummaryStat value={threads.length} label="THREADS" />
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Latest Update</Text>
            <Text style={styles.sectionSubtitle}>Account overview</Text>
          </View>
        </View>

        <View style={styles.updateCard}>
          <View style={styles.updateIcon}>
            <Text style={styles.updateIconText}>i</Text>
          </View>

          <View style={styles.updateBody}>
            <Text style={styles.updateEyebrow}>TRUEOPS STATUS</Text>
            <Text style={styles.updateTitle}>{prettyRole(user?.role)} Access</Text>
            <Text style={styles.updateText}>
              Signed in to {company?.name || "TrueOps"}.
            </Text>
            <Text style={styles.updateMeta}>
              {user?.name || "User"} · Active now
            </Text>
          </View>

          <Pressable
            style={({ pressed }) => [styles.openButton, pressed && styles.openButtonPressed]}
            onPress={() => navigation?.navigate("More")}
          >
            <Text style={styles.openButtonText}>Open</Text>
          </Pressable>
        </View>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Recent Chats</Text>
            <Text style={styles.sectionSubtitle}>Latest team activity</Text>
          </View>

          <Pressable onPress={() => navigation?.navigate("Messages")}>
            <Text style={styles.viewAll}>View all</Text>
          </Pressable>
        </View>

        <View style={styles.chatListCard}>
          {threadsLoading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color="#ffffff" />
              <Text style={styles.loadingText}>Loading chats…</Text>
            </View>
          ) : recentThreads.length ? (
            recentThreads.map((thread, index) => (
              <View key={thread.id}>
                <ChatRow
                  thread={thread}
                  onPress={() => navigation?.navigate("Messages")}
                />
                {index < recentThreads.length - 1 ? <View style={styles.chatDivider} /> : null}
              </View>
            ))
          ) : (
            <View style={styles.loadingWrap}>
              <Text style={styles.loadingText}>No recent chats yet.</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.navy,
  },
  page: {
    flex: 1,
    backgroundColor: colors.navy,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 132,
  },

  summaryCard: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 14,
    marginBottom: 18,
  },
  summaryTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  summaryText: {
    flex: 1,
  },
  summaryKicker: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 2.1,
  },
  summaryTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.6,
    marginTop: 4,
  },
  summarySubtitle: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "800",
    marginTop: 4,
  },
  profileCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryTint,
    alignItems: "center",
    justifyContent: "center",
  },
  profileCircleText: {
    color: colors.primaryDark,
    fontSize: 17,
    fontWeight: "900",
  },
  summaryDivider: {
    height: 1,
    backgroundColor: colors.borderSoft,
    marginTop: 12,
    marginBottom: 10,
  },
  summaryStatsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  summaryStat: {
    flex: 1,
  },
  summaryStatsDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.borderSoft,
    marginHorizontal: 10,
  },
  summaryStatValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
  },
  summaryStatLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.3,
    marginTop: 1,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginBottom: 10,
    marginTop: 10,
  },
  sectionTitle: {
    color: "#ffffff",
    fontSize: 25,
    fontWeight: "900",
    letterSpacing: -0.65,
  },
  sectionSubtitle: {
    color: "#94a3b8",
    fontSize: 14,
    fontWeight: "800",
    marginTop: 2,
  },
  viewAll: {
    color: colors.primarySoft,
    fontSize: 14,
    fontWeight: "900",
  },

  updateCard: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 14,
    marginBottom: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  updateIcon: {
    width: 44,
    height: 44,
    borderRadius: 17,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  updateIconText: {
    color: "#ffffff",
    fontSize: 26,
    fontWeight: "900",
  },
  updateBody: {
    flex: 1,
  },
  updateEyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.8,
  },
  updateTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "900",
    marginTop: 3,
    letterSpacing: -0.25,
  },
  updateText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 5,
    lineHeight: 18,
  },
  updateMeta: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 8,
  },
  openButton: {
    backgroundColor: colors.primaryTint,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.primarySoft,
  },
  openButtonPressed: {
    opacity: 0.85,
  },
  openButtonText: {
    color: colors.primaryDark,
    fontSize: 14,
    fontWeight: "900",
  },

  chatListCard: {
    backgroundColor: "#12233f",
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  chatRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  chatRowPressed: {
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  chatDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginLeft: 76,
  },
  chatAvatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  chatAvatarText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
  },
  chatBody: {
    flex: 1,
  },
  chatTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  chatName: {
    flex: 1,
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
  },
  unreadBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  unreadBadgeText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "900",
  },
  chatPreview: {
    color: "#94a3b8",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 3,
  },
  chatMeta: {
    color: "#cbd5e1",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 6,
  },
  loadingWrap: {
    padding: 18,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  loadingText: {
    color: "#cbd5e1",
    fontSize: 14,
    fontWeight: "700",
  },
});
