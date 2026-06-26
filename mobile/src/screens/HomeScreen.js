import { ScrollView, StyleSheet, Text, View } from "react-native";
import { colors } from "../styles/theme";

export default function HomeScreen({ context }) {
  const user = context?.user;
  const company = context?.company;
  const stores = context?.stores || [];

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.kicker}>Good to see you</Text>
      <Text style={styles.title}>{user?.name || "TrueOps"}</Text>

      <View style={styles.heroCard}>
        <Text style={styles.heroLabel}>{company?.name || "Company"}</Text>
        <Text style={styles.heroTitle}>Today’s operation starts here.</Text>
        <Text style={styles.heroText}>
          Messages, checklists, reports, and maintenance will live in one clean mobile workflow.
        </Text>
      </View>

      <View style={styles.row}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stores.length}</Text>
          <Text style={styles.statLabel}>Visible stores</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{user?.role || "-"}</Text>
          <Text style={styles.statLabel}>Role</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Mobile foundation</Text>
        <Text style={styles.cardText}>
          Login is connected to the real TrueOps API. Next up: BPI Connect-style messages.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: 18,
    paddingBottom: 32,
  },
  kicker: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "700",
  },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "900",
    marginTop: 4,
    marginBottom: 18,
  },
  heroCard: {
    backgroundColor: colors.primary,
    borderRadius: 28,
    padding: 20,
    marginBottom: 16,
  },
  heroLabel: {
    color: "#ccfbf1",
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 8,
  },
  heroTitle: {
    color: "#fff",
    fontSize: 25,
    fontWeight: "900",
    marginBottom: 8,
  },
  heroText: {
    color: "#e0f2f1",
    fontSize: 15,
    lineHeight: 21,
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statNumber: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900",
  },
  statLabel: {
    color: colors.muted,
    marginTop: 4,
    fontWeight: "700",
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 16,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 6,
  },
  cardText: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 21,
  },
});
