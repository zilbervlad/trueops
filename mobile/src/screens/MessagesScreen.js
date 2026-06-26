import { StyleSheet, Text, View } from "react-native";
import { colors } from "../styles/theme";

export default function MessagesScreen() {
  return (
    <View style={styles.page}>
      <Text style={styles.title}>Messages</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Coming next</Text>
        <Text style={styles.cardText}>
          This will become the TrueOps version of BPI Connect: direct, store, area, role, and company chats.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg, padding: 18 },
  title: { fontSize: 30, fontWeight: "900", color: colors.text, marginBottom: 16 },
  card: { backgroundColor: colors.card, borderRadius: 22, padding: 18, borderWidth: 1, borderColor: colors.border },
  cardTitle: { fontSize: 18, fontWeight: "900", color: colors.text, marginBottom: 6 },
  cardText: { fontSize: 15, color: colors.muted, lineHeight: 21 },
});
