import { useState } from "react";
import {
  ActivityIndicator,
  Linking,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { login } from "../api/client";
import { colors, shadow } from "../styles/theme";

const FORGOT_PASSWORD_URL = "https://true-ops.net/forgot-password";

export default function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setError("");
    setLoading(true);

    try {
      const data = await login(username, password);
      onLogin(data.context);
    } catch (err) {
      setError(err.message || "Could not log in.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.page}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.brandBlock}>
        <View style={styles.logoMark}>
          <Text style={styles.logoMarkText}>T</Text>
        </View>
        <Text style={styles.logo}>TrueOps</Text>
        <Text style={styles.tagline}>Restaurant operations, in one place.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Sign in</Text>
        <Text style={styles.subtitle}>
          Use your TrueOps account to access checklist, SVR, maintenance, and messages.
        </Text>

        <Text style={styles.label}>Username</Text>
        <TextInput
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
          placeholder="Username"
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          style={styles.input}
          placeholder="Password"
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
            loading && styles.buttonDisabled,
          ]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Sign in to TrueOps</Text>
          )}
        </Pressable>

        <Pressable style={styles.forgotButton} onPress={() => Linking.openURL(FORGOT_PASSWORD_URL)}>
          <Text style={styles.forgotText}>Forgot password?</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: "center",
    paddingHorizontal: 20,
    alignItems: "center",
  },
  brandBlock: {
    width: "100%",
    maxWidth: 430,
    alignItems: "center",
    marginBottom: 22,
  },
  logoMark: {
    width: 66,
    height: 66,
    borderRadius: 24,
    backgroundColor: colors.navy,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    ...shadow.soft,
  },
  logoMarkText: {
    color: "#fff",
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: -1,
  },
  card: {
    width: "100%",
    maxWidth: 430,
    backgroundColor: colors.card,
    borderRadius: 28,
    padding: 22,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    ...shadow.card,
  },
  logo: {
    fontSize: 38,
    fontWeight: "900",
    color: colors.text,
    letterSpacing: -1.3,
  },
  tagline: {
    color: colors.muted,
    fontSize: 15,
    fontWeight: "800",
  },
  title: {
    fontSize: 24,
    fontWeight: "900",
    color: colors.text,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 15,
    color: colors.muted,
    marginTop: 8,
    marginBottom: 20,
    lineHeight: 21,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 7,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingHorizontal: 15,
    paddingVertical: 13,
    fontSize: 16,
    marginBottom: 12,
  },
  error: {
    color: colors.danger,
    fontWeight: "700",
    marginBottom: 12,
  },
  button: {
    backgroundColor: colors.navy,
    borderRadius: 18,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 6,
  },
  buttonPressed: {
    backgroundColor: colors.primaryDark,
  },
  buttonDisabled: {
    opacity: 0.75,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
  },
  forgotButton: {
    alignItems: "center",
    paddingTop: 16,
    paddingBottom: 2,
  },
  forgotText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "900",
  },
});
