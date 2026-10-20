import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useMemo, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { confirmedCount, recordPlot } from "../analytics";
import type { InspectionRecord, Plot } from "../types";
import { colors, fonts, radii, shadow } from "../theme";

type Props = {
  records: InspectionRecord[];
  plots: Plot[];
  onDashboard: () => void;
  onSelect: (record: InspectionRecord) => void;
};

function dayGroup(value: string) {
  const date = new Date(value); const today = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  if (start === startToday) return "Hoje";
  if (start === startToday - 86400000) return "Ontem";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });
}

export function HistoryScreen({ records, plots, onDashboard, onSelect }: Props) {
  const [plotFilter, setPlotFilter] = useState<string>("all");
  const [days, setDays] = useState(14);
  const filtered = useMemo(() => {
    const cutoff = Date.now() - days * 86400000;
    return records
      .filter((record) => new Date(record.capturedAt).getTime() >= cutoff)
      .filter((record) => plotFilter === "all" || recordPlot(record, plots)?.id === plotFilter)
      .sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime());
  }, [days, plotFilter, plots, records]);
  const groups = useMemo(() => {
    const result = new Map<string, InspectionRecord[]>();
    filtered.forEach((record) => {
      const key = dayGroup(record.capturedAt);
      result.set(key, [...(result.get(key) || []), record]);
    });
    return [...result.entries()];
  }, [filtered]);

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}><View><Text style={styles.overline}>DADOS DO CAMPO</Text><Text style={styles.title}>Histórico</Text></View><Pressable onPress={onDashboard} style={styles.dashboardButton}><MaterialCommunityIcons name="chart-donut" size={20} color={colors.white} /><Text style={styles.dashboardText}>Dashboard</Text></Pressable></View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          <FilterChip selected={plotFilter === "all"} label="Todos" onPress={() => setPlotFilter("all")} />
          {plots.map((plot) => <FilterChip key={plot.id} selected={plotFilter === plot.id} label={plot.name} onPress={() => setPlotFilter(plot.id)} />)}
        </ScrollView>
        <View style={styles.periodRow}><Text style={styles.periodLabel}>Período</Text>{[7, 14, 30].map((value) => <FilterChip key={value} small selected={days === value} label={`${value} dias`} onPress={() => setDays(value)} />)}</View>

        {groups.length ? groups.map(([label, items]) => <View key={label} style={styles.group}><Text style={styles.groupTitle}>{label}</Text><View style={styles.card}>{items.map((record, index) => {
          const count = confirmedCount(record); const plot = recordPlot(record, plots);
          return <Pressable key={record.id} onPress={() => onSelect(record)} style={[styles.item, index === items.length - 1 && styles.itemLast]}>
            <Image source={{ uri: record.imageUri }} style={styles.thumb} />
            <View style={styles.itemCopy}><Text numberOfLines={1} style={styles.itemTitle}>{plot?.name || "Sem talhão"}</Text><Text style={[styles.itemStatus, { color: count ? colors.orange : colors.green }]}>{count ? `${count} ácaro(s) detectado(s)` : "Sem sinal confirmado"}</Text></View>
            <View style={styles.itemMeta}><MaterialCommunityIcons name={record.mapVisible ? "map-marker-check" : "map-marker-off-outline"} size={21} color={record.mapVisible ? colors.green : "#9BA09C"} /><Text style={styles.time}>{new Date(record.capturedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</Text><MaterialCommunityIcons name="chevron-right" size={21} color="#9BA09C" /></View>
          </Pressable>;
        })}</View></View>) : <View style={styles.empty}><MaterialCommunityIcons name="camera-off-outline" size={46} color="#9DA59F" /><Text style={styles.emptyTitle}>Nenhuma vistoria neste período</Text><Text style={styles.emptyCopy}>Use a câmera para registrar uma laranja, mesmo quando não houver praga.</Text></View>}
      </ScrollView>
    </View>
  );
}

function FilterChip({ selected, label, onPress, small = false }: { selected: boolean; label: string; onPress: () => void; small?: boolean }) {
  return <Pressable onPress={onPress} style={[styles.filterChip, small && styles.filterSmall, selected && styles.filterSelected]}><Text style={[styles.filterText, selected && styles.filterTextSelected]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.paper }, content: { paddingTop: 55, paddingHorizontal: 20, paddingBottom: 116 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, overline: { color: colors.green, fontFamily: fonts.bold, fontSize: 9, letterSpacing: 1.5 }, title: { color: colors.ink, fontFamily: fonts.black, fontSize: 35, letterSpacing: -1.5, marginTop: 3 },
  dashboardButton: { height: 43, borderRadius: radii.pill, paddingHorizontal: 14, backgroundColor: colors.orange, flexDirection: "row", alignItems: "center", gap: 6 }, dashboardText: { color: colors.white, fontFamily: fonts.bold, fontSize: 11 },
  filters: { gap: 8, paddingVertical: 19 }, filterChip: { height: 44, borderRadius: radii.pill, paddingHorizontal: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.white, borderWidth: 1, borderColor: "#EFEEE9" }, filterSmall: { height: 36, paddingHorizontal: 14 }, filterSelected: { backgroundColor: colors.green, borderColor: colors.green }, filterText: { color: colors.ink, fontFamily: fonts.semibold, fontSize: 12 }, filterTextSelected: { color: colors.white },
  periodRow: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 9 }, periodLabel: { color: colors.muted, fontFamily: fonts.semibold, fontSize: 11, marginRight: 2 },
  group: { marginTop: 17 }, groupTitle: { color: colors.muted, fontFamily: fonts.bold, fontSize: 15, marginBottom: 9 }, card: { backgroundColor: colors.white, borderRadius: radii.medium, overflow: "hidden", ...shadow },
  item: { minHeight: 92, padding: 11, flexDirection: "row", alignItems: "center", gap: 11, borderBottomWidth: 1, borderBottomColor: colors.line }, itemLast: { borderBottomWidth: 0 }, thumb: { width: 64, height: 64, borderRadius: 15, backgroundColor: "#DDD" }, itemCopy: { flex: 1, minWidth: 0 }, itemTitle: { color: colors.ink, fontFamily: fonts.bold, fontSize: 13 }, itemStatus: { fontFamily: fonts.medium, fontSize: 11, marginTop: 6 }, itemMeta: { flexDirection: "row", alignItems: "center", gap: 5 }, time: { color: colors.muted, fontFamily: fonts.medium, fontSize: 11 },
  empty: { alignItems: "center", paddingVertical: 60, paddingHorizontal: 28 }, emptyTitle: { color: colors.ink, fontFamily: fonts.bold, fontSize: 17, marginTop: 15 }, emptyCopy: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, textAlign: "center", marginTop: 7 },
});
