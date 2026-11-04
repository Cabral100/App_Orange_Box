import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useState } from "react";
import {
  Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import type { Session, UserRole } from "../types";
import { colors, fonts, radii, shadow } from "../theme";

const TEST_ACCOUNTS: Record<UserRole, { user: string; password: string; name: string; email: string }> = {
  inspection: { user: "inspecao", password: "campo123", name: "Marcos Oliveira", email: "inspecao@cyf.app" },
  admin: { user: "admin", password: "admin123", name: "Fernanda Almeida", email: "fernanda.almeida@cyf.app" },
};

export function LoginScreen({ onLogin }: { onLogin: (session: Session) => void }) {
  const [role, setRole] = useState<UserRole>("inspection");
  const [user, setUser] = useState(TEST_ACCOUNTS.inspection.user);
  const [password, setPassword] = useState(TEST_ACCOUNTS.inspection.password);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  function chooseRole(nextRole: UserRole) {
    const account = TEST_ACCOUNTS[nextRole];
    setRole(nextRole);
    setUser(account.user);
    setPassword(account.password);
    setError("");
  }

  function submit() {
    const account = TEST_ACCOUNTS[role];
    if (user.trim().toLowerCase() !== account.user || password !== account.password) {
      setError(`Use o usuário e a senha de teste preenchidos para ${role === "admin" ? "Administrador" : "Inspeção"}.`);
      return;
    }
    setError("");
    onLogin({ name: account.name, email: account.email, role });
  }

  function continueWithGoogle() {
    const account = TEST_ACCOUNTS[role];
    setError("");
    onLogin({ name: account.name, email: account.email, role });
  }

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.intro}>
          <Text style={styles.overline}>CYF · CLEAN YOUR FARM</Text>
          <Text style={styles.title}>Acesso ao campo</Text>
          <Text style={styles.subtitle}>Escolha sua função. A conta de teste será preenchida automaticamente.</Text>
        </View>

        <Text style={styles.sectionLabel}>COMO VOCÊ VAI USAR O APP?</Text>
        <View style={styles.roleRow} accessibilityRole="radiogroup">
          <RoleCard
            selected={role === "inspection"}
            icon="account-hard-hat-outline"
            title="Inspeção"
            copy="Câmera, mapa e histórico"
            onPress={() => chooseRole("inspection")}
          />
          <RoleCard
            selected={role === "admin"}
            icon="shield-account-outline"
            title="Administrador"
            copy="Acesso completo e relatórios"
            onPress={() => chooseRole("admin")}
          />
        </View>

        <View style={styles.form}>
          <Field label="Usuário" value={user} onChangeText={setUser} autoCapitalize="none" autoCorrect={false} autoComplete="username" />
          <View style={styles.field}>
            <Text style={styles.label}>Senha</Text>
            <View style={styles.passwordRow}>
              <TextInput
                accessibilityLabel="Senha"
                placeholderTextColor={colors.muted}
                style={styles.passwordInput}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoComplete="current-password"
              />
              <Pressable onPress={() => setShowPassword((value) => !value)} hitSlop={12} accessibilityLabel={showPassword ? "Ocultar senha" : "Mostrar senha"}>
                <MaterialCommunityIcons name={showPassword ? "eye-off-outline" : "eye-outline"} size={25} color={colors.green} />
              </Pressable>
            </View>
          </View>

          <View style={styles.ready}><MaterialCommunityIcons name="check-circle" size={20} color={colors.green} /><Text style={styles.readyText}>Conta de teste pronta para entrar</Text></View>
          {error ? <View accessibilityRole="alert" style={styles.errorBox}><MaterialCommunityIcons name="alert-circle-outline" size={21} color={colors.red} /><Text style={styles.errorText}>{error}</Text></View> : null}

          <Pressable accessibilityRole="button" style={({ pressed }) => [styles.primary, pressed && styles.pressed]} onPress={submit}>
            <Text style={styles.primaryText}>Entrar como {role === "admin" ? "administrador" : "inspeção"}</Text>
          </Pressable>
        </View>

        <View style={styles.googleArea}>
          <View style={styles.divider}><View style={styles.line} /><Text style={styles.or}>ou</Text><View style={styles.line} /></View>
          <Pressable accessibilityLabel="Continuar com Google" onPress={continueWithGoogle} style={({ pressed }) => [styles.google, pressed && styles.pressed]}>
            <Image accessibilityIgnoresInvertColors source={require("../../assets/google-g.png")} style={styles.googleLogo} />
            <Text style={styles.googleText}>Continuar com Google</Text>
          </Pressable>
          <Text style={styles.disclaimer}>Demonstração offline. Os dados ficam somente neste aparelho.</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function RoleCard({ selected, icon, title, copy, onPress }: { selected: boolean; icon: keyof typeof MaterialCommunityIcons.glyphMap; title: string; copy: string; onPress: () => void }) {
  return <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected }} accessibilityLabel={`${title}. ${copy}`} onPress={onPress} style={({ pressed }) => [styles.roleCard, selected && styles.roleCardSelected, pressed && styles.pressed]}>
    <View style={[styles.roleIcon, selected && styles.roleIconSelected]}><MaterialCommunityIcons name={icon} size={27} color={selected ? colors.white : colors.green} /></View>
    <Text style={[styles.roleTitle, selected && styles.roleTitleSelected]}>{title}</Text>
    <Text style={[styles.roleCopy, selected && styles.roleCopySelected]}>{copy}</Text>
    <View style={[styles.radio, selected && styles.radioSelected]}>{selected ? <View style={styles.radioCenter} /> : null}</View>
  </Pressable>;
}

