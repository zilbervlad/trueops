import { StyleSheet, Text, View } from "react-native";
import { colors } from "../styles/theme";

export default function OpsScreen() {
  return (
    <View style={styles.page}>
      <Text style={styles.title}>Ops</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Daily flow</Text>
        <Text style={styles.cardText}>
          Daily Checklist, Manager’s Walk, 3 O’Clock Restock, and store rhythm will go here.
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
