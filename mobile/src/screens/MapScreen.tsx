import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import MapView, { Marker, Polygon, Polyline, type MapPressEvent, type Region } from "react-native-maps";
import { confirmedCount, recordPlot, severity } from "../analytics";
import { drawnPolygon, geometryRings, parsePlotGeoJson } from "../geo";
import type { Coordinates, InspectionRecord, Plot } from "../types";
import { colors, fonts, radii, shadow } from "../theme";

const FALLBACK_REGION: Region = { latitude: -22.5641, longitude: -47.4012, latitudeDelta: 0.035, longitudeDelta: 0.035 };

type Props = {
  records: InspectionRecord[];
  plots: Plot[];
  onPlotsChange: (plots: Plot[]) => Promise<void>;
  startDrawing?: boolean;
  draftLocation?: Coordinates | null;
  onPlotCreated?: (plot: Plot) => Promise<void>;
};

function withAlpha(color: string, alpha: string) { return `${color}${alpha}`; }

export function MapScreen({ records, plots, onPlotsChange, startDrawing = false, draftLocation = null, onPlotCreated }: Props) {
  const mapRef = useRef<MapView>(null);
  const [drawing, setDrawing] = useState(false);
  const [points, setPoints] = useState<{ latitude: number; longitude: number }[]>([]);
  const [plotName, setPlotName] = useState(`Talhão ${plots.length + 1}`);
  const [help, setHelp] = useState(false);
  const [importing, setImporting] = useState(false);
  const mapped = useMemo(() => records.filter((record) => record.mapVisible && record.location), [records]);
  const counts = useMemo(() => Object.fromEntries(plots.map((plot) => [plot.id, mapped
    .filter((record) => recordPlot(record, plots)?.id === plot.id)
    .reduce((sum, record) => sum + confirmedCount(record), 0)])), [mapped, plots]);
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);

  const initialRegion = useMemo(() => {
    const firstRecord = mapped[0]?.location;
    if (firstRecord) return { latitude: firstRecord.latitude, longitude: firstRecord.longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 };
    const firstPoint = plots[0] ? geometryRings(plots[0].geometry)[0]?.[0] : null;
    return firstPoint ? { ...firstPoint, latitudeDelta: 0.025, longitudeDelta: 0.025 } : FALLBACK_REGION;
  }, [mapped, plots]);

  useEffect(() => {
    if (!startDrawing) return;
    setDrawing(true);
    setPoints([]);
    setPlotName(`Talhão ${plots.length + 1}`);
    if (draftLocation) {
      mapRef.current?.animateToRegion({ latitude: draftLocation.latitude, longitude: draftLocation.longitude, latitudeDelta: 0.012, longitudeDelta: 0.012 }, 500);
    }
  }, [draftLocation, plots.length, startDrawing]);

  function onMapPress(event: MapPressEvent) {
    if (!drawing) return;
    setPoints((current) => [...current, event.nativeEvent.coordinate]);
  }

  async function saveDrawing() {
    try {
      const plot: Plot = {
        id: globalThis.crypto?.randomUUID?.() || `plot-${Date.now()}`,
        name: plotName.trim() || `Talhão ${plots.length + 1}`,
        geometry: drawnPolygon(points),
        createdAt: new Date().toISOString(),
        source: "drawn",
      };
      if (onPlotCreated) await onPlotCreated(plot);
      else await onPlotsChange([...plots, plot]);
      setPoints([]); setDrawing(false); setPlotName(`Talhão ${plots.length + 2}`);
    } catch (error) {
      Alert.alert("Limite incompleto", error instanceof Error ? error.message : "Revise os pontos marcados.");
    }
  }

  async function importGeoJson() {
    setImporting(true);
    try {
      const picked = await DocumentPicker.getDocumentAsync({ type: ["application/geo+json", "application/json", "text/plain"], copyToCacheDirectory: true });
      const asset = picked.canceled ? null : picked.assets[0];
      if (!asset) return;
      const text = await FileSystem.readAsStringAsync(asset.uri);
      const parsed = parsePlotGeoJson(JSON.parse(text));
      await onPlotsChange([...plots, ...parsed.plots]);
      const first = parsed.plots[0] ? geometryRings(parsed.plots[0].geometry)[0]?.[0] : null;
      if (first) mapRef.current?.animateToRegion({ ...first, latitudeDelta: 0.025, longitudeDelta: 0.025 }, 500);
      Alert.alert("Limites importados", `${parsed.plots.length} talhão(ões) adicionado(s)${parsed.ignored ? `; ${parsed.ignored} feição(ões) ignorada(s)` : ""}.`);
    } catch (error) {
      Alert.alert("GeoJSON não importado", error instanceof Error ? error.message : "Arquivo inválido.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <View style={styles.page}>
      <MapView ref={mapRef} style={StyleSheet.absoluteFill} initialRegion={initialRegion} mapType="satellite" showsUserLocation showsMyLocationButton onPress={onMapPress}>
        {plots.flatMap((plot) => geometryRings(plot.geometry).map((ring, index) => {
          const level = severity(counts[plot.id] || 0);
          return <Polygon key={`${plot.id}-${index}`} coordinates={ring} strokeColor={level.color} fillColor={withAlpha(level.color, "82")} strokeWidth={3} tappable />;
        }))}
        {mapped.map((record) => {
          const count = confirmedCount(record);
          return <Marker key={record.id} coordinate={record.location!} pinColor={severity(count).color} title={count ? `${count} praga(s)` : "Sem ocorrência"} description={new Date(record.capturedAt).toLocaleString("pt-BR")} />;
        })}
        {points.length > 0 && <><Polyline coordinates={points} strokeColor={colors.orange} strokeWidth={4} />{points.map((point, index) => <Marker key={`${point.latitude}-${index}`} coordinate={point}><View style={styles.drawPoint}><Text style={styles.drawPointText}>{index + 1}</Text></View></Marker>)}</>}
      </MapView>

      <View style={styles.topBar}><View><Text style={styles.brand}>CYF</Text><Text style={styles.brandSmall}>VISÃO DO CAMPO</Text></View><View style={styles.totalPill}><Text style={styles.totalNumber}>{total}</Text><Text style={styles.totalLabel}>pragas</Text></View></View>

      <View style={styles.panel}>
        <View style={styles.handle} />
        <View style={styles.panelHead}><View><Text style={styles.overline}>MAPA OPERACIONAL</Text><Text style={styles.title}>Talhões da propriedade</Text></View><Pressable onPress={() => setHelp(true)} accessibilityLabel="Como usar o mapa"><MaterialCommunityIcons name="help-circle-outline" size={28} color={colors.green} /></Pressable></View>
        <View style={styles.legend}><Legend color={colors.green} text="0" /><Legend color={colors.yellow} text="1–20" /><Legend color={colors.red} text=">20" /></View>
        {drawing ? <>
          <Text style={styles.hint}>Toque no mapa, seguindo os cantos do talhão. Use ao menos 3 pontos e depois conclua.</Text>
          <TextInput value={plotName} onChangeText={setPlotName} style={styles.nameInput} placeholder="Nome do talhão" />
          <View style={styles.row}><Pressable onPress={() => setPoints((value) => value.slice(0, -1))} disabled={!points.length} style={styles.secondary}><Text style={styles.secondaryText}>Desfazer</Text></Pressable><Pressable onPress={saveDrawing} style={styles.primary}><Text style={styles.primaryText}>Concluir ({points.length})</Text></Pressable></View>
          <Pressable onPress={() => { setDrawing(false); setPoints([]); }} style={styles.cancel}><Text style={styles.cancelText}>Cancelar desenho</Text></Pressable>
        </> : <View style={styles.row}><Pressable onPress={() => setDrawing(true)} style={styles.primary}><MaterialCommunityIcons name="vector-polygon" size={20} color={colors.white} /><Text style={styles.primaryText}>Desenhar</Text></Pressable><Pressable onPress={importGeoJson} disabled={importing} style={styles.secondary}><MaterialCommunityIcons name="file-import-outline" size={20} color={colors.green} /><Text style={styles.secondaryText}>{importing ? "Importando…" : "GeoJSON"}</Text></Pressable></View>}
      </View>

      <Modal visible={help} animationType="fade" transparent onRequestClose={() => setHelp(false)}>
        <View style={styles.modalShade}><View style={styles.modalCard}><View style={styles.modalHead}><Text style={styles.modalTitle}>Como adicionar limites</Text><Pressable onPress={() => setHelp(false)}><MaterialCommunityIcons name="close" size={27} color={colors.ink} /></Pressable></View>
          <HelpStep number="1" title="Desenhar no satélite" copy="Toque em Desenhar e marque os cantos do talhão seguindo a borda visível." />
          <HelpStep number="2" title="Ou importar GeoJSON" copy="Use WGS84/EPSG:4326, Polygon ou MultiPolygon, com coordenadas [longitude, latitude]." />
          <HelpStep number="3" title="Associar as fotos" copy="Ao salvar uma vistoria no mapa, GPS ou EXIF define em qual polígono o ponto está." />
          <View style={styles.helpNote}><Text style={styles.helpNoteText}>Verde: zero registro. Amarelo: 1 a 20. Vermelho: mais de 20. A imagem de satélite requer internet ou cache prévio; a análise e os registros funcionam offline.</Text></View>
          <Pressable onPress={() => setHelp(false)} style={styles.primaryFull}><Text style={styles.primaryText}>Entendi</Text></Pressable>
        </View></View>
      </Modal>
    </View>
  );
}

function Legend({ color, text }: { color: string; text: string }) { return <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: color }]} /><Text style={styles.legendText}>{text}</Text></View>; }
function HelpStep({ number, title, copy }: { number: string; title: string; copy: string }) { return <View style={styles.helpStep}><View style={styles.helpNumber}><Text style={styles.helpNumberText}>{number}</Text></View><View style={{ flex: 1 }}><Text style={styles.helpTitle}>{title}</Text><Text style={styles.helpCopy}>{copy}</Text></View></View>; }

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#D8D6CB" },
  topBar: { position: "absolute", top: 48, left: 14, right: 14, height: 65, paddingHorizontal: 17, borderRadius: 20, backgroundColor: "rgba(15,46,28,0.93)", flexDirection: "row", alignItems: "center", justifyContent: "space-between", ...shadow },
  brand: { color: colors.white, fontFamily: fonts.black, fontSize: 21 }, brandSmall: { color: "#D7E9DD", fontFamily: fonts.bold, fontSize: 8, letterSpacing: 1.2 },
  totalPill: { minWidth: 62, height: 43, borderRadius: 14, backgroundColor: colors.white, alignItems: "center", justifyContent: "center" },
  totalNumber: { color: colors.green, fontFamily: fonts.extraBold, fontSize: 17 }, totalLabel: { color: colors.muted, fontFamily: fonts.medium, fontSize: 8 },
  panel: { position: "absolute", left: 9, right: 9, bottom: 93, borderRadius: 27, padding: 18, paddingTop: 12, backgroundColor: "rgba(252,251,247,0.97)", ...shadow },
  handle: { width: 43, height: 5, borderRadius: 3, backgroundColor: "#C4CEC7", alignSelf: "center", marginBottom: 11 },
  panelHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  overline: { color: colors.green, fontFamily: fonts.bold, fontSize: 9, letterSpacing: 1.4 },
  title: { color: colors.ink, fontFamily: fonts.extraBold, fontSize: 20, marginTop: 3 },
  legend: { flexDirection: "row", gap: 16, marginTop: 13, marginBottom: 13 }, legendItem: { flexDirection: "row", alignItems: "center", gap: 5 }, legendDot: { width: 10, height: 10, borderRadius: 4 }, legendText: { color: colors.muted, fontFamily: fonts.medium, fontSize: 10 },
  row: { flexDirection: "row", gap: 9 },
  primary: { flex: 1, height: 51, borderRadius: radii.small, backgroundColor: colors.green, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  primaryFull: { height: 53, borderRadius: radii.pill, backgroundColor: colors.green, alignItems: "center", justifyContent: "center", marginTop: 18 },
  primaryText: { color: colors.white, fontFamily: fonts.bold, fontSize: 12 },
  secondary: { flex: 1, height: 51, borderRadius: radii.small, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  secondaryText: { color: colors.green, fontFamily: fonts.bold, fontSize: 12 },
  cancel: { alignItems: "center", paddingTop: 10 }, cancelText: { color: colors.red, fontFamily: fonts.semibold, fontSize: 11 },
  hint: { color: colors.muted, fontFamily: fonts.regular, fontSize: 10, lineHeight: 15, marginBottom: 8 },
  nameInput: { height: 45, borderWidth: 1, borderColor: colors.line, borderRadius: 13, paddingHorizontal: 13, fontFamily: fonts.medium, marginBottom: 9, color: colors.ink, backgroundColor: colors.white },
  drawPoint: { width: 27, height: 27, borderRadius: 14, backgroundColor: colors.orange, borderWidth: 2, borderColor: colors.white, alignItems: "center", justifyContent: "center" }, drawPointText: { color: colors.white, fontFamily: fonts.bold, fontSize: 10 },
  modalShade: { flex: 1, justifyContent: "center", padding: 18, backgroundColor: "rgba(8,25,14,0.72)" },
  modalCard: { borderRadius: 28, padding: 20, backgroundColor: colors.paper }, modalHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 15 }, modalTitle: { color: colors.ink, fontFamily: fonts.extraBold, fontSize: 23 },
  helpStep: { flexDirection: "row", gap: 12, marginTop: 13 }, helpNumber: { width: 31, height: 31, borderRadius: 10, backgroundColor: colors.green, alignItems: "center", justifyContent: "center" }, helpNumberText: { color: colors.white, fontFamily: fonts.bold }, helpTitle: { color: colors.ink, fontFamily: fonts.bold, fontSize: 13 }, helpCopy: { color: colors.muted, fontFamily: fonts.regular, fontSize: 11, lineHeight: 17, marginTop: 2 },
  helpNote: { backgroundColor: colors.greenSoft, borderRadius: 15, padding: 13, marginTop: 17 }, helpNoteText: { color: colors.greenDark, fontFamily: fonts.regular, fontSize: 10, lineHeight: 16 },
});
