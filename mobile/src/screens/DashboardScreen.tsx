import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { buildDashboard, dashboardPdfHtml } from "../analytics";
import { PieChart } from "../components/PieChart";
import type { InspectionRecord, Plot } from "../types";
import { colors, fonts, radii, shadow } from "../theme";

function localIso(date: Date) {
  const copy = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return copy.toISOString().slice(0, 10);
}

function parsedDate(value: string, end = false) {
  const date = new Date(`${value}T${end ? "23:59:59" : "00:00:00"}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function DashboardScreen({ records, plots, onBack }: { records: InspectionRecord[]; plots: Plot[]; onBack?: () => void }) {
  const now = new Date(); const start = new Date(now); start.setDate(start.getDate() - 29);
  const [fromText, setFromText] = useState(localIso(start));
  const [toText, setToText] = useState(localIso(now));
  const [exporting, setExporting] = useState(false);
  const from = parsedDate(fromText) || start; const to = parsedDate(toText, true) || now;
  const valid = Boolean(parsedDate(fromText) && parsedDate(toText, true) && from <= to);
  const dashboard = buildDashboard(records, plots, from, to);

  function setPeriod(days: number) { const end = new Date(); const begin = new Date(end); begin.setDate(begin.getDate() - days + 1); setFromText(localIso(begin)); setToText(localIso(end)); }
  async function exportPdf() {
    if (!valid) { Alert.alert("Período inválido", "Use datas no formato AAAA-MM-DD."); return; }
    setExporting(true);
    try {
      const file = await Print.printToFileAsync({ html: dashboardPdfHtml(dashboard, from, to), base64: false });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { mimeType: "application/pdf", dialogTitle: "Compartilhar dashboard CYF" });
      else Alert.alert("PDF criado", file.uri);
    } catch (error) {
      Alert.alert("Não foi possível exportar", error instanceof Error ? error.message : "Tente novamente.");
    } finally { setExporting(false); }
  }

  return <View style={styles.page}><ScrollView contentContainerStyle={styles.content}>
    <View style={styles.header}>{onBack ? <Pressable accessibilityLabel="Voltar" onPress={onBack} style={styles.back}><MaterialCommunityIcons name="arrow-left" size={24} color={colors.ink} /></Pressable> : null}<View style={{ flex: 1 }}><Text style={styles.overline}>RELATÓRIOS</Text><Text style={styles.title}>Visão da lavoura</Text><Text style={styles.subtitle}>Compare ocorrências e identifique onde agir primeiro.</Text></View></View>
    <View style={styles.periodCard}><View style={styles.dateRow}><DateField label="Data inicial" value={fromText} onChange={setFromText} /><DateField label="Data final" value={toText} onChange={setToText} /></View><View style={styles.quickRow}>{[7, 14, 30].map((days) => <Pressable key={days} onPress={() => setPeriod(days)} style={styles.quick}><Text style={styles.quickText}>{days} dias</Text></Pressable>)}</View>{!valid && <Text style={styles.error}>Use AAAA-MM-DD e mantenha a data final após a inicial.</Text>}</View>
    <View style={styles.hero}><View><Text style={styles.heroLabel}>Ocorrências no período</Text><Text style={styles.heroValue}>{dashboard.total}</Text><Text style={styles.heroDelta}>{dashboard.delta >= 0 ? "+" : ""}{dashboard.delta} em relação ao período anterior</Text></View><View style={styles.heroBadge}><MaterialCommunityIcons name={dashboard.delta > 0 ? "trending-up" : dashboard.delta < 0 ? "trending-down" : "minus"} size={25} color={colors.white} /></View></View>
    <View style={styles.kpis}><Kpi value={dashboard.photos} label="fotos salvas" /><Kpi value={dashboard.unassigned} label="sem talhão" /><Kpi value={dashboard.increased?.plot.name || "Nenhum"} label="maior aumento" /><Kpi value={dashboard.decreased?.plot.name || "Nenhuma"} label="maior redução" /></View>
    <View style={styles.insightCard}><Text style={styles.insightLabel}>COMPARAÇÃO AUTOMÁTICA</Text><Insight icon="arrow-up" color={colors.red} title="Maior aumento" value={dashboard.increased ? `${dashboard.increased.plot.name} · +${dashboard.increased.delta}` : "Nenhum aumento"} /><Insight icon="arrow-down" color={colors.green} title="Maior redução" value={dashboard.decreased ? `${dashboard.decreased.plot.name} · ${dashboard.decreased.delta}` : "Nenhuma redução"} last /></View>
    <View style={styles.chartCard}><Text style={styles.chartTitle}>Onde estão as ocorrências</Text><Text style={styles.chartCopy}>Distribuição das detecções confirmadas entre os talhões.</Text><View style={styles.chartBody}><PieChart rows={dashboard.rows} /><View style={styles.legend}>{dashboard.rows.length ? dashboard.rows.map((row) => <View key={row.plot.id} style={styles.legendRow}><View style={[styles.legendDot, { backgroundColor: row.color }]} /><Text numberOfLines={1} style={styles.legendName}>{row.plot.name}</Text><Text style={styles.legendValue}>{row.count}</Text></View>) : <Text style={styles.empty}>Delimite um talhão no mapa para comparar áreas.</Text>}</View></View></View>
    <Pressable onPress={exportPdf} disabled={exporting || !valid} style={styles.export}><MaterialCommunityIcons name="file-pdf-box" size={24} color={colors.white} /><Text style={styles.exportText}>{exporting ? "Gerando PDF…" : "Extrair dashboard em PDF"}</Text></Pressable>
    <Text style={styles.note}>O PDF é criado no próprio celular e pode ser salvo ou compartilhado. A contagem considera caixas com confiança ≥95%.</Text>
  </ScrollView></View>;
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <View style={{ flex: 1 }}><Text style={styles.dateLabel}>{label}</Text><TextInput value={value} onChangeText={onChange} maxLength={10} keyboardType="numbers-and-punctuation" style={styles.dateInput} /></View>; }
function Kpi({ value, label }: { value: string | number; label: string }) { return <View style={styles.kpi}><Text numberOfLines={1} style={styles.kpiValue}>{value}</Text><Text style={styles.kpiLabel}>{label}</Text></View>; }
function Insight({ icon, color, title, value, last = false }: { icon: "arrow-up" | "arrow-down"; color: string; title: string; value: string; last?: boolean }) { return <View style={[styles.insightRow, last && styles.insightLast]}><View style={[styles.insightIcon, { backgroundColor: `${color}18` }]}><MaterialCommunityIcons name={icon} size={19} color={color} /></View><View style={{ flex: 1 }}><Text style={styles.insightTitle}>{title}</Text><Text numberOfLines={1} style={styles.insightValue}>{value}</Text></View></View>; }

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.paper }, content: { padding: 20, paddingTop: 52, paddingBottom: 122 }, header: { flexDirection: "row", gap: 12, alignItems: "center" }, back: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.white, alignItems: "center", justifyContent: "center", ...shadow }, overline: { color: colors.green, fontFamily: fonts.bold, fontSize: 9, letterSpacing: 1.5 }, title: { color: colors.ink, fontFamily: fonts.black, fontSize: 31, letterSpacing: -1.3 }, subtitle: { color: colors.muted, fontFamily: fonts.regular, fontSize: 11, lineHeight: 16, marginTop: 4 },
  periodCard: { marginTop: 20, backgroundColor: colors.white, borderRadius: radii.medium, padding: 15, ...shadow }, dateRow: { flexDirection: "row", gap: 10 }, dateLabel: { color: colors.ink, fontFamily: fonts.semibold, fontSize: 10, marginBottom: 6 }, dateInput: { height: 47, borderWidth: 1, borderColor: colors.line, borderRadius: 13, paddingHorizontal: 11, color: colors.ink, fontFamily: fonts.medium, fontSize: 12, backgroundColor: "#FAFBF8" }, quickRow: { flexDirection: "row", gap: 7, marginTop: 10 }, quick: { flex: 1, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: colors.greenSoft }, quickText: { color: colors.green, fontFamily: fonts.bold, fontSize: 10 }, error: { color: colors.red, fontFamily: fonts.medium, fontSize: 10, marginTop: 8 },
  hero: { marginTop: 15, borderRadius: 25, backgroundColor: colors.green, padding: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, heroLabel: { color: "#D8ECDF", fontFamily: fonts.medium, fontSize: 11 }, heroValue: { color: colors.white, fontFamily: fonts.black, fontSize: 43, lineHeight: 48 }, heroDelta: { color: "#D8ECDF", fontFamily: fonts.regular, fontSize: 10 }, heroBadge: { width: 51, height: 51, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  kpis: { flexDirection: "row", flexWrap: "wrap", gap: 9, marginTop: 10 }, kpi: { width: "48.5%", minHeight: 78, borderRadius: 19, padding: 14, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line }, kpiValue: { color: colors.green, fontFamily: fonts.extraBold, fontSize: 18 }, kpiLabel: { color: colors.muted, fontFamily: fonts.regular, fontSize: 10, marginTop: 5 },
  insightCard: { marginTop: 15, borderRadius: 22, padding: 15, backgroundColor: colors.white, ...shadow }, insightLabel: { color: colors.green, fontFamily: fonts.bold, fontSize: 8, letterSpacing: 1.3, marginBottom: 5 }, insightRow: { minHeight: 57, flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: 1, borderBottomColor: colors.line }, insightLast: { borderBottomWidth: 0 }, insightIcon: { width: 37, height: 37, borderRadius: 13, alignItems: "center", justifyContent: "center" }, insightTitle: { color: colors.muted, fontFamily: fonts.regular, fontSize: 9 }, insightValue: { color: colors.ink, fontFamily: fonts.bold, fontSize: 12, marginTop: 2 },
  chartCard: { marginTop: 15, borderRadius: 25, padding: 18, backgroundColor: colors.white, ...shadow }, chartTitle: { color: colors.ink, fontFamily: fonts.extraBold, fontSize: 19 }, chartCopy: { color: colors.muted, fontFamily: fonts.regular, fontSize: 10, lineHeight: 15, marginTop: 4 }, chartBody: { alignItems: "center", marginTop: 8 }, legend: { width: "100%", marginTop: 4 }, legendRow: { minHeight: 33, flexDirection: "row", alignItems: "center", gap: 8, borderBottomWidth: 1, borderBottomColor: "#F0F0EB" }, legendDot: { width: 10, height: 10, borderRadius: 4 }, legendName: { flex: 1, color: colors.ink, fontFamily: fonts.medium, fontSize: 11 }, legendValue: { color: colors.ink, fontFamily: fonts.bold, fontSize: 12 }, empty: { color: colors.muted, fontFamily: fonts.regular, fontSize: 11, textAlign: "center" },
  export: { marginTop: 18, height: 59, borderRadius: radii.pill, backgroundColor: colors.orange, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9 }, exportText: { color: colors.white, fontFamily: fonts.bold, fontSize: 14 }, note: { color: colors.muted, fontFamily: fonts.regular, fontSize: 10, lineHeight: 16, textAlign: "center", paddingHorizontal: 18, marginTop: 12 },
});
