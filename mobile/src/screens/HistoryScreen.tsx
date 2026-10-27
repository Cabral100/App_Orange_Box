import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useMemo, useState } from "react";
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { confirmedCount, recordPlot } from "../analytics";
import type { InspectionRecord, Plot } from "../types";
import { colors, fonts, radii, shadow } from "../theme";

type Props = {
  records: InspectionRecord[];
  plots: Plot[];
  onDashboard?: () => void;
  onSelect: (record: InspectionRecord) => void;
  onUpdate: (record: InspectionRecord) => Promise<void>;
  onDelete: (recordId: string) => Promise<void>;
};
type LevelFilter = "all" | "green" | "yellow" | "red";
type DayPart = "all" | "morning" | "afternoon";

function dayGroup(value: string) {
  const date = new Date(value); const today = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  if (start === startToday) return "Hoje";
  if (start === startToday - 86400000) return "Ontem";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });
}

export function HistoryScreen({ records, plots, onDashboard, onSelect, onUpdate, onDelete }: Props) {
  const [plotFilter, setPlotFilter] = useState<string>("all");
  const [days, setDays] = useState(14);
  const [dayPart, setDayPart] = useState<DayPart>("all");
  const [levelFilter, setLevelFilter] = useState<LevelFilter>("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [plotSearch, setPlotSearch] = useState("");
  const [selected, setSelected] = useState<InspectionRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const hasFilters = days !== 14 || dayPart !== "all" || plotFilter !== "all" || levelFilter !== "all" || Boolean(plotSearch.trim());
  const selectedRecordPlot = selected ? recordPlot(selected, plots) : null;
  const searchedPlots = useMemo(() => plots.filter((plot) => plot.name.toLocaleLowerCase("pt-BR").includes(plotSearch.trim().toLocaleLowerCase("pt-BR"))), [plotSearch, plots]);
  const filtered = useMemo(() => {
    const now = new Date();
    const cutoff = days === 0 ? new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() : Date.now() - days * 86400000;
    return records
      .filter((record) => new Date(record.capturedAt).getTime() >= cutoff)
      .filter((record) => {
        if (days !== 0 || dayPart === "all") return true;
        const hour = new Date(record.capturedAt).getHours();
        return dayPart === "morning" ? hour < 12 : hour >= 12;
      })
      .filter((record) => plotFilter === "all" || recordPlot(record, plots)?.id === plotFilter)
      .filter((record) => {
        if (levelFilter === "all") return true;
        const count = confirmedCount(record);
        return levelFilter === "green" ? count === 0 : levelFilter === "yellow" ? count > 0 && count <= 20 : count > 20;
      })
      .sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime());
  }, [dayPart, days, levelFilter, plotFilter, plots, records]);
  const groups = useMemo(() => {
    const result = new Map<string, InspectionRecord[]>();
    filtered.forEach((record) => {
      const key = dayGroup(record.capturedAt);
      result.set(key, [...(result.get(key) || []), record]);
    });
    return [...result.entries()];
  }, [filtered]);

  async function assignPlot(plotId: string | null) {
    if (!selected) return;
    setSaving(true);
    try {
      await onUpdate({ ...selected, plotId, mapVisible: Boolean(plotId) });
      setSelected(null);
    } finally {
      setSaving(false);
    }
  }

  function removeSelected() {
    if (!selected) return;
    const target = selected;
    Alert.alert("Excluir inspeção?", "A foto e os dados desta inspeção serão removidos do histórico.", [
      { text: "Cancelar", style: "cancel" },
      { text: "Excluir", style: "destructive", onPress: async () => { await onDelete(target.id); setSelected(null); } },
    ]);
  }

  return <View style={styles.page}>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}><View><Text style={styles.overline}>DADOS DO CAMPO</Text><Text style={styles.title}>Histórico</Text></View>{onDashboard ? <Pressable accessibilityLabel="Abrir relatórios" onPress={onDashboard} style={styles.dashboardButton}><MaterialCommunityIcons name="chart-donut" size={22} color={colors.white} /><Text style={styles.dashboardText}>Relatórios</Text></Pressable> : null}</View>
      <View style={styles.filterBar}><Pressable onPress={() => setFiltersOpen(true)} style={styles.filterButton}><MaterialCommunityIcons name="tune-variant" size={18} color={colors.green} /><Text numberOfLines={1} style={styles.filterSummary}>{days === 0 ? `Hoje · ${dayPart === "morning" ? "antes das 12h" : dayPart === "afternoon" ? "depois das 12h" : "dia inteiro"}` : `${days} dias`}</Text><MaterialCommunityIcons name="chevron-down" size={17} color={colors.muted} /></Pressable><Text style={styles.resultCount}>{filtered.length} registro(s)</Text></View>

      {groups.length ? groups.map(([label, items]) => <View key={label} style={styles.group}><Text style={styles.groupTitle}>{label}</Text><View style={styles.card}>{items.map((record, index) => {
        const count = confirmedCount(record); const plot = recordPlot(record, plots);
        return <Pressable key={record.id} onPress={() => setSelected(record)} style={[styles.item, index === items.length - 1 && styles.itemLast]}>
          <Image source={{ uri: record.imageUri }} style={styles.thumb} />
          <View style={styles.itemCopy}><View style={styles.itemTitleRow}><Text numberOfLines={1} style={styles.itemTitle}>{plot?.name || "Sem talhão"}</Text>{record.demo ? <Text style={styles.demoBadge}>DEMO</Text> : null}</View><Text style={[styles.itemStatus, { color: count ? colors.orange : colors.green }]}>{count ? `${count} ácaro(s) detectado(s)` : "Sem sinal confirmado"}</Text></View>
          <View style={styles.itemMeta}><MaterialCommunityIcons name={record.mapVisible ? "map-marker-check" : "map-marker-off-outline"} size={21} color={record.mapVisible ? colors.green : "#9BA09C"} /><MaterialCommunityIcons name="dots-vertical" size={21} color="#9BA09C" /></View>
        </Pressable>;
      })}</View></View>) : <View style={styles.empty}><MaterialCommunityIcons name="camera-off-outline" size={46} color="#9DA59F" /><Text style={styles.emptyTitle}>Nenhuma vistoria neste período</Text><Text style={styles.emptyCopy}>Use a câmera para registrar uma laranja, mesmo quando não houver praga.</Text></View>}
    </ScrollView>

    <Modal visible={filtersOpen} transparent animationType="fade" onRequestClose={() => setFiltersOpen(false)}>
      <View style={styles.filterShade}><View style={styles.filterCard}><View style={styles.modalHeader}><View><Text style={styles.modalOverline}>FILTROS DO HISTÓRICO</Text><Text style={styles.filterTitle}>Refinar registros</Text></View><Pressable onPress={() => setFiltersOpen(false)}><MaterialCommunityIcons name="close" size={25} color={colors.ink} /></Pressable></View>
        <Text style={styles.filterLabel}>PERÍODO</Text><View style={styles.periodChoices}>{[0, 7, 14, 30].map((value) => <FilterChip key={value} small selected={days === value} label={value === 0 ? "Hoje" : `${value} dias`} onPress={() => { setDays(value); if (value !== 0) setDayPart("all"); }} />)}</View>
        {days === 0 ? <><Text style={styles.filterLabel}>HORÁRIO DE HOJE</Text><View style={styles.dayPartRow}><Choice label="Dia inteiro" selected={dayPart === "all"} onPress={() => setDayPart("all")} /><Choice label="Antes das 12h" selected={dayPart === "morning"} onPress={() => setDayPart("morning")} /><Choice label="Depois das 12h" selected={dayPart === "afternoon"} onPress={() => setDayPart("afternoon")} /></View></> : null}
        <Text style={styles.filterLabel}>TALHÃO</Text><View style={styles.searchBox}><MaterialCommunityIcons name="magnify" size={19} color={colors.muted} /><TextInput value={plotSearch} onChangeText={setPlotSearch} placeholder="Buscar talhão pelo nome" placeholderTextColor={colors.muted} style={styles.searchInput} />{plotSearch ? <Pressable onPress={() => setPlotSearch("")}><MaterialCommunityIcons name="close-circle" size={18} color={colors.muted} /></Pressable> : null}</View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.choiceList}><Choice label="Todos" selected={plotFilter === "all"} onPress={() => setPlotFilter("all")} />{searchedPlots.map((plot) => <Choice key={plot.id} label={plot.name} selected={plotFilter === plot.id} onPress={() => setPlotFilter(plot.id)} />)}</ScrollView>
        <Text style={styles.filterLabel}>SITUAÇÃO</Text><View style={styles.levelRow}><LevelChoice label="Todas" color={colors.muted} selected={levelFilter === "all"} onPress={() => setLevelFilter("all")} /><LevelChoice label="Verdes" color={colors.green} selected={levelFilter === "green"} onPress={() => setLevelFilter("green")} /><LevelChoice label="Amarelas" color={colors.yellow} selected={levelFilter === "yellow"} onPress={() => setLevelFilter("yellow")} /><LevelChoice label="Vermelhas" color={colors.red} selected={levelFilter === "red"} onPress={() => setLevelFilter("red")} /></View>
        {hasFilters ? <Pressable onPress={() => { setDays(14); setDayPart("all"); setPlotFilter("all"); setLevelFilter("all"); setPlotSearch(""); }} style={styles.clearButton}><MaterialCommunityIcons name="filter-remove-outline" size={18} color={colors.green} /><Text style={styles.clearText}>Limpar filtros</Text></Pressable> : null}
        <Pressable onPress={() => setFiltersOpen(false)} style={styles.applyButton}><Text style={styles.applyText}>Ver {filtered.length} registro(s)</Text></Pressable>
      </View></View>
    </Modal>

    <Modal visible={Boolean(selected)} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
      <View style={styles.modalShade}><View style={styles.modalCard}><View style={styles.modalHandle} />
        <View style={styles.modalHeader}><View style={{ flex: 1 }}><Text style={styles.modalOverline}>{selected?.demo ? "INSPEÇÃO DE EXEMPLO" : "INSPEÇÃO DE CAMPO"}</Text><Text style={styles.modalTitle}>{selectedRecordPlot?.name || "Sem talhão"}</Text></View><Pressable accessibilityLabel="Fechar opções" onPress={() => setSelected(null)}><MaterialCommunityIcons name="close" size={26} color={colors.ink} /></Pressable></View>
        <Text style={styles.modalCopy}>Abra os detalhes, altere o talhão associado ou exclua este registro.</Text>
        {selected ? <Pressable onPress={() => { setSelected(null); onSelect(selected); }} style={styles.openButton}><MaterialCommunityIcons name="image-search-outline" size={21} color={colors.white} /><Text style={styles.openButtonText}>Ver detalhes da inspeção</Text></Pressable> : null}
        <Text style={styles.assignLabel}>ALTERAR TALHÃO</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.assignList}>
          <Pressable disabled={saving} onPress={() => assignPlot(null)} style={[styles.assignChip, !selected?.plotId && styles.assignChipSelected]}><Text style={[styles.assignText, !selected?.plotId && styles.assignTextSelected]}>Sem talhão</Text></Pressable>
          {plots.map((plot) => <Pressable key={plot.id} disabled={saving} onPress={() => assignPlot(plot.id)} style={[styles.assignChip, selected?.plotId === plot.id && styles.assignChipSelected]}><Text style={[styles.assignText, selected?.plotId === plot.id && styles.assignTextSelected]}>{plot.name}</Text></Pressable>)}
        </ScrollView>
        <Pressable disabled={saving} onPress={removeSelected} style={styles.deleteButton}><MaterialCommunityIcons name="trash-can-outline" size={20} color={colors.red} /><Text style={styles.deleteText}>Excluir inspeção</Text></Pressable>
      </View></View>
    </Modal>
  </View>;
}

