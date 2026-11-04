import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { confirmedCount } from "../analytics";
import type { InspectionRecord, Plot, Session } from "../types";
import { colors, fonts, radii, shadow } from "../theme";

type Props = { session: Session; records: InspectionRecord[]; plots: Plot[]; onLogout: () => void; demoMode?: boolean };

export function AccountScreen({ session, records, plots, onLogout, demoMode = false }: Props) {
  const [settings, setSettings] = useState(false);
  const pests = records.reduce((sum, record) => sum + confirmedCount(record), 0);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  if (settings) return <Settings session={session} demoMode={demoMode} onBack={() => setSettings(false)} onLogout={onLogout} />;

  return <View style={styles.page}><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <View style={styles.hero}>
      <View style={styles.profileRow}>
        <Image accessibilityLabel="Foto fictícia do usuário" source={session.role === "admin" ? require("../../assets/profile-admin-v2.png") : require("../../assets/profile-operator.png")} style={styles.avatar} />
        <View style={styles.profileCopy}><Text style={styles.greeting}>{greeting},</Text><Text style={styles.profileGreeting}>{session.name}</Text><Text style={styles.profileRole}>{session.role === "admin" ? "Perfil administrador" : "Perfil de inspeção"}</Text></View>
        <Pressable accessibilityLabel="Abrir configurações" onPress={() => setSettings(true)} style={styles.settingsButton}><MaterialCommunityIcons name="cog-outline" size={23} color={colors.white} /></Pressable>
      </View>
    </View>

    <View style={styles.body}>
      <Text style={styles.sectionLabel}>FAZENDA BOA ESPERANÇA · RESUMO</Text>
      <View style={styles.stats}><Stat value={plots.length} label="talhões" icon="vector-polygon" /><Stat value={records.length} label="inspeções" icon="camera-outline" /><Stat value={pests} label="pragas" icon="alert-circle-outline" /></View>

      <Text style={styles.sectionLabel}>SEU PERFIL</Text>
      <View style={styles.accessCard}><View style={styles.accessIcon}><MaterialCommunityIcons name={session.role === "admin" ? "shield-crown-outline" : "account-hard-hat-outline"} size={25} color={colors.green} /></View><View style={{ flex: 1 }}><Text style={styles.accessTitle}>{session.role === "admin" ? "Gestão completa da fazenda" : "Inspeção essencial de campo"}</Text><Text style={styles.accessCopy}>{session.role === "admin" ? "Acompanhe relatórios, compare talhões, gerencie limites, registre pulverizações e exporte os resultados." : "Fotografe laranjas, consulte o mapa, acompanhe o histórico e registre o manejo dos talhões durante a vistoria."}</Text></View></View>
    </View>
  </ScrollView></View>;
}

function Settings({ session, demoMode, onBack, onLogout }: { session: Session; demoMode: boolean; onBack: () => void; onLogout: () => void }) {
  return <View style={styles.page}><ScrollView contentContainerStyle={styles.settingsContent}>
    <View style={styles.settingsHeader}><Pressable accessibilityLabel="Voltar para conta" onPress={onBack} style={styles.backButton}><MaterialCommunityIcons name="chevron-left" size={27} color={colors.ink} /></Pressable><Text style={styles.settingsTitle}>Configurações</Text><View style={styles.headerSpacer} /></View>
    <View style={styles.identityCard}><Image accessibilityLabel="Foto fictícia do usuário" source={session.role === "admin" ? require("../../assets/profile-admin-v2.png") : require("../../assets/profile-operator.png")} style={styles.settingsAvatar} /><Text style={styles.identityName}>{session.name}</Text><Text style={styles.identityRole}>{session.role === "admin" ? "Administrador" : "Equipe de inspeção"}</Text></View>
    <Text style={styles.sectionLabel}>DADOS DA CONTA</Text>
    <View style={styles.listCard}><SettingRow icon="account-outline" label="Nome" value={session.name} /><SettingRow icon="email-outline" label="E-mail" value={session.email} /><SettingRow icon="shield-account-outline" label="Perfil de acesso" value={session.role === "admin" ? "Administrador · acesso completo" : "Inspeção · acesso essencial"} last /></View>
    <Text style={styles.sectionLabel}>APLICATIVO</Text>
    <View style={styles.listCard}><SettingRow icon="cloud-off-outline" label="Armazenamento" value="Neste aparelho" /><SettingRow icon="brain" label="Análise" value={demoMode ? "Demonstração Expo Go" : "Modelo local"} last /></View>
    <Pressable onPress={onLogout} style={styles.logout}><MaterialCommunityIcons name="logout" size={20} color={colors.red} /><Text style={styles.logoutText}>Sair da conta</Text></Pressable>
    <Text style={styles.version}>CYF · Clean Your Farm</Text>
  </ScrollView></View>;
}

