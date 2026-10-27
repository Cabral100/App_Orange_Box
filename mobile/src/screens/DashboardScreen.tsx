import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { buildDashboard, dashboardPdfHtml, severity } from "../analytics";
import { PieChart } from "../components/PieChart";
import type { InspectionRecord, Plot } from "../types";
import { colors, fonts, radii, shadow } from "../theme";

const reportColors = { navy: colors.greenDark, orange: colors.orange, background: colors.paper, pale: colors.greenSoft };

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
  const [statementSearch, setStatementSearch] = useState("");
  const [statementPlot, setStatementPlot] = useState("all");
  const [statementExpanded, setStatementExpanded] = useState(false);
  const from = parsedDate(fromText) || start; const to = parsedDate(toText, true) || now;
  const valid = Boolean(parsedDate(fromText) && parsedDate(toText, true) && from <= to);
  const dashboard = buildDashboard(records, plots, from, to);
  const searchedStatementRows = dashboard.rows.filter((row) => row.plot.name.toLocaleLowerCase("pt-BR").includes(statementSearch.trim().toLocaleLowerCase("pt-BR")));
  const statementRows = dashboard.rows.filter((row) => statementPlot === "all" || row.plot.id === statementPlot);
  const visibleStatementRows = statementExpanded ? statementRows : statementRows.slice(0, 2);

  function setPeriod(days: number) { const end = new Date(); const begin = new Date(end); begin.setDate(begin.getDate() - days + 1); setFromText(localIso(begin)); setToText(localIso(end)); }
  async function exportPdf() {
    if (!valid) { Alert.alert("Período inválido", "Use datas no formato AAAA-MM-DD."); return; }
    setExporting(true);
    try {
      const imageSources = Object.fromEntries(await Promise.all(dashboard.currentRecords.map(async (record) => {
        if (!record.imageUri.startsWith("file://")) return [record.id, record.imageUri] as const;
        const base64 = await FileSystem.readAsStringAsync(record.imageUri, { encoding: FileSystem.EncodingType.Base64 }).catch(() => "");
        const mimeType = record.imageUri.toLowerCase().includes(".png") ? "image/png" : "image/jpeg";
        return [record.id, base64 ? `data:${mimeType};base64,${base64}` : ""] as const;
      })));
      const file = await Print.printToFileAsync({ html: dashboardPdfHtml(dashboard, from, to, plots, imageSources), base64: false });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { mimeType: "application/pdf", dialogTitle: "Compartilhar relatório CYF" });
      else Alert.alert("PDF criado", file.uri);
    } catch (error) {
      Alert.alert("Não foi possível exportar", error instanceof Error ? error.message : "Tente novamente.");
    } finally { setExporting(false); }
  }

  return <View style={styles.page}><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <View style={styles.header}>{onBack ? <Pressable accessibilityLabel="Voltar" onPress={onBack} style={styles.back}><MaterialCommunityIcons name="arrow-left" size={24} color={reportColors.navy} /></Pressable> : null}<View style={{ flex: 1 }}><Text style={styles.title}>Visão geral da lavoura</Text><Text style={styles.subtitle}>Resumo executivo, distribuição e extrato detalhado das inspeções.</Text></View></View>

    <View style={styles.periodCard}><View style={styles.periodHeader}><Text style={styles.sectionEyebrow}>PERÍODO DO EXTRATO</Text><MaterialCommunityIcons name="calendar-range" size={19} color={reportColors.navy} /></View><View style={styles.dateRow}><DateField label="De" value={fromText} onChange={setFromText} /><DateField label="Até" value={toText} onChange={setToText} /></View><View style={styles.quickRow}>{[7, 14, 30].map((days) => <Pressable key={days} onPress={() => setPeriod(days)} style={styles.quick}><Text style={styles.quickText}>{days} dias</Text></Pressable>)}</View>{!valid ? <Text style={styles.error}>Use AAAA-MM-DD e mantenha a data final após a inicial.</Text> : null}</View>

    <Text style={styles.blockTitle}>Resumo executivo</Text>
    <View style={styles.hero}><View><Text style={styles.heroLabel}>Detecções confirmadas</Text><Text style={styles.heroValue}>{dashboard.total}</Text><Text style={styles.heroDelta}>{dashboard.delta >= 0 ? "+" : ""}{dashboard.delta} versus período anterior</Text></View><View style={styles.heroBadge}><MaterialCommunityIcons name={dashboard.delta > 0 ? "trending-up" : dashboard.delta < 0 ? "trending-down" : "minus"} size={25} color={colors.white} /></View></View>
    <View style={styles.kpis}><Kpi value={dashboard.photos} label="inspeções" /><Kpi value={dashboard.unassigned} label="sem talhão" /><Kpi value={plots.length} label="talhões" /></View>

    <View style={styles.chartCard}><View style={styles.cardHeader}><View><Text style={styles.chartTitle}>Distribuição por talhão</Text><Text style={styles.chartCopy}>Participação de cada área nas detecções do período.</Text></View><MaterialCommunityIcons name="chart-donut" size={23} color={reportColors.orange} /></View><PieChart rows={dashboard.rows} size={220} /><View style={styles.legend}>{dashboard.rows.length ? dashboard.rows.map((row) => <View key={row.plot.id} style={styles.legendRow}><View style={[styles.legendDot, { backgroundColor: row.chartColor }]} /><Text numberOfLines={1} style={styles.legendName}>{row.plot.name}</Text><Text style={styles.legendValue}>{row.count}</Text></View>) : <Text style={styles.empty}>Delimite um talhão para comparar áreas.</Text>}</View></View>

    <View style={styles.statementCard}><View style={styles.cardHeader}><View><Text style={styles.chartTitle}>Extrato por talhão</Text><Text style={styles.chartCopy}>Inspeções, ocorrências e variação.</Text></View><MaterialCommunityIcons name="file-table-outline" size={22} color={reportColors.navy} /></View>
      <View style={styles.statementSearch}><MaterialCommunityIcons name="magnify" size={19} color={colors.muted} /><TextInput value={statementSearch} onChangeText={setStatementSearch} placeholder="Buscar talhão pelo nome" placeholderTextColor={colors.muted} style={styles.statementSearchInput} />{statementSearch ? <Pressable onPress={() => setStatementSearch("")}><MaterialCommunityIcons name="close-circle" size={18} color={colors.muted} /></Pressable> : null}</View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statementFilters}><Pressable onPress={() => { setStatementPlot("all"); setStatementExpanded(false); }} style={[styles.statementChip, statementPlot === "all" && styles.statementChipActive]}><Text style={[styles.statementChipText, statementPlot === "all" && styles.statementChipTextActive]}>Todos</Text></Pressable>{(statementSearch ? searchedStatementRows : dashboard.rows.slice(0, 4)).map((row) => <Pressable key={row.plot.id} onPress={() => { setStatementPlot(row.plot.id); setStatementExpanded(false); }} style={[styles.statementChip, statementPlot === row.plot.id && styles.statementChipActive]}><Text numberOfLines={1} style={[styles.statementChipText, statementPlot === row.plot.id && styles.statementChipTextActive]}>{row.plot.name}</Text></Pressable>)}</ScrollView>
      {visibleStatementRows.length ? visibleStatementRows.map((row, index) => {
      const state = severity(row.count);
      return <View key={row.plot.id} style={[styles.statementRow, index === visibleStatementRows.length - 1 && styles.statementLast]}><View style={[styles.statusLine, { backgroundColor: state.color }]} /><View style={{ flex: 1 }}><Text numberOfLines={1} style={styles.statementName}>{row.plot.name}</Text><Text style={styles.statementMeta}>{row.photos} inspeção(ões) · {state.label}</Text></View><View style={styles.statementNumbers}><Text style={styles.statementValue}>{row.count}</Text><Text style={[styles.statementDelta, { color: row.delta > 0 ? colors.red : row.delta < 0 ? colors.green : colors.muted }]}>{row.delta > 0 ? "+" : ""}{row.delta}</Text></View></View>;
    }) : <Text style={styles.empty}>Nenhum talhão encontrado.</Text>}{statementRows.length > 2 ? <Pressable onPress={() => setStatementExpanded((value) => !value)} style={styles.expandStatement}><MaterialCommunityIcons name={statementExpanded ? "chevron-up" : "arrow-expand-vertical"} size={19} color={colors.green} /><Text style={styles.expandStatementText}>{statementExpanded ? "Reduzir visão" : `Ver todos (${statementRows.length})`}</Text></Pressable> : null}</View>

    <View style={styles.insightCard}><Text style={styles.sectionEyebrow}>LEITURA AUTOMÁTICA</Text><Insight icon="arrow-up" color={colors.red} title="Maior aumento" value={dashboard.increased ? `${dashboard.increased.plot.name} · +${dashboard.increased.delta}` : "Nenhum aumento"} /><Insight icon="arrow-down" color={colors.green} title="Maior redução" value={dashboard.decreased ? `${dashboard.decreased.plot.name} · ${dashboard.decreased.delta}` : "Nenhuma redução"} last /></View>

    <Pressable onPress={exportPdf} disabled={exporting || !valid} style={styles.export}><MaterialCommunityIcons name="file-pdf-box" size={24} color={colors.white} /><Text style={styles.exportText}>{exporting ? "Gerando PDF…" : "Extrair relatório completo em PDF"}</Text></Pressable>
    <Text style={styles.note}>O PDF inclui resumo, gráfico de pizza, tabela por talhão e todas as inspeções com horário, confiança, origem e coordenadas.</Text>
  </ScrollView></View>;
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <View style={{ flex: 1 }}><Text style={styles.dateLabel}>{label}</Text><TextInput value={value} onChangeText={onChange} maxLength={10} keyboardType="numbers-and-punctuation" style={styles.dateInput} /></View>; }
function Kpi({ value, label }: { value: string | number; label: string }) { return <View style={styles.kpi}><Text numberOfLines={1} style={styles.kpiValue}>{value}</Text><Text style={styles.kpiLabel}>{label}</Text></View>; }
function Insight({ icon, color, title, value, last = false }: { icon: "arrow-up" | "arrow-down"; color: string; title: string; value: string; last?: boolean }) { return <View style={[styles.insightRow, last && styles.insightLast]}><View style={[styles.insightIcon, { backgroundColor: `${color}18` }]}><MaterialCommunityIcons name={icon} size={19} color={color} /></View><View style={{ flex: 1 }}><Text style={styles.insightTitle}>{title}</Text><Text numberOfLines={1} style={styles.insightValue}>{value}</Text></View></View>; }

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: reportColors.background }, content: { padding: 20, paddingTop: 52, paddingBottom: 122 }, header: { flexDirection: "row", gap: 11, alignItems: "center" }, back: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.white, alignItems: "center", justifyContent: "center", ...shadow }, title: { color: reportColors.navy, fontFamily: fonts.black, fontSize: 32, letterSpacing: -1.1 }, subtitle: { color: colors.muted, fontFamily: fonts.semibold, fontSize: 14, lineHeight: 20, marginTop: 4 },
  periodCard: { marginTop: 20, backgroundColor: colors.white, borderRadius: radii.medium, padding: 15, borderWidth: 1, borderColor: colors.line, ...shadow }, periodHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }, sectionEyebrow: { color: reportColors.navy, fontFamily: fonts.extraBold, fontSize: 11, letterSpacing: 1.2 }, dateRow: { flexDirection: "row", gap: 10 }, dateLabel: { color: reportColors.navy, fontFamily: fonts.bold, fontSize: 12, marginBottom: 6 }, dateInput: { height: 49, borderWidth: 1.5, borderColor: colors.lineStrong, borderRadius: 13, paddingHorizontal: 11, color: reportColors.navy, fontFamily: fonts.semibold, fontSize: 14, backgroundColor: "#F8FAFC" }, quickRow: { flexDirection: "row", gap: 7, marginTop: 9 }, quick: { flex: 1, height: 39, alignItems: "center", justifyContent: "center", borderRadius: 11, backgroundColor: reportColors.pale }, quickText: { color: reportColors.navy, fontFamily: fonts.extraBold, fontSize: 12 }, error: { color: colors.red, fontFamily: fonts.semibold, fontSize: 12, marginTop: 8 },
  blockTitle: { color: reportColors.navy, fontFamily: fonts.extraBold, fontSize: 18, marginTop: 23, marginBottom: 9 }, hero: { borderRadius: 24, backgroundColor: reportColors.navy, padding: 19, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, heroLabel: { color: "#DDE6F0", fontFamily: fonts.medium, fontSize: 10 }, heroValue: { color: colors.white, fontFamily: fonts.black, fontSize: 42, lineHeight: 47 }, heroDelta: { color: "#DDE6F0", fontFamily: fonts.regular, fontSize: 9 }, heroBadge: { width: 49, height: 49, borderRadius: 17, backgroundColor: reportColors.orange, alignItems: "center", justifyContent: "center" },
  kpis: { flexDirection: "row", gap: 8, marginTop: 9 }, kpi: { flex: 1, minHeight: 86, borderRadius: 18, padding: 12, backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.lineStrong }, kpiValue: { color: reportColors.navy, fontFamily: fonts.black, fontSize: 22 }, kpiLabel: { color: colors.muted, fontFamily: fonts.semibold, fontSize: 12, marginTop: 4 },
  chartCard: { marginTop: 15, borderRadius: 24, padding: 17, backgroundColor: colors.white, alignItems: "center", ...shadow }, cardHeader: { width: "100%", flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }, chartTitle: { color: reportColors.navy, fontFamily: fonts.black, fontSize: 21 }, chartCopy: { color: colors.muted, fontFamily: fonts.medium, fontSize: 13, lineHeight: 19, marginTop: 3 }, legend: { width: "100%", marginTop: 2 }, legendRow: { minHeight: 40, flexDirection: "row", alignItems: "center", gap: 8, borderBottomWidth: 1, borderBottomColor: "#E9EDF2" }, legendDot: { width: 12, height: 12, borderRadius: 4 }, legendName: { flex: 1, color: reportColors.navy, fontFamily: fonts.semibold, fontSize: 13 }, legendValue: { color: reportColors.navy, fontFamily: fonts.extraBold, fontSize: 14 }, empty: { color: colors.muted, fontFamily: fonts.medium, fontSize: 13, textAlign: "center", paddingVertical: 16 },
  statementCard: { marginTop: 15, borderRadius: 24, padding: 17, backgroundColor: colors.white, ...shadow }, statementSearch: { height: 42, borderRadius: 14, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 11, marginTop: 13, backgroundColor: colors.paper, flexDirection: "row", alignItems: "center", gap: 7 }, statementSearchInput: { flex: 1, color: colors.ink, fontFamily: fonts.medium, fontSize: 10 }, statementFilters: { gap: 6, paddingTop: 8, paddingBottom: 3 }, statementChip: { maxWidth: 160, height: 33, borderRadius: 17, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 11, alignItems: "center", justifyContent: "center" }, statementChipActive: { backgroundColor: colors.green, borderColor: colors.green }, statementChipText: { color: colors.ink, fontFamily: fonts.semibold, fontSize: 9 }, statementChipTextActive: { color: colors.white }, statementRow: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: 1, borderBottomColor: colors.line }, statementLast: { borderBottomWidth: 0 }, statusLine: { width: 4, height: 35, borderRadius: 3 }, statementName: { color: colors.ink, fontFamily: fonts.bold, fontSize: 11 }, statementMeta: { color: colors.muted, fontFamily: fonts.regular, fontSize: 8, marginTop: 3 }, statementNumbers: { alignItems: "flex-end" }, statementValue: { color: colors.ink, fontFamily: fonts.extraBold, fontSize: 15 }, statementDelta: { fontFamily: fonts.bold, fontSize: 9, marginTop: 2 }, expandStatement: { height: 40, marginTop: 5, borderRadius: 14, backgroundColor: colors.greenSoft, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }, expandStatementText: { color: colors.green, fontFamily: fonts.bold, fontSize: 10 },
  insightCard: { marginTop: 15, borderRadius: 22, padding: 15, backgroundColor: colors.white, ...shadow }, insightRow: { minHeight: 57, flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: 1, borderBottomColor: colors.line }, insightLast: { borderBottomWidth: 0 }, insightIcon: { width: 37, height: 37, borderRadius: 13, alignItems: "center", justifyContent: "center" }, insightTitle: { color: colors.muted, fontFamily: fonts.regular, fontSize: 9 }, insightValue: { color: colors.ink, fontFamily: fonts.bold, fontSize: 11, marginTop: 2 },
  export: { marginTop: 18, height: 60, borderRadius: radii.pill, backgroundColor: reportColors.orange, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9 }, exportText: { color: colors.white, fontFamily: fonts.extraBold, fontSize: 16 }, note: { color: colors.muted, fontFamily: fonts.medium, fontSize: 12, lineHeight: 18, textAlign: "center", paddingHorizontal: 14, marginTop: 11 },
});