type FieldProps = React.ComponentProps<typeof TextInput> & { label: string };
function Field({ label, ...props }: FieldProps) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} placeholderTextColor={colors.muted} style={styles.input} {...props} /></View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.paper },
  content: { flexGrow: 1, paddingHorizontal: 22, paddingTop: 64, paddingBottom: 30 },
  intro: { marginBottom: 25 },
  overline: { color: colors.green, fontFamily: fonts.extraBold, fontSize: 12, letterSpacing: 1.4, marginBottom: 10 },
  title: { color: colors.ink, fontFamily: fonts.black, fontSize: 37, letterSpacing: -1.2 },
  subtitle: { color: colors.muted, fontFamily: fonts.medium, fontSize: 16, lineHeight: 23, marginTop: 9 },
  sectionLabel: { color: colors.greenDark, fontFamily: fonts.extraBold, fontSize: 12, letterSpacing: 1.1, marginBottom: 10 },
  roleRow: { flexDirection: "row", gap: 10, marginBottom: 22 },
  roleCard: { flex: 1, minHeight: 154, borderRadius: 22, padding: 14, borderWidth: 2, borderColor: colors.lineStrong, backgroundColor: colors.white },
  roleCardSelected: { borderColor: colors.green, backgroundColor: colors.greenSoft },
  roleIcon: { width: 46, height: 46, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: colors.greenSoft },
  roleIconSelected: { backgroundColor: colors.green },
  roleTitle: { color: colors.ink, fontFamily: fonts.extraBold, fontSize: 17, marginTop: 10 },
  roleTitleSelected: { color: colors.greenDark },
  roleCopy: { color: colors.muted, fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, marginTop: 3, paddingRight: 8 },
  roleCopySelected: { color: colors.greenDark },
  radio: { position: "absolute", top: 14, right: 14, width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.lineStrong, alignItems: "center", justifyContent: "center", backgroundColor: colors.white },
  radioSelected: { borderColor: colors.green }, radioCenter: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.green },
  form: { gap: 15 }, field: { gap: 7 },
  label: { color: colors.ink, fontFamily: fonts.bold, fontSize: 15 },
  input: { height: 58, borderRadius: radii.small, borderWidth: 2, borderColor: colors.lineStrong, paddingHorizontal: 16, color: colors.ink, fontFamily: fonts.semibold, fontSize: 17, backgroundColor: colors.white },
  passwordRow: { height: 58, borderRadius: radii.small, borderWidth: 2, borderColor: colors.lineStrong, paddingLeft: 16, paddingRight: 14, flexDirection: "row", alignItems: "center", backgroundColor: colors.white },
  passwordInput: { flex: 1, height: "100%", color: colors.ink, fontFamily: fonts.semibold, fontSize: 17 },
  ready: { minHeight: 42, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, borderRadius: 13, backgroundColor: colors.greenSoft },
  readyText: { color: colors.greenDark, fontFamily: fonts.bold, fontSize: 13 },
  errorBox: { minHeight: 48, paddingHorizontal: 13, paddingVertical: 10, borderRadius: 13, flexDirection: "row", alignItems: "center", gap: 9, backgroundColor: "#FFF0EE" },
  errorText: { flex: 1, color: colors.red, fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18 },
  primary: { minHeight: 60, borderRadius: radii.pill, backgroundColor: colors.orange, alignItems: "center", justifyContent: "center", marginTop: 1, paddingHorizontal: 18 },
  primaryText: { color: colors.white, fontFamily: fonts.extraBold, fontSize: 17, textAlign: "center" },
  googleArea: { marginTop: "auto", paddingTop: 24 },
  divider: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 17 }, line: { flex: 1, height: 1, backgroundColor: colors.lineStrong }, or: { color: colors.muted, fontFamily: fonts.semibold, fontSize: 14 },
  google: { minHeight: 58, borderRadius: radii.pill, borderWidth: 2, borderColor: colors.lineStrong, backgroundColor: colors.white, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 11, ...shadow },
  googleLogo: { width: 22, height: 22, resizeMode: "contain" }, googleText: { color: colors.ink, fontFamily: fonts.bold, fontSize: 16 },
  pressed: { opacity: 0.78 },
  disclaimer: { color: colors.muted, fontFamily: fonts.medium, fontSize: 12, lineHeight: 18, textAlign: "center", marginTop: 17, paddingHorizontal: 12 },
});
