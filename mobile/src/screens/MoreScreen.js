import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../styles/theme";

export default function MoreScreen({ context, onLogout }) {
  const user = context?.user;

  return (
    <View style={styles.page}>
      <Text style={styles.title}>More</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{user?.name}</Text>
        <Text style={styles.cardText}>Role: {user?.role}</Text>
        <Text style={styles.cardText}>Username: {user?.username}</Text>
      </View>

      <Pressable style={styles.logoutButton} onPress={onLogout}>
        <Text style={styles.logoutText}>Log Out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg, padding: 18 },
  title: { fontSize: 30, fontWeight: "900", color: colors.text, marginBottom: 16 },
  card: { backgroundColor: colors.card, borderRadius: 22, padding: 18, borderWidth: 1, borderColor: colors.border },
  cardTitle: { fontSize: 20, fontWeight: "900", color: colors.text, marginBottom: 8 },
  cardText: { fontSize: 15, color: colors.muted, lineHeight: 23 },
  logoutButton: {
    marginTop: 18,
    backgroundColor: "#fee2e2",
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: "center",
  },
  logoutText: {
    color: colors.danger,
    fontWeight: "900",
    fontSize: 16,
  },
});
