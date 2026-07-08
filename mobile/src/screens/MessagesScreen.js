import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
  addThreadMember,
  createDirectThread,
  deleteThreadMessage,
  ensureDefaultMessageThreads,
  fetchMessageReadReceipts,
  fetchThreadMembers,
  hideThread,
  loadMessagePeople,
  loadThread,
  loadThreads,
  markThreadRead,
  removeThreadMember,
  sendThreadMessage,
} from "../api/client";
import { colors, radius, spacing } from "../styles/theme";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "direct", label: "Direct" },
  { key: "store", label: "Stores" },
  { key: "company", label: "Company" },
  { key: "area", label: "Areas" },
  { key: "role", label: "Roles" },
];

function parseServerTime(value) {
  if (!value) return null;

  const raw = String(value);
  const hasTimezone = /Z$|[+-]\\d{2}:?\\d{2}$/.test(raw);

  return new Date(hasTimezone ? raw : `${raw}Z`);
}

function formatTime(value) {
  if (!value) return "";

  try {
    const date = parseServerTime(value);
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

function ThreadCard({ thread, onPress }) {
  const last = thread.last_message;
  const preview = last
    ? `${last.is_mine ? "You" : last.sender_name}: ${last.body}`
    : "No messages yet";

  return (
    <Pressable
      style={({ pressed }) => [styles.threadCard, pressed && styles.cardPressed]}
      onPress={onPress}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials(thread.name)}</Text>
      </View>

      <View style={styles.threadInfo}>
        <View style={styles.threadTopRow}>
          <Text style={styles.threadName} numberOfLines={1}>
            {thread.name}
          </Text>

          {thread.unread_count > 0 ? (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{thread.unread_count}</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.lastMessage} numberOfLines={1}>
          {preview}
        </Text>

        <View style={styles.threadMetaRow}>
          <Text style={styles.threadMeta}>{threadTypeLabel(thread.thread_type)}</Text>
          <Text style={styles.metaDot}>•</Text>
          <Text style={styles.threadMeta}>
            {thread.member_count} member{thread.member_count === 1 ? "" : "s"}
          </Text>
          {last?.created_at ? (
            <>
              <Text style={styles.metaDot}>•</Text>
              <Text style={styles.threadMeta}>{formatTime(last.created_at)}</Text>
            </>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

function PersonCard({ person, onPress }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.threadCard, pressed && styles.cardPressed]}
      onPress={onPress}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {(person.name || person.username || "P").slice(0, 1).toUpperCase()}
        </Text>
      </View>

      <View style={styles.threadInfo}>
        <Text style={styles.threadName} numberOfLines={1}>
          {person.name || person.username}
        </Text>

        <Text style={styles.lastMessage} numberOfLines={1}>
          {person.role || "user"}
          {person.store_number ? ` · Store ${person.store_number}` : ""}
          {person.area_name ? ` · ${person.area_name}` : ""}
        </Text>
      </View>
    </Pressable>
  );
}


function MemberRow({ member, canManage, onRemove }) {
  return (
    <View style={styles.memberCard}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials(member.name)}</Text>
      </View>

      <View style={styles.memberBody}>
        <Text style={styles.memberName} numberOfLines={1}>
          {member.name}
        </Text>
        <Text style={styles.memberMeta} numberOfLines={1}>
          {threadTypeLabel(member.role) === "Thread" ? member.role || "user" : threadTypeLabel(member.role)}
          {member.store_number ? ` · Store ${member.store_number}` : ""}
          {member.area_name ? ` · ${member.area_name}` : ""}
        </Text>
      </View>

      {canManage ? (
        <Pressable style={styles.removeMemberButton} onPress={() => onRemove(member)}>
          <Text style={styles.removeMemberText}>Remove</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function CandidateRow({ person, onAdd, disabled }) {
  return (
    <View style={styles.memberCard}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials(person.name)}</Text>
      </View>

      <View style={styles.memberBody}>
        <Text style={styles.memberName} numberOfLines={1}>
          {person.name || person.username}
        </Text>
        <Text style={styles.memberMeta} numberOfLines={1}>
          {person.role || "user"}
          {person.store_number ? ` · Store ${person.store_number}` : ""}
          {person.area_name ? ` · ${person.area_name}` : ""}
        </Text>
      </View>

      <Pressable
        style={[styles.addMemberButton, disabled && styles.addMemberButtonDisabled]}
        onPress={() => onAdd(person)}
        disabled={disabled}
      >
        <Text style={styles.addMemberText}>{disabled ? "Adding…" : "Add"}</Text>
      </Pressable>
    </View>
  );
}

function MessageBubble({ message, onDelete, onReadReceipts }) {
  const canDelete = message.is_mine && !message.is_deleted;

  return (
    <View style={[styles.bubbleWrap, message.is_mine ? styles.bubbleWrapMine : styles.bubbleWrapOther]}>
      {!message.is_mine ? <Text style={styles.senderName}>{message.sender_name}</Text> : null}

      <Pressable
        disabled={message.is_deleted}
        onPress={() => onReadReceipts?.(message)}
        onLongPress={() => canDelete && onDelete?.(message)}
        style={({ pressed }) => [
          styles.bubble,
          message.is_mine ? styles.bubbleMine : styles.bubbleOther,
          message.is_deleted && styles.bubbleDeleted,
          pressed && canDelete && styles.bubblePressed,
        ]}
      >
        <Text
          style={[
            styles.bubbleText,
            message.is_mine ? styles.bubbleTextMine : styles.bubbleTextOther,
            message.is_deleted && styles.bubbleTextDeleted,
          ]}
        >
          {message.body}
        </Text>
      </Pressable>

      <Text style={[styles.messageTime, message.is_mine && styles.messageTimeMine]}>
        {message.is_deleted ? "Deleted" : formatTime(message.created_at)}
      </Text>
    </View>
  );
}

export default function MessagesScreen({ route }) {
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
  const [readReceiptsLoading, setReadReceiptsLoading] = useState(false);
  const messagesScrollRef = useRef(null);
  const [showManageGroup, setShowManageGroup] = useState(false);
  const [groupMembers, setGroupMembers] = useState([]);
  const [groupCandidates, setGroupCandidates] = useState([]);
  const [groupCanManage, setGroupCanManage] = useState(false);
  const [groupLoading, setGroupLoading] = useState(false);
  const [groupSearch, setGroupSearch] = useState("");
  const [addingUserId, setAddingUserId] = useState(null);


  function scrollMessagesToBottom(animated = true) {
    setTimeout(() => {
      messagesScrollRef.current?.scrollToEnd?.({ animated });
    }, 80);
  }

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

    Alert.alert(
      "Delete chat?",
      "This removes the direct chat from your inbox.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await hideThread(thread.id);
              setThreads((current) => current.filter((item) => item.id !== thread.id));
              if (selectedThread?.id === thread.id) {
                setSelectedThread(null);
              }
              await loadThreads({ quiet: true });
            } catch (err) {
              setError(err.message || "Could not delete chat.");
            }
          },
        },
      ]
    );
  }

  async function openThread(thread) {
    setSelectedThread(null);
    setThreadLoading(true);
    setError("");

    try {
      const data = await loadThread(thread.id);
      setSelectedThread(data.thread);
      scrollMessagesToBottom(false);
      await markThreadRead(thread.id);
      await refreshThreads();
    } catch (err) {
      setError(err.message || "Could not open thread.");
    } finally {
      setThreadLoading(false);
    }
  }


  async function openManageGroup() {
    if (!selectedThread?.id || selectedThread.thread_type === "direct") return;

    setShowManageGroup(true);
    setGroupSearch("");
    await loadGroupMembers();
  }

  async function loadGroupMembers() {
    if (!selectedThread?.id) return;

    setGroupLoading(true);
    setError("");

    try {
      const data = await fetchThreadMembers(selectedThread.id);
      setGroupMembers(data.members || []);
      setGroupCandidates(data.candidates || []);
      setGroupCanManage(Boolean(data.can_manage));
    } catch (err) {
      setError(err.message || "Could not load group members.");
    } finally {
      setGroupLoading(false);
    }
  }

  async function handleAddMember(person) {
    if (!selectedThread?.id || !person?.id) return;

    setAddingUserId(person.id);
    setError("");

    try {
      await addThreadMember(selectedThread.id, person.id);
      await loadGroupMembers();

      const data = await loadThread(selectedThread.id);
      setSelectedThread(data.thread);
      scrollMessagesToBottom(true);
      await refreshThreads();
    } catch (err) {
      Alert.alert("Could not add member", err.message || "Please try again.");
    } finally {
      setAddingUserId(null);
    }
  }

  async function handleRemoveMember(member) {
    if (!selectedThread?.id || !member?.user_id) return;

    Alert.alert(
      "Remove member?",
      `Remove ${member.name} from this group?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await removeThreadMember(selectedThread.id, member.user_id);
              await loadGroupMembers();

              const data = await loadThread(selectedThread.id);
              setSelectedThread(data.thread);
              await refreshThreads();
            } catch (err) {
              Alert.alert("Could not remove member", err.message || "Please try again.");
            }
          },
        },
      ]
    );
  }


  async function handleReadReceipts(message) {
    if (!selectedThread?.id || !message?.id || message.is_deleted) return;

    setReadReceiptsLoading(true);

    try {
      const data = await fetchMessageReadReceipts(selectedThread.id, message.id);

      const readers = data.readers || [];
      const unread = data.unread || [];

      const readLines = readers.length
        ? readers.map((person) => `✓ ${person.name}`).join("\n")
        : "Nobody yet";

      const unreadLines = unread.length
        ? unread.map((person) => `• ${person.name}`).join("\n")
        : "Everyone has read it";

      Alert.alert(
        `Read receipts`,
        `Read by (${data.read_count || 0})\n${readLines}\n\nNot read yet (${data.unread_count || 0})\n${unreadLines}`
      );
    } catch (err) {
      Alert.alert("Could not load read receipts", err.message || "Please try again.");
    } finally {
      setReadReceiptsLoading(false);
    }
  }

  async function handleDeleteMessage(message) {
    if (!selectedThread || !message || message.is_deleted) return;

    Alert.alert(
      "Delete message?",
      "This removes the message from this chat.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const data = await deleteThreadMessage(selectedThread.id, message.id);
              setSelectedThread(data.thread);
              await loadThreads({ quiet: true });
            } catch (err) {
              setError(err.message || "Could not delete message.");
            }
          },
        },
      ]
    );
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
      scrollMessagesToBottom(true);
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
        // Non-admin users may not be allowed to create default threads.
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

  useEffect(() => {
    const threadId = route?.params?.threadId;

    if (!threadId) return;

    openThread({ id: threadId });
  }, [route?.params?.threadId]);

  useEffect(() => {
    if (!selectedThread?.id) return;

    const interval = setInterval(async () => {
      try {
        const data = await loadThread(selectedThread.id);
        setSelectedThread(data.thread);
        await markThreadRead(selectedThread.id);
        await refreshThreads();
      } catch {
        // Keep current thread visible if refresh fails.
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [selectedThread?.id]);


  useEffect(() => {
    if (!selectedThread?.id) return;

    scrollMessagesToBottom(false);
  }, [selectedThread?.id, selectedThread?.messages?.length]);

  const filteredThreads = useMemo(
    () =>
      threads.filter((thread) => {
        if (activeFilter === "all") return true;
        return thread.thread_type === activeFilter;
      }),
    [threads, activeFilter]
  );

  const filteredPeople = useMemo(() => {
    const search = peopleSearch.trim().toLowerCase();

    if (!search) return people;

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

      return haystack.includes(search);
    });
  }, [people, peopleSearch]);


  const filteredGroupCandidates = useMemo(() => {
    const search = groupSearch.trim().toLowerCase();

    if (!search) return groupCandidates;

    return groupCandidates.filter((person) => {
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
  }, [groupCandidates, groupSearch]);

  if (showPeople) {
    return (
      <SafeAreaView style={styles.page} edges={["top"]}>
        <View style={styles.header}>
          <Pressable
            onPress={() => {
              setPeopleSearch("");
              setShowPeople(false);
            }}
            style={styles.backButton}
          >
            <Text style={styles.backText}>‹ Back</Text>
          </Pressable>

          <View style={styles.headerText}>
            <Text style={styles.kicker}>DIRECT MESSAGE</Text>
            <Text style={styles.title}>New chat</Text>
            <Text style={styles.subtitle}>Search people you can message.</Text>
          </View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.searchCard}>
          <TextInput
            value={peopleSearch}
            onChangeText={setPeopleSearch}
            placeholder="Search name, role, store, area..."
            placeholderTextColor={colors.faint}
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {peopleLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.stateText}>Loading people…</Text>
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
                    : "People will show here once active users are available."}
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <PersonCard person={item} onPress={() => startDirectMessage(item)} />
            )}
          />
        )}
      </SafeAreaView>
    );
  }


  if (showManageGroup && selectedThread) {
    return (
      <SafeAreaView style={styles.page} edges={["top"]}>
        <View style={styles.header}>
          <Pressable onPress={() => setShowManageGroup(false)} style={styles.backButton}>
            <Text style={styles.backText}>‹ Back</Text>
          </Pressable>

          <View style={styles.headerText}>
            <Text style={styles.kicker}>MANAGE GROUP</Text>
            <Text style={styles.title} numberOfLines={1}>{selectedThread.name}</Text>
            <Text style={styles.subtitle}>
              {groupMembers.length} member{groupMembers.length === 1 ? "" : "s"}
            </Text>
          </View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {groupLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.stateText}>Loading group…</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.manageContent}>
            <Text style={styles.sectionTitle}>Members</Text>

            {groupMembers.map((member) => (
              <MemberRow
                key={member.membership_id}
                member={member}
                canManage={groupCanManage}
                onRemove={handleRemoveMember}
              />
            ))}

            {groupCanManage ? (
              <>
                <Text style={styles.sectionTitle}>Add People</Text>

                <View style={styles.searchCard}>
                  <TextInput
                    value={groupSearch}
                    onChangeText={setGroupSearch}
                    placeholder="Search people to add..."
                    placeholderTextColor={colors.faint}
                    style={styles.searchInput}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                {filteredGroupCandidates.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <Text style={styles.emptyTitle}>No people to add</Text>
                    <Text style={styles.emptyText}>Everyone available may already be in this group.</Text>
                  </View>
                ) : (
                  filteredGroupCandidates.map((person) => (
                    <CandidateRow
                      key={person.id}
                      person={person}
                      onAdd={handleAddMember}
                      disabled={addingUserId === person.id}
                    />
                  ))
                )}
              </>
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>View only</Text>
                <Text style={styles.emptyText}>You can see group members, but cannot add or remove people.</Text>
              </View>
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    );
  }

  if (selectedThread || threadLoading) {
    const messages = selectedThread?.messages || [];

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
                {selectedThread
                  ? `${threadTypeLabel(selectedThread.thread_type)} · ${(selectedThread.members || []).length} member${(selectedThread.members || []).length === 1 ? "" : "s"}`
                  : "Opening chat..."}
              </Text>
            </View>

            {selectedThread?.thread_type === "direct" ? (
              <Pressable
                onPress={() => handleHideThread(selectedThread)}
                style={styles.hideButton}
              >
                <Text style={styles.hideText}>Delete</Text>
              </Pressable>
            ) : selectedThread ? (
              <Pressable onPress={openManageGroup} style={styles.manageButton}>
                <Text style={styles.manageButtonText}>Manage</Text>
              </Pressable>
            ) : null}
          </View>

          {threadLoading ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.stateText}>Opening chat…</Text>
            </View>
          ) : (
            <>
              <ScrollView
                ref={messagesScrollRef}
                style={styles.messages}
                contentContainerStyle={styles.messagesContent}
                onContentSizeChange={() => scrollMessagesToBottom(false)}
              >
                {messages.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <Text style={styles.emptyTitle}>Start the conversation</Text>
                    <Text style={styles.emptyText}>Send the first message to get this chat moving.</Text>
                  </View>
                ) : (
                  messages.map((message) => (
                    <MessageBubble
                      key={message.id}
                      message={message}
                      onDelete={handleDeleteMessage}
                      onReadReceipts={handleReadReceipts}
                    />
                  ))
                )}
              </ScrollView>

              <View style={styles.composerDock}>
                <View style={styles.composer}>
                  <TextInput
                    value={draft}
                    onChangeText={setDraft}
                    placeholder="Message"
                    placeholderTextColor={colors.faint}
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
                    <Text style={styles.sendText}>{sending ? "..." : "Send"}</Text>
                  </Pressable>
                </View>
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
        <View style={styles.headerText}>
          <Text style={styles.kicker}>TRUEOPS</Text>
          <Text style={styles.title}>Messages</Text>
          <Text style={styles.subtitle}>Company, store, role, and direct chats.</Text>
        </View>

        <Pressable onPress={openPeople} style={styles.newButton}>
          <Text style={styles.newButtonText}>+ New</Text>
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.filterShell}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterBar}
        >
          {FILTERS.map((filter) => (
            <Pressable
              key={filter.key}
              onPress={() => setActiveFilter(filter.key)}
              style={[styles.filterChip, activeFilter === filter.key && styles.filterChipActive]}
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
      </View>

      <View style={styles.listHeader}>
        <Text style={styles.sectionTitle}>Chats</Text>
        <Text style={styles.sectionMeta}>{filteredThreads.length} shown</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.stateText}>Loading chats…</Text>
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
                Threads will appear here once company, store, area, role, or direct chats are created.
              </Text>
            </View>
          }
          renderItem={({ item }) => <ThreadCard thread={item} onPress={() => openThread(item)} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.navy,
  },
  threadPage: {
    flex: 1,
    backgroundColor: colors.navy,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  headerText: {
    flex: 1,
  },
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
  newButton: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  newButtonText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "900",
  },
  error: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    color: colors.danger,
    fontWeight: "800",
    backgroundColor: colors.dangerSoft,
    borderRadius: 18,
    padding: spacing.md,
  },
  filterShell: {
    marginHorizontal: 16,
    marginBottom: 10,
  },
  filterBar: {
    gap: 8,
    paddingRight: 16,
  },
  filterChip: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.pill,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "900",
  },
  filterTextActive: {
    color: "#ffffff",
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
  sectionMeta: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "900",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 116,
    gap: 8,
  },
  threadCard: {
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
  cardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
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
  avatarText: {
    color: colors.primaryDark,
    fontSize: 15,
    fontWeight: "900",
  },
  threadInfo: {
    flex: 1,
  },
  threadTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  threadName: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: -0.25,
  },
  lastMessage: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "800",
    marginTop: 2,
  },
  threadMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 3,
  },
  threadMeta: {
    color: colors.faint,
    fontSize: 11,
    fontWeight: "900",
  },
  metaDot: {
    color: colors.faint,
    fontSize: 10,
    fontWeight: "900",
  },
  unreadBadge: {
    minWidth: 21,
    height: 21,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  unreadText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "900",
  },
  center: {
    padding: 18,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  stateText: {
    color: "#cbd5e1",
    fontSize: 13,
    fontWeight: "800",
  },
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
  searchCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 26,
    padding: spacing.sm,
  },
  searchInput: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontWeight: "800",
  },
  backButton: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  backText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "900",
  },
  threadHeader: {
    backgroundColor: colors.navy,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  threadTitleWrap: {
    flex: 1,
  },
  threadTitle: {
    color: "#ffffff",
    fontSize: 19,
    fontWeight: "900",
    letterSpacing: -0.35,
  },
  threadSubtitle: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 2,
  },
  hideButton: {
    backgroundColor: colors.dangerSoft,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  hideText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "900",
  },

  manageContent: {
    paddingHorizontal: 16,
    paddingBottom: 116,
    gap: 8,
  },
  memberCard: {
    backgroundColor: "#ffffff",
    borderColor: colors.borderSoft,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  memberBody: {
    flex: 1,
  },
  memberName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900",
  },
  memberMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 2,
  },
  manageButton: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  manageButtonText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "900",
  },
  addMemberButton: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  addMemberButtonDisabled: {
    opacity: 0.7,
  },
  addMemberText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900",
  },
  removeMemberButton: {
    backgroundColor: colors.dangerSoft,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  removeMemberText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "900",
  },

  messages: {
    flex: 1,
    backgroundColor: colors.navy,
  },
  messagesContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 18,
    flexGrow: 1,
  },
  bubbleWrap: {
    marginBottom: spacing.md,
    maxWidth: "82%",
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
    fontWeight: "900",
    marginBottom: 4,
    marginLeft: 4,
  },
  bubble: {
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleMine: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 7,
  },
  bubbleOther: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderBottomLeftRadius: 7,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
  },
  bubbleTextMine: {
    color: "#ffffff",
  },
  bubbleTextOther: {
    color: colors.text,
  },
  bubbleTextDeleted: {
    fontStyle: "italic",
    color: colors.faint,
  },
  messageTime: {
    color: colors.faint,
    fontSize: 10,
    fontWeight: "800",
    marginTop: 4,
    marginLeft: 4,
  },
  messageTimeMine: {
    marginRight: 4,
  },
  composerDock: {
    backgroundColor: colors.navy,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 92,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  composer: {
    backgroundColor: "#ffffff",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  composerInput: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
    maxHeight: 92,
    minHeight: 38,
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  sendButton: {
    backgroundColor: colors.primary,
    borderRadius: 17,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: {
    opacity: 0.45,
  },
  sendText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900",
  },
});