function FilterChip({ selected, label, onPress, small = false }: { selected: boolean; label: string; onPress: () => void; small?: boolean }) {
  return <Pressable onPress={onPress} style={[styles.filterChip, small && styles.filterSmall, selected && styles.filterSelected]}><Text style={[styles.filterText, selected && styles.filterTextSelected]}>{label}</Text></Pressable>;
}
function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) { return <Pressable onPress={onPress} style={[styles.choice, selected && styles.choiceSelected]}><Text numberOfLines={1} style={[styles.choiceText, selected && styles.choiceTextSelected]}>{label}</Text></Pressable>; }
function LevelChoice({ label, color, selected, onPress }: { label: string; color: string; selected: boolean; onPress: () => void }) { return <Pressable onPress={onPress} style={[styles.levelChoice, selected && { borderColor: color, backgroundColor: `${color}14` }]}><View style={[styles.levelDot, { backgroundColor: color }]} /><Text style={styles.levelText}>{label}</Text></Pressable>; }

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.paper }, content: { paddingTop: 55, paddingHorizontal: 20, paddingBottom: 116 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, overline: { color: colors.greenDark, fontFamily: fonts.extraBold, fontSize: 12, letterSpacing: 1.3 }, title: { color: colors.ink, fontFamily: fonts.black, fontSize: 37, letterSpacing: -1.3, marginTop: 3 },
  dashboardButton: { minHeight: 48, borderRadius: radii.pill, paddingHorizontal: 15, backgroundColor: colors.orange, flexDirection: "row", alignItems: "center", gap: 7 }, dashboardText: { color: colors.white, fontFamily: fonts.extraBold, fontSize: 13 },
  filterBar: { marginTop: 17, flexDirection: "row", alignItems: "center", gap: 9 }, filterButton: { flex: 1, minHeight: 48, paddingHorizontal: 13, borderRadius: 15, borderWidth: 1.5, borderColor: colors.lineStrong, backgroundColor: colors.white, flexDirection: "row", alignItems: "center", gap: 7 }, filterSummary: { flex: 1, color: colors.ink, fontFamily: fonts.bold, fontSize: 13 }, resultCount: { color: colors.muted, fontFamily: fonts.semibold, fontSize: 12 }, filterChip: { minHeight: 46, borderRadius: radii.pill, paddingHorizontal: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.lineStrong }, filterSmall: { minHeight: 40, paddingHorizontal: 13 }, filterSelected: { backgroundColor: colors.green, borderColor: colors.green }, filterText: { color: colors.ink, fontFamily: fonts.bold, fontSize: 13 }, filterTextSelected: { color: colors.white },
  group: { marginTop: 17 }, groupTitle: { color: colors.muted, fontFamily: fonts.bold, fontSize: 15, marginBottom: 9 }, card: { backgroundColor: colors.white, borderRadius: radii.medium, overflow: "hidden", ...shadow },
  item: { minHeight: 102, padding: 12, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderBottomColor: colors.line }, itemLast: { borderBottomWidth: 0 }, thumb: { width: 70, height: 70, borderRadius: 16, backgroundColor: "#DDD" }, itemCopy: { flex: 1, minWidth: 0 }, itemTitleRow: { flexDirection: "row", alignItems: "center", gap: 5 }, itemTitle: { flexShrink: 1, color: colors.ink, fontFamily: fonts.extraBold, fontSize: 16 }, demoBadge: { color: colors.orangeDark, backgroundColor: colors.orangeSoft, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2, overflow: "hidden", fontFamily: fonts.extraBold, fontSize: 9 }, itemStatus: { fontFamily: fonts.semibold, fontSize: 14, marginTop: 6 }, itemMeta: { alignItems: "center", gap: 4 }, time: { color: colors.muted, fontFamily: fonts.semibold, fontSize: 12 },
  empty: { alignItems: "center", paddingVertical: 60, paddingHorizontal: 28 }, emptyTitle: { color: colors.ink, fontFamily: fonts.extraBold, fontSize: 20, marginTop: 15 }, emptyCopy: { color: colors.muted, fontFamily: fonts.medium, fontSize: 15, lineHeight: 22, textAlign: "center", marginTop: 7 },
  modalShade: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(7,20,12,0.48)" }, modalCard: { borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 20, paddingTop: 11, paddingBottom: 38, backgroundColor: colors.paper }, modalHandle: { width: 44, height: 5, borderRadius: 3, alignSelf: "center", marginBottom: 14, backgroundColor: "#C4CEC7" }, modalHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12 }, modalOverline: { color: colors.green, fontFamily: fonts.bold, fontSize: 9, letterSpacing: 1.4 }, modalTitle: { color: colors.ink, fontFamily: fonts.black, fontSize: 24, marginTop: 3 }, modalCopy: { color: colors.muted, fontFamily: fonts.regular, fontSize: 11, lineHeight: 17, marginTop: 7 },
  openButton: { height: 56, marginTop: 14, borderRadius: radii.pill, backgroundColor: colors.green, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }, openButtonText: { color: colors.white, fontFamily: fonts.extraBold, fontSize: 15 }, assignLabel: { color: colors.greenDark, fontFamily: fonts.extraBold, fontSize: 11, letterSpacing: 1.2, marginTop: 18, marginBottom: 8 }, assignList: { gap: 7, paddingRight: 20 }, assignChip: { minHeight: 46, borderRadius: radii.pill, borderWidth: 1.5, borderColor: colors.lineStrong, backgroundColor: colors.white, paddingHorizontal: 14, alignItems: "center", justifyContent: "center" }, assignChipSelected: { backgroundColor: colors.greenSoft, borderColor: colors.green }, assignText: { color: colors.ink, fontFamily: fonts.bold, fontSize: 13 }, assignTextSelected: { color: colors.greenDark },
  deleteButton: { height: 50, marginTop: 17, borderRadius: radii.pill, borderWidth: 1, borderColor: "#F0CBC6", backgroundColor: colors.white, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }, deleteText: { color: colors.red, fontFamily: fonts.bold, fontSize: 12 },
  filterShade: { flex: 1, justifyContent: "center", padding: 14, backgroundColor: "rgba(8,25,14,0.58)" }, filterCard: { maxHeight: "94%", borderRadius: 25, padding: 17, backgroundColor: colors.paper }, filterTitle: { color: colors.ink, fontFamily: fonts.extraBold, fontSize: 21, marginTop: 2 }, filterLabel: { color: colors.green, fontFamily: fonts.bold, fontSize: 8, letterSpacing: 1.2, marginTop: 14, marginBottom: 7 }, periodChoices: { flexDirection: "row", gap: 6 }, dayPartRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 }, searchBox: { height: 42, borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, paddingHorizontal: 11, marginBottom: 7, flexDirection: "row", alignItems: "center", gap: 7 }, searchInput: { flex: 1, color: colors.ink, fontFamily: fonts.medium, fontSize: 10 }, choiceList: { gap: 6, paddingRight: 10 }, choice: { maxWidth: 180, height: 37, borderRadius: 19, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, paddingHorizontal: 12, alignItems: "center", justifyContent: "center" }, choiceSelected: { backgroundColor: colors.green, borderColor: colors.green }, choiceText: { color: colors.ink, fontFamily: fonts.semibold, fontSize: 9 }, choiceTextSelected: { color: colors.white }, levelRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 }, levelChoice: { width: "48.5%", height: 37, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, paddingHorizontal: 9, flexDirection: "row", alignItems: "center", gap: 6 }, levelDot: { width: 9, height: 9, borderRadius: 5 }, levelText: { color: colors.ink, fontFamily: fonts.semibold, fontSize: 9 }, clearButton: { height: 42, marginTop: 15, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.green, backgroundColor: colors.white, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 }, clearText: { color: colors.green, fontFamily: fonts.bold, fontSize: 11 }, applyButton: { height: 48, marginTop: 9, borderRadius: radii.pill, backgroundColor: colors.green, alignItems: "center", justifyContent: "center" }, applyText: { color: colors.white, fontFamily: fonts.bold, fontSize: 12 },
});