function Stat({ value, label, icon }: { value: number; label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }) {
  return <View style={styles.stat}><MaterialCommunityIcons name={icon} size={20} color={colors.green} /><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}
function SettingRow({ icon, label, value, last = false }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; value: string; last?: boolean }) {
  return <View style={[styles.settingRow, last && styles.last]}><MaterialCommunityIcons name={icon} size={21} color={colors.green} /><View style={{ flex: 1 }}><Text style={styles.settingLabel}>{label}</Text><Text style={styles.settingValue}>{value}</Text></View></View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.paper }, content: { paddingBottom: 122 },
  hero: { width: "100%", minHeight: 166, paddingTop: 52, paddingHorizontal: 20, paddingBottom: 23, backgroundColor: colors.green, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  profileRow: { flex: 1, flexDirection: "row", alignItems: "center", gap: 14 }, settingsButton: { width: 42, height: 42, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.14)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)" },
  avatar: { width: 74, height: 74, borderRadius: 37, backgroundColor: colors.greenSoft, borderWidth: 2, borderColor: "rgba(255,255,255,0.45)" }, profileCopy: { flex: 1 }, greeting: { color: "rgba(255,255,255,0.76)", fontFamily: fonts.semibold, fontSize: 13 }, profileGreeting: { color: colors.white, fontFamily: fonts.black, fontSize: 21, lineHeight: 25, marginTop: 1 }, profileRole: { color: "rgba(255,255,255,0.82)", fontFamily: fonts.semibold, fontSize: 12, marginTop: 4 },
  body: { paddingHorizontal: 20 }, sectionLabel: { color: colors.greenDark, fontFamily: fonts.extraBold, fontSize: 11, letterSpacing: 1.3, marginTop: 27, marginBottom: 9 }, stats: { flexDirection: "row", gap: 9 }, stat: { flex: 1, minHeight: 108, borderRadius: 21, padding: 13, backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.lineStrong }, statValue: { color: colors.ink, fontFamily: fonts.black, fontSize: 26, marginTop: 8 }, statLabel: { color: colors.muted, fontFamily: fonts.semibold, fontSize: 13, marginTop: 1 },
  listCard: { backgroundColor: colors.white, borderRadius: 22, overflow: "hidden", borderWidth: 1, borderColor: colors.line, ...shadow }, last: { borderBottomWidth: 0 }, accessCard: { minHeight: 126, padding: 17, borderRadius: 22, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, flexDirection: "row", alignItems: "flex-start", gap: 13, ...shadow }, accessIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.greenSoft, alignItems: "center", justifyContent: "center" }, accessTitle: { color: colors.ink, fontFamily: fonts.extraBold, fontSize: 16 }, accessCopy: { color: colors.muted, fontFamily: fonts.medium, fontSize: 13, lineHeight: 19, marginTop: 5 },
  settingsContent: { paddingHorizontal: 20, paddingTop: 52, paddingBottom: 122 }, settingsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, backButton: { width: 46, height: 46, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.white, ...shadow }, settingsTitle: { color: colors.ink, fontFamily: fonts.black, fontSize: 23 }, headerSpacer: { width: 44 }, identityCard: { alignItems: "center", paddingVertical: 27 }, settingsAvatar: { width: 94, height: 94, borderRadius: 47 }, identityName: { color: colors.ink, fontFamily: fonts.black, fontSize: 25, marginTop: 13 }, identityRole: { color: colors.muted, fontFamily: fonts.semibold, fontSize: 14, marginTop: 3 }, settingRow: { minHeight: 79, paddingHorizontal: 15, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderBottomColor: colors.line }, settingLabel: { color: colors.muted, fontFamily: fonts.semibold, fontSize: 12 }, settingValue: { color: colors.ink, fontFamily: fonts.bold, fontSize: 15, marginTop: 3 }, logout: { marginTop: 27, height: 58, borderRadius: radii.pill, borderWidth: 1.5, borderColor: "#E9A9A3", backgroundColor: colors.white, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }, logoutText: { color: colors.red, fontFamily: fonts.extraBold, fontSize: 15 }, version: { color: colors.muted, fontFamily: fonts.semibold, fontSize: 11, textAlign: "center", marginTop: 18 },
});
