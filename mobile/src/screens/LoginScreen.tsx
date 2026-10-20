import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useState } from "react";
import {
  Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import type { Session } from "../types";
import { colors, fonts, radii, shadow } from "../theme";

export function LoginScreen({ onLogin }: { onLogin: (session: Session) => void }) {
  const [mode, setMode] = useState<"login" | "create">("login");
  const [name, setName] = useState("Operador de campo");
  const [email, setEmail] = useState("teste@cyf.app");
  const [password, setPassword] = useState("123456");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  function changeMode(nextMode: "login" | "create") {
    setMode(nextMode);
    setError("");
  }

  function submit() {
    if (mode === "create" && !name.trim()) {
      setError("Informe seu nome para criar a conta.");
      return;
    }
    if (!email.includes("@")) {
      setError("Informe um e-mail válido.");
      return;
    }
    if (password.length < 6) {
      setError("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    setError("");
    onLogin({ name: name.trim() || "Operador de campo", email: email.trim() });
  }

  function continueWithGoogle() {
    setError("");
    onLogin({ name: "Operador de campo", email: "operador@gmail.com" });
  }

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.intro}>
          <Text style={styles.overline}>INSPEÇÃO DE CAMPO</Text>
          <Text style={styles.title}>{mode === "login" ? "Bem-vindo" : "Crie sua conta"}</Text>
          <Text style={styles.subtitle}>{mode === "login" ? "Entre para continuar suas inspeções." : "Preencha seus dados para começar."}</Text>
        </View>

        <View style={styles.tabs} accessibilityRole="tablist">
          <Pressable accessibilityRole="tab" accessibilityState={{ selected: mode === "login" }} onPress={() => changeMode("login")} style={[styles.tab, mode === "login" && styles.tabActive]}>
            <Text style={[styles.tabText, mode === "login" && styles.tabTextActive]}>Entrar</Text>
          </Pressable>
          <Pressable accessibilityRole="tab" accessibilityState={{ selected: mode === "create" }} onPress={() => changeMode("create")} style={[styles.tab, mode === "create" && styles.tabActive]}>
            <Text style={[styles.tabText, mode === "create" && styles.tabTextActive]}>Criar conta</Text>
          </Pressable>
        </View>

        <View style={styles.form}>
          {mode === "create" ? <Field label="Nome completo" placeholder="Como devemos chamar você?" value={name} onChangeText={setName} autoComplete="name" /> : null}
          <Field label="E-mail" placeholder="seuemail@exemplo.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
          <View style={styles.field}>
            <Text style={styles.label}>Senha</Text>
            <View style={styles.passwordRow}>
              <TextInput
                accessibilityLabel="Senha"
                placeholder="Mínimo de 6 caracteres"
                placeholderTextColor="#989D98"
                style={styles.passwordInput}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
              <Pressable onPress={() => setShowPassword((value) => !value)} hitSlop={10} accessibilityLabel={showPassword ? "Ocultar senha" : "Mostrar senha"}>
                <MaterialCommunityIcons name={showPassword ? "eye-off-outline" : "eye-outline"} size={22} color={colors.green} />
              </Pressable>
            </View>
          </View>

          {error ? <View accessibilityRole="alert" style={styles.errorBox}><MaterialCommunityIcons name="alert-circle-outline" size={18} color={colors.red} /><Text style={styles.errorText}>{error}</Text></View> : null}

          <Pressable accessibilityRole="button" style={({ pressed }) => [styles.primary, pressed && styles.pressed]} onPress={submit}>
            <Text style={styles.primaryText}>{mode === "login" ? "Entrar" : "Criar conta"}</Text>
          </Pressable>
        </View>

        <View style={styles.divider}><View style={styles.line} /><Text style={styles.or}>ou continue com</Text><View style={styles.line} /></View>
        <Pressable accessibilityLabel="Continuar com Google" onPress={continueWithGoogle} style={({ pressed }) => [styles.google, pressed && styles.pressed]}>
          <Image accessibilityIgnoresInvertColors source={require("../../assets/google-g.png")} style={styles.googleLogo} />
          <Text style={styles.googleText}>Google</Text>
        </Pressable>

        <Text style={styles.disclaimer}>Conta demonstrativa. Os dados desta versão ficam somente neste aparelho.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

type FieldProps = React.ComponentProps<typeof TextInput> & { label: string };
function Field({ label, ...props }: FieldProps) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} placeholderTextColor="#989D98" style={styles.input} {...props} /></View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.paper },
  content: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 24, paddingTop: 60, paddingBottom: 36 },
  intro: { marginBottom: 28 },
  overline: { color: colors.green, fontFamily: fonts.bold, fontSize: 10, letterSpacing: 1.8, marginBottom: 10 },
  title: { color: colors.ink, fontFamily: fonts.black, fontSize: 36, letterSpacing: -1.4 },
  subtitle: { color: colors.muted, fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, marginTop: 8 },
  tabs: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: colors.line, marginBottom: 22 },
  tab: { flex: 1, alignItems: "center", minHeight: 48, justifyContent: "center", borderBottomWidth: 3, borderBottomColor: "transparent" },
  tabActive: { borderBottomColor: colors.green },
  tabText: { color: "#959B96", fontFamily: fonts.semibold, fontSize: 14 },
  tabTextActive: { color: colors.green },
  google: { minHeight: 54, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, ...shadow },
  googleLogo: { width: 20, height: 20, resizeMode: "contain" },
  googleText: { color: colors.ink, fontFamily: fonts.semibold, fontSize: 14 },
  divider: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 21 },
  line: { flex: 1, height: 1, backgroundColor: colors.line },
  or: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12 },
  form: { gap: 16 },
  field: { gap: 7 },
  label: { color: colors.ink, fontFamily: fonts.semibold, fontSize: 12 },
  input: { height: 54, borderRadius: radii.small, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 16, color: colors.ink, fontFamily: fonts.medium, fontSize: 14, backgroundColor: colors.white },
  passwordRow: { height: 54, borderRadius: radii.small, borderWidth: 1, borderColor: colors.line, paddingLeft: 16, paddingRight: 14, flexDirection: "row", alignItems: "center", backgroundColor: colors.white },
  passwordInput: { flex: 1, height: "100%", color: colors.ink, fontFamily: fonts.medium, fontSize: 14 },
  errorBox: { minHeight: 43, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FFF0EE" },
  errorText: { flex: 1, color: colors.red, fontFamily: fonts.medium, fontSize: 11, lineHeight: 16 },
  primary: { height: 56, borderRadius: radii.pill, backgroundColor: colors.orange, alignItems: "center", justifyContent: "center", marginTop: 2 },
  primaryText: { color: colors.white, fontFamily: fonts.bold, fontSize: 15 },
  pressed: { opacity: 0.78 },
  disclaimer: { color: colors.muted, fontFamily: fonts.regular, fontSize: 11, lineHeight: 17, textAlign: "center", marginTop: 24, paddingHorizontal: 18 },
});
