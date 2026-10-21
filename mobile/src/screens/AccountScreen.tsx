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
  if (settings) return <Settings session={session} demoMode={demoMode} onBack={() => setSettings(false)} onLogout={onLogout} />;

  return <View style={styles.page}><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <View style={styles.hero}>
      <View style={styles.profileRow}>
        <Image accessibilityLabel="Foto fictícia do operador" source={require("../../assets/profile-agronomist.png")} style={styles.avatar} />
        <View style={styles.profileCopy}><Text style={styles.profileGreeting}>Olá, {session.name}</Text><Text style={styles.profileTitle}>Pronto para a próxima inspeção</Text><View style={styles.offline}><View style={styles.dot} /><Text style={styles.offlineText}>Dados disponíveis offline</Text></View></View>
        <Pressable accessibilityLabel="Abrir configurações" onPress={() => setSettings(true)} style={styles.settingsButton}><MaterialCommunityIcons name="cog-outline" size={23} color={colors.white} /></Pressable>
      </View>
    </View>

    <View style={styles.body}>
      <Text style={styles.sectionLabel}>RESUMO DA OPERAÇÃO</Text>
      <View style={styles.stats}><Stat value={plots.length} label="talhões" icon="vector-polygon" /><Stat value={records.length} label="inspeções" icon="camera-outline" /><Stat value={pests} label="pragas" icon="alert-circle-outline" /></View>

      <Text style={styles.sectionLabel}>NESTE APARELHO</Text>
      <View style={styles.listCard}>
        <InfoRow icon="cloud-off-outline" title="Funcionamento offline" copy="Inspeções e fotos permanecem disponíveis sem sinal" />
        <InfoRow icon="map-marker-radius-outline" title="Localização protegida" copy="GPS e EXIF são usados apenas para localizar o talhão" />
        <InfoRow icon="shield-check-outline" title="Dados locais" copy="Você decide quando exportar ou compartilhar" last />
      </View>

      <View style={styles.notice}><MaterialCommunityIcons name="information-outline" size={20} color={colors.green} /><Text style={styles.noticeText}>A identificação é uma triagem de campo e deve ser confirmada por um profissional.</Text></View>
    </View>
  </ScrollView></View>;
}

function Settings({ session, demoMode, onBack, onLogout }: { session: Session; demoMode: boolean; onBack: () => void; onLogout: () => void }) {
  return <View style={styles.page}><ScrollView contentContainerStyle={styles.settingsContent}>
    <View style={styles.settingsHeader}><Pressable accessibilityLabel="Voltar para conta" onPress={onBack} style={styles.backButton}><MaterialCommunityIcons name="chevron-left" size={27} color={colors.ink} /></Pressable><Text style={styles.settingsTitle}>Configurações</Text><View style={styles.headerSpacer} /></View>
    <View style={styles.identityCard}><Image accessibilityLabel="Foto fictícia do operador" source={require("../../assets/profile-agronomist.png")} style={styles.settingsAvatar} /><Text style={styles.identityName}>{session.name}</Text><Text style={styles.identityRole}>Operador de campo</Text></View>
    <Text style={styles.sectionLabel}>DADOS DA CONTA</Text>
    <View style={styles.listCard}><SettingRow icon="account-outline" label="Nome" value={session.name} /><SettingRow icon="email-outline" label="E-mail" value={session.email} /><SettingRow icon="cellphone" label="Tipo de acesso" value="Conta demonstrativa" last /></View>
    <Text style={styles.sectionLabel}>APLICATIVO</Text>
    <View style={styles.listCard}><SettingRow icon="cloud-off-outline" label="Armazenamento" value="Neste aparelho" /><SettingRow icon="brain" label="Análise" value={demoMode ? "Demonstração Expo Go" : "Modelo local"} last /></View>
    <Pressable onPress={onLogout} style={styles.logout}><MaterialCommunityIcons name="logout" size={20} color={colors.red} /><Text style={styles.logoutText}>Sair da conta</Text></Pressable>
    <Text style={styles.version}>CYF · Clean Your Farm</Text>
  </ScrollView></View>;
}

function Stat({ value, label, icon }: { value: number; label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }) {
  return <View style={styles.stat}><MaterialCommunityIcons name={icon} size={20} color={colors.green} /><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}
