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

import {
  loadThread,
  loadThreads,
  markThreadRead,
  sendThreadMessage,
} from "../api/client";
import { colors } from "../styles/theme";

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

export default function MessagesScreen() {
  const [threads, setThreads] = useState([]);
  const [selectedThread, setSelectedThread] = useState(null);
  const [loading, setLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

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

  async function openThread(thread) {
    setSelectedThread(null);
    setThreadLoading(true);
    setError("");

    try {
      const data = await loadThread(thread.id);
      setSelectedThread(data.thread);
      await markThreadRead(thread.id);
      refreshThreads();
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
      const data = await loadThread(selectedThread.id);
      setSelectedThread(data.thread);
      refreshThreads();
    } catch (err) {
      setError(err.message || "Could not send message.");
      setDraft(body);
    } finally {
      setSending(false);
    }
  }

  useEffect(() => {
    refreshThreads();
  }, []);

  if (selectedThread || threadLoading) {
    return (
      <KeyboardAvoidingView
        style={styles.page}
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
              {selectedThread?.thread_type || "thread"}
            </Text>
          </View>
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
              {(selectedThread?.messages || []).map((message) => (
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
              ))}
            </ScrollView>

            <View style={styles.composer}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="Message..."
                style={styles.composerInput}
                multiline
              />

              <Pressable
                onPress={handleSend}
                disabled={!draft.trim() || sending}
                style={[
                  styles.sendButton,
                  (!draft.trim() || sending) && styles.sendButtonDisabled,
                ]}
              >
                <Text style={styles.sendText}>{sending ? "..." : "Send"}</Text>
              </Pressable>
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Messages</Text>
          <Text style={styles.subtitle}>TrueOps company, store, and direct chats.</Text>
        </View>

        <Pressable onPress={refreshThreads} style={styles.refreshButton}>
          <Text style={styles.refreshText}>Refresh</Text>
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={threads}
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
                  {(item.name || "T").slice(0, 1).toUpperCase()}
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
                </View>

                <Text style={styles.lastMessage} numberOfLines={1}>
                  {item.last_message
                    ? `${item.last_message.sender_name}: ${item.last_message.body}`
                    : "No messages yet"}
                </Text>

                <Text style={styles.meta}>
                  {item.thread_type} · {item.member_count} member{item.member_count === 1 ? "" : "s"}
                </Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    padding: 18,
    paddingBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  title: {
    fontSize: 30,
    fontWeight: "900",
    color: colors.text,
  },
  subtitle: {
    color: colors.muted,
    marginTop: 4,
    fontWeight: "600",
  },
  refreshButton: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  refreshText: {
    color: colors.primary,
    fontWeight: "900",
  },
  error: {
    marginHorizontal: 18,
    marginTop: 8,
    color: colors.danger,
    fontWeight: "800",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: {
    padding: 18,
    paddingTop: 8,
    paddingBottom: 32,
  },
  threadCard: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  threadCardPressed: {
    opacity: 0.72,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 18,
    backgroundColor: "#ccfbf1",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarText: {
    color: colors.primary,
    fontSize: 20,
    fontWeight: "900",
  },
  threadInfo: {
    flex: 1,
  },
  threadRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  threadName: {
    flex: 1,
    color: colors.text,
    fontSize: 17,
    fontWeight: "900",
  },
  lastMessage: {
    color: colors.muted,
    fontSize: 14,
    marginTop: 4,
  },
  meta: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 6,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 12,
  },
  emptyCard: {
    backgroundColor: colors.card,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: colors.text,
    marginBottom: 6,
  },
  emptyText: {
    color: colors.muted,
    lineHeight: 21,
  },
  threadHeader: {
    padding: 14,
    paddingTop: 18,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
  },
  backButton: {
    paddingRight: 12,
    paddingVertical: 8,
  },
  backText: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: "900",
  },
  threadTitleWrap: {
    flex: 1,
  },
  threadTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
  },
  threadSubtitle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  messages: {
    flex: 1,
  },
  messagesContent: {
    padding: 14,
    paddingBottom: 20,
  },
  bubbleWrap: {
    marginBottom: 12,
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
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 4,
    marginLeft: 4,
  },
  bubble: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleMine: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 6,
  },
  bubbleOther: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: 6,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 20,
  },
  bubbleTextMine: {
    color: "#fff",
  },
  bubbleTextOther: {
    color: colors.text,
  },
  messageTime: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 4,
    marginHorizontal: 5,
  },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    padding: 12,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  composerInput: {
    flex: 1,
    minHeight: 42,
    maxHeight: 110,
    borderRadius: 18,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
  },
  sendButton: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  sendButtonDisabled: {
    opacity: 0.45,
  },
  sendText: {
    color: "#fff",
    fontWeight: "900",
  },
});
