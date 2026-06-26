import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  createDirectThread,
  ensureDefaultMessageThreads,
  hideThread,
  loadMessagePeople,
  loadThread,
  loadThreads,
  markThreadRead,
  sendThreadMessage,
} from "../api/client";
import { colors, radius } from "../styles/theme";

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

export default function MessagesScreen() {
  const [threads, setThreads] = useState([]);
  const [selectedThread, setSelectedThread] = useState(null);
  const [loading, setLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [showPeople, setShowPeople] = useState(false);
  const [people, setPeople] = useState([]);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState("all");
  const [peopleSearch, setPeopleSearch] = useState("");

  async function refreshThreads() {
    setError("");

    try {
      const data = await loadThreads();
      setThreads(data.threads || []);
    } catch (err) {
      setError(err.message || "Could not load messages.");
    } finally {
      setLoading(false);
    }
  }

  async function openPeople() {
    setPeopleSearch("");
    setShowPeople(true);
    setPeopleLoading(true);
    setError("");

    try {
      const data = await loadMessagePeople();
      setPeople(data.people || []);
    } catch (err) {
      setError(err.message || "Could not load people.");
    } finally {
      setPeopleLoading(false);
    }
  }

  async function startDirectMessage(person) {
    setPeopleLoading(true);
    setError("");

    try {
      const data = await createDirectThread(person.id);
      setShowPeople(false);
      await refreshThreads();

      if (data.thread?.id) {
        await openThread(data.thread);
      }
    } catch (err) {
      setError(err.message || "Could not start message.");
    } finally {
      setPeopleLoading(false);
    }
  }

  async function handleHideThread(thread) {
    if (!thread || thread.thread_type !== "direct") return;

    setError("");

    try {
      await hideThread(thread.id);

      if (selectedThread?.id === thread.id) {
        setSelectedThread(null);
      }

      await refreshThreads();
    } catch (err) {
      setError(err.message || "Could not hide thread.");
    }
  }

  async function openThread(thread) {
    setSelectedThread(null);
    setThreadLoading(true);
    setError("");

    try {
      const data = await loadThread(thread.id);
      setSelectedThread(data.thread);
      await markThreadRead(thread.id);
      await refreshThreads();
    } catch (err) {
      setError(err.message || "Could not open thread.");
    } finally {
      setThreadLoading(false);
    }
  }

  async function handleSend() {
    const body = draft.trim();

    if (!body || !selectedThread || sending) return;

    setSending(true);
    setDraft("");

    try {
      await sendThreadMessage(selectedThread.id, body);
      await markThreadRead(selectedThread.id);
      const data = await loadThread(selectedThread.id);
      setSelectedThread(data.thread);
      await refreshThreads();
    } catch (err) {
      setError(err.message || "Could not send message.");
      setDraft(body);
    } finally {
      setSending(false);
    }
  }

  useEffect(() => {
    async function bootMessages() {
      try {
        await ensureDefaultMessageThreads();
      } catch {
        // Non-admin users may not be allowed to create default threads. That's fine.
      }

      await refreshThreads();
    }

    bootMessages();

    const interval = setInterval(() => {
      if (!selectedThread && !showPeople) {
        refreshThreads();
      }
    }, 7000);

    return () => clearInterval(interval);
  }, [selectedThread, showPeople]);

  const filters = [
    { key: "all", label: "All" },
    { key: "company", label: "Company" },
    { key: "store", label: "Stores" },
    { key: "area", label: "Areas" },
    { key: "role", label: "Roles" },
    { key: "direct", label: "Direct" },
  ];

  const filteredThreads = threads.filter((thread) => {
    if (activeFilter === "all") return true;
    return thread.thread_type === activeFilter;
  });

  const filteredPeople = people.filter((person) => {
    const search = peopleSearch.trim().toLowerCase();

    if (!search) return true;

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

    return haystack.includes(search);
  });

  useEffect(() => {
    if (!selectedThread?.id) return;

    const interval = setInterval(async () => {
      try {
        const data = await loadThread(selectedThread.id);
        setSelectedThread(data.thread);
        await markThreadRead(selectedThread.id);
        await refreshThreads();
      } catch {
        // Keep the current thread visible if one refresh fails.
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [selectedThread?.id]);

  if (showPeople) {
    return (
      <SafeAreaView style={styles.page} edges={["top"]}>
        <View style={styles.threadHeader}>
          <Pressable onPress={() => {
            setPeopleSearch("");
            setShowPeople(false);
          }} style={styles.backButton}>
            <Text style={styles.backText}>‹ Back</Text>
          </Pressable>

          <View style={styles.threadTitleWrap}>
            <Text style={styles.threadTitle}>New Message</Text>
            <Text style={styles.threadSubtitle}>Start a direct chat</Text>
          </View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.searchWrap}>
          <TextInput
            value={peopleSearch}
            onChangeText={setPeopleSearch}
            placeholder="Search name, role, store, area..."
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {peopleLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <FlatList
            data={filteredPeople}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>
                  {peopleSearch.trim() ? "No matching people" : "No people available"}
                </Text>
                <Text style={styles.emptyText}>
                  {peopleSearch.trim()
                    ? "Try a different name, role, store, or area."
                    : "People will show here once there are active users in this company that you can message."}
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <Pressable
                style={({ pressed }) => [
                  styles.threadCard,
                  pressed && styles.threadCardPressed,
                ]}
                onPress={() => startDirectMessage(item)}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {(item.name || item.username || "P").slice(0, 1).toUpperCase()}
                  </Text>
                </View>

                <View style={styles.threadInfo}>
                  <Text style={styles.threadName} numberOfLines={1}>
                    {item.name}
                  </Text>

                  <Text style={styles.lastMessage} numberOfLines={1}>
                    {item.role || "user"}
                    {item.store_number ? ` · Store ${item.store_number}` : ""}
                    {item.area_name ? ` · ${item.area_name}` : ""}
                  </Text>
                </View>
              </Pressable>
            )}
          />
        )}
      </SafeAreaView>
    );
  }

  if (selectedThread || threadLoading) {
    return (
      <SafeAreaView style={styles.page} edges={["top"]}>
        <KeyboardAvoidingView
          style={styles.threadPage}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
        <View style={styles.threadHeader}>
          <Pressable onPress={() => setSelectedThread(null)} style={styles.backButton}>
            <Text style={styles.backText}>‹ Back</Text>
          </Pressable>

          <View style={styles.threadTitleWrap}>
            <Text style={styles.threadTitle} numberOfLines={1}>
              {selectedThread?.name || "Loading..."}
            </Text>
            <Text style={styles.threadSubtitle}>
              {selectedThread ? `${threadTypeLabel(selectedThread.thread_type)} Chat · ${(selectedThread.members || []).length} member${(selectedThread.members || []).length === 1 ? "" : "s"}` : "thread"}
            </Text>
          </View>

          {selectedThread?.thread_type === "direct" ? (
            <Pressable
              onPress={() => handleHideThread(selectedThread)}
              style={styles.headerHideButton}
            >
              <Text style={styles.headerHideText}>Hide</Text>
            </Pressable>
          ) : null}
        </View>

        {threadLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <>
            <ScrollView
              style={styles.messages}
              contentContainerStyle={styles.messagesContent}
            >
              {(selectedThread?.messages || []).length === 0 ? (
                <View style={styles.threadEmptyCard}>
                  <Text style={styles.emptyTitle}>Start the conversation</Text>
                  <Text style={styles.emptyText}>
                    Send the first message to get this chat moving.
                  </Text>
                </View>
              ) : (
                (selectedThread?.messages || []).map((message) => (
                  <View
                    key={message.id}
                    style={[
                      styles.bubbleWrap,
                      message.is_mine ? styles.bubbleWrapMine : styles.bubbleWrapOther,
                    ]}
                  >
                    {!message.is_mine ? (
                      <Text style={styles.senderName}>{message.sender_name}</Text>
                    ) : null}

                    <View
                      style={[
                        styles.bubble,
                        message.is_mine ? styles.bubbleMine : styles.bubbleOther,
                      ]}
                    >
                      <Text
                        style={[
                          styles.bubbleText,
                          message.is_mine ? styles.bubbleTextMine : styles.bubbleTextOther,
                        ]}
                      >
                        {message.body}
                      </Text>
                    </View>

                    <Text style={styles.messageTime}>{formatTime(message.created_at)}</Text>
                  </View>
                ))
              )}
            </ScrollView>

            <View style={styles.composer}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="Message"
                style={styles.composerInput}
                multiline
                blurOnSubmit={false}
                onKeyPress={({ nativeEvent }) => {
                  if (
                    Platform.OS === "web" &&
                    nativeEvent.key === "Enter" &&
                    !nativeEvent.shiftKey
                  ) {
                    handleSend();
                  }
                }}
              />

              <Pressable
                onPress={handleSend}
                disabled={!draft.trim() || sending}
                style={[
                  styles.sendButton,
                  (!draft.trim() || sending) && styles.sendButtonDisabled,
                ]}
              >
                <Text style={styles.sendText}>{sending ? "Sending" : "Send"}</Text>
              </Pressable>
            </View>
          </>
        )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.page} edges={["top"]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Messages</Text>
          <Text style={styles.subtitle}>Company, store, role, and direct chats.</Text>
        </View>

        <Pressable onPress={openPeople} style={styles.refreshButton}>
          <Text style={styles.refreshText}>New</Text>
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterBar}
      >
        {filters.map((filter) => (
          <Pressable
            key={filter.key}
            onPress={() => setActiveFilter(filter.key)}
            style={[
              styles.filterChip,
              activeFilter === filter.key && styles.filterChipActive,
            ]}
          >
            <Text
              style={[
                styles.filterText,
                activeFilter === filter.key && styles.filterTextActive,
              ]}
            >
              {filter.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredThreads}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No messages yet</Text>
              <Text style={styles.emptyText}>
                Threads will appear here once company, store, area, or direct chats are created.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [
                styles.threadCard,
                pressed && styles.threadCardPressed,
              ]}
              onPress={() => openThread(item)}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {initials(item.name)}
                </Text>
              </View>

              <View style={styles.threadInfo}>
                <View style={styles.threadRow}>
                  <Text style={styles.threadName} numberOfLines={1}>
                    {item.name}
                  </Text>

                  {item.unread_count > 0 ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{item.unread_count}</Text>
                    </View>
                  ) : null}

                  {item.thread_type === "direct" ? (
                    <Pressable
                      onPress={() => handleHideThread(item)}
                      style={styles.hideChip}
                    >
                      <Text style={styles.hideChipText}>Hide</Text>
                    </Pressable>
                  ) : null}
                </View>

                <Text style={styles.lastMessage} numberOfLines={1}>
                  {item.last_message
                    ? `${item.last_message.is_mine ? "You" : item.last_message.sender_name}: ${item.last_message.body}`
                    : "No messages yet"}
                </Text>

                <Text style={styles.meta}>
                  {threadTypeLabel(item.thread_type)} · {item.member_count} member{item.member_count === 1 ? "" : "s"}
                </Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  threadPage: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    color: colors.text,
    letterSpacing: -0.4,
  },
  subtitle: {
    color: colors.muted,
    marginTop: 2,
    fontWeight: "700",
    fontSize: 13,
  },
  refreshButton: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: 15,
    paddingVertical: 9,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  refreshText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 13,
  },
  error: {
    marginHorizontal: 16,
    marginTop: 6,
    color: colors.danger,
    fontWeight: "800",
    fontSize: 13,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  filterBar: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
    gap: 8,
  },
  filterChip: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "900",
  },
  filterTextActive: {
    color: "#fff",
  },
  listContent: {
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 18,
  },
  threadCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 9,
  },
  threadCardPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.995 }],
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    borderWidth: 1,
    borderColor: "#b7ebe2",
  },
  avatarText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: "900",
  },
  threadInfo: {
    flex: 1,
    minWidth: 0,
  },
  threadRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  threadName: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: "900",
  },
  lastMessage: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 2,
    fontWeight: "600",
  },
  meta: {
    color: colors.faint,
    fontSize: 11,
    marginTop: 4,
    fontWeight: "800",
    textTransform: "capitalize",
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 11,
  },
  hideChip: {
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  hideChipText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "900",
  },
  emptyCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: colors.text,
    marginBottom: 5,
  },
  emptyText: {
    color: colors.muted,
    lineHeight: 20,
    fontSize: 13,
    fontWeight: "600",
  },
  threadHeader: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  backButton: {
    paddingHorizontal: 4,
    paddingVertical: 7,
  },
  backText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: "900",
  },
  threadTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  threadTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
  },
  threadSubtitle: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "capitalize",
    marginTop: 1,
  },
  headerHideButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  headerHideText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "900",
  },
  messages: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
  },
  threadEmptyCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bubbleWrap: {
    marginBottom: 9,
    maxWidth: "84%",
  },
  bubbleWrapMine: {
    alignSelf: "flex-end",
    alignItems: "flex-end",
  },
  bubbleWrapOther: {
    alignSelf: "flex-start",
    alignItems: "flex-start",
  },
  senderName: {
    color: colors.faint,
    fontSize: 11,
    fontWeight: "900",
    marginBottom: 3,
    marginLeft: 7,
  },
  bubble: {
    borderRadius: 19,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  bubbleMine: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 6,
  },
  bubbleOther: {
    backgroundColor: colors.card,
    borderBottomLeftRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "600",
  },
  bubbleTextMine: {
    color: "#fff",
  },
  bubbleTextOther: {
    color: colors.text,
  },
  messageTime: {
    color: colors.faint,
    fontSize: 10,
    fontWeight: "800",
    marginTop: 3,
    marginHorizontal: 7,
  },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: 10,
    paddingTop: 9,
    paddingBottom: Platform.OS === "ios" ? 10 : 8,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  composerInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 105,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
  },
  sendButton: {
    minHeight: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    paddingHorizontal: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: {
    opacity: 0.35,
  },
  sendText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 13,
  },
  searchWrap: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 6,
  },
  searchInput: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    color: colors.text,
    fontWeight: "600",
  },
});