function InfoRow({ icon, title, copy, last = false }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; title: string; copy: string; last?: boolean }) {
  return <View accessibilityLabel={`${title}. ${copy}`} style={[styles.infoRow, last && styles.last]}><View style={styles.infoIcon}><MaterialCommunityIcons name={icon} size={21} color={colors.green} /></View><View style={{ flex: 1 }}><Text style={styles.cardTitle}>{title}</Text><Text style={styles.cardText}>{copy}</Text></View></View>;
}
function SettingRow({ icon, label, value, last = false }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; value: string; last?: boolean }) {
  return <View style={[styles.settingRow, last && styles.last]}><MaterialCommunityIcons name={icon} size={21} color={colors.green} /><View style={{ flex: 1 }}><Text style={styles.settingLabel}>{label}</Text><Text style={styles.settingValue}>{value}</Text></View></View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.paper }, content: { paddingBottom: 122 },
  hero: { width: "100%", minHeight: 205, paddingTop: 54, paddingHorizontal: 20, paddingBottom: 28, backgroundColor: colors.green, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  profileRow: { flex: 1, flexDirection: "row", alignItems: "center", gap: 14 }, settingsButton: { width: 42, height: 42, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.14)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)" },
  avatar: { width: 82, height: 82, borderRadius: 41, backgroundColor: colors.greenSoft, borderWidth: 2, borderColor: "rgba(255,255,255,0.26)" }, profileCopy: { flex: 1 }, profileGreeting: { color: colors.white, fontFamily: fonts.extraBold, fontSize: 17, lineHeight: 21 }, profileTitle: { color: "#D9EDE0", fontFamily: fonts.semibold, fontSize: 11, lineHeight: 16, marginTop: 4 }, offline: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 9 }, dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#65E08A" }, offlineText: { color: "#DBF0E2", fontFamily: fonts.medium, fontSize: 9 },
  body: { paddingHorizontal: 20 }, sectionLabel: { color: colors.green, fontFamily: fonts.bold, fontSize: 9, letterSpacing: 1.5, marginTop: 27, marginBottom: 9 }, stats: { flexDirection: "row", gap: 9 }, stat: { flex: 1, minHeight: 102, borderRadius: 21, padding: 13, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line }, statValue: { color: colors.ink, fontFamily: fonts.black, fontSize: 24, marginTop: 8 }, statLabel: { color: colors.muted, fontFamily: fonts.regular, fontSize: 10, marginTop: 1 },
  statusCard: { marginTop: 13, borderRadius: 21, padding: 15, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.greenSoft }, statusIcon: { width: 44, height: 44, borderRadius: 15, backgroundColor: colors.white, alignItems: "center", justifyContent: "center" }, cardTitle: { color: colors.ink, fontFamily: fonts.bold, fontSize: 13 }, cardText: { color: colors.muted, fontFamily: fonts.regular, fontSize: 10, lineHeight: 15, marginTop: 3 }, listCard: { backgroundColor: colors.white, borderRadius: 22, overflow: "hidden", ...shadow }, infoRow: { minHeight: 76, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 11, borderBottomWidth: 1, borderBottomColor: colors.line }, last: { borderBottomWidth: 0 }, infoIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.greenSoft, alignItems: "center", justifyContent: "center" }, notice: { marginTop: 19, padding: 14, flexDirection: "row", gap: 9, borderRadius: 18, backgroundColor: colors.greenSoft }, noticeText: { flex: 1, color: colors.greenDark, fontFamily: fonts.regular, fontSize: 10, lineHeight: 16 },
  settingsContent: { paddingHorizontal: 20, paddingTop: 52, paddingBottom: 122 }, settingsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, backButton: { width: 44, height: 44, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.white, ...shadow }, settingsTitle: { color: colors.ink, fontFamily: fonts.extraBold, fontSize: 20 }, headerSpacer: { width: 44 }, identityCard: { alignItems: "center", paddingVertical: 27 }, settingsAvatar: { width: 94, height: 94, borderRadius: 47 }, identityName: { color: colors.ink, fontFamily: fonts.black, fontSize: 23, marginTop: 13 }, identityRole: { color: colors.muted, fontFamily: fonts.regular, fontSize: 11, marginTop: 3 }, settingRow: { minHeight: 70, paddingHorizontal: 15, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderBottomColor: colors.line }, settingLabel: { color: colors.muted, fontFamily: fonts.regular, fontSize: 9 }, settingValue: { color: colors.ink, fontFamily: fonts.semibold, fontSize: 12, marginTop: 2 }, logout: { marginTop: 27, height: 55, borderRadius: radii.pill, borderWidth: 1, borderColor: "#F0CBC6", backgroundColor: colors.white, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }, logoutText: { color: colors.red, fontFamily: fonts.bold, fontSize: 13 }, version: { color: colors.muted, fontFamily: fonts.regular, fontSize: 9, textAlign: "center", marginTop: 18 },
});
