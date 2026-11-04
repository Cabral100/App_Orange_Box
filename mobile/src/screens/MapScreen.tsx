import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import MapView, { Circle, Marker, Polygon, Polyline, type MapPressEvent, type Region } from "react-native-maps";
import { confirmedCount, recordPlot, severity } from "../analytics";
import { drawnPolygon, findPlot, geometryAreaSquareMeters, geometryRings, parsePlotGeoJson } from "../geo";
import type { Coordinates, InspectionRecord, Plot } from "../types";
import { colors, fonts, radii, shadow } from "../theme";

const FALLBACK_REGION: Region = { latitude: -22.5641, longitude: -47.4012, latitudeDelta: 0.035, longitudeDelta: 0.035 };
type LevelFilter = "all" | "green" | "yellow" | "red";

type Props = {
  records: InspectionRecord[];
  plots: Plot[];
  onPlotsChange: (plots: Plot[]) => Promise<void>;
  onPlotUpdate: (plot: Plot) => Promise<void>;
  onPlotDelete: (plotId: string) => Promise<void>;
  startDrawing?: boolean;
  draftLocation?: Coordinates | null;
  onPlotCreated?: (plot: Plot) => Promise<void>;
  pendingRecord?: InspectionRecord | null;
  onUseExistingPlot?: () => Promise<void>;
  onCreatePlotByArea?: (areaSquareMeters: number, name: string) => Promise<void>;
  onDrawPendingPlot?: () => Promise<void>;
  onDismissPending?: () => void;
};

function withAlpha(color: string, alpha: string) { return `${color}${alpha}`; }
function validLocation(location: Coordinates | null | undefined) {
  return Boolean(location && Number.isFinite(location.latitude) && Number.isFinite(location.longitude) && Math.abs(location.latitude) <= 90 && Math.abs(location.longitude) <= 180);
}

function plotCenter(plot: Plot) {
  const points = geometryRings(plot.geometry).flat();
  const usable = points.length > 1 ? points.slice(0, -1) : points;
  const total = usable.reduce((sum, point) => ({ latitude: sum.latitude + point.latitude, longitude: sum.longitude + point.longitude }), { latitude: 0, longitude: 0 });
  return { latitude: total.latitude / Math.max(1, usable.length), longitude: total.longitude / Math.max(1, usable.length) };
}

function activePestCount(plot: Plot, plotRecords: InspectionRecord[]) {
  const sprayedAt = plot.lastSprayedAt ? new Date(plot.lastSprayedAt).getTime() : 0;
  return plotRecords
    .filter((record) => new Date(record.capturedAt).getTime() > sprayedAt)
    .reduce((sum, record) => sum + confirmedCount(record), 0);
}

export function MapScreen({ records, plots, onPlotsChange, onPlotUpdate, onPlotDelete, startDrawing = false, draftLocation = null, onPlotCreated, pendingRecord = null, onUseExistingPlot, onCreatePlotByArea, onDrawPendingPlot, onDismissPending }: Props) {
  const mapRef = useRef<MapView>(null);
  const [drawing, setDrawing] = useState(false);
  const [points, setPoints] = useState<{ latitude: number; longitude: number }[]>([]);
  const [plotName, setPlotName] = useState(`Talhão ${plots.length + 1}`);
  const [help, setHelp] = useState(false);
  const [importing, setImporting] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapType, setMapType] = useState<"standard" | "satellite">("satellite");
  const [areaHectares, setAreaHectares] = useState("1");
  const [pendingPlotName, setPendingPlotName] = useState(`Talhão ${plots.length + 1}`);
  const [savingArea, setSavingArea] = useState(false);
  const [selectedPlot, setSelectedPlot] = useState<Plot | null>(null);
  const [selectedPlotName, setSelectedPlotName] = useState("");
  const [editingPlotId, setEditingPlotId] = useState<string | null>(null);
  const [savingPlot, setSavingPlot] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [plotFilter, setPlotFilter] = useState("all");
  const [levelFilter, setLevelFilter] = useState<LevelFilter>("all");
  const [plotSearch, setPlotSearch] = useState("");

  const mapped = useMemo(() => records.filter((record) => record.mapVisible && validLocation(record.location)), [records]);
  const counts = useMemo<Record<string, number>>(() => Object.fromEntries(plots.map((plot) => {
    const plotRecords = mapped.filter((record) => recordPlot(record, plots)?.id === plot.id);
    return [plot.id, activePestCount(plot, plotRecords)];
  })), [mapped, plots]);
  const visiblePlots = useMemo(() => plots.filter((plot) => {
    if (plotFilter !== "all" && plot.id !== plotFilter) return false;
    if (levelFilter === "all") return true;
    const count = counts[plot.id] || 0;
    return levelFilter === "green" ? count === 0 : levelFilter === "yellow" ? count > 0 && count <= 20 : count > 20;
  }), [counts, levelFilter, plotFilter, plots]);
  const visibleTotal = visiblePlots.reduce((sum, plot) => sum + (counts[plot.id] || 0), 0);
  const activeFilterCount = Number(plotFilter !== "all") + Number(levelFilter !== "all");
  const pendingExistingPlot = useMemo(() => findPlot(plots, pendingRecord?.location || null), [pendingRecord, plots]);
  const selectedSummary = useMemo(() => {
    if (!selectedPlot) return null;
    const inspections = mapped.filter((record) => recordPlot(record, plots)?.id === selectedPlot.id);
    const historicalPests = inspections.reduce((sum, record) => sum + confirmedCount(record), 0);
    const pests = activePestCount(selectedPlot, inspections);
    return { area: geometryAreaSquareMeters(selectedPlot.geometry) / 10_000, inspections: inspections.length, pests, historicalPests, state: severity(pests) };
  }, [mapped, plots, selectedPlot]);
  const searchedPlots = useMemo(() => plots.filter((plot) => plot.name.toLocaleLowerCase("pt-BR").includes(plotSearch.trim().toLocaleLowerCase("pt-BR"))), [plotSearch, plots]);

  const initialRegion = useMemo(() => {
    if (validLocation(pendingRecord?.location)) return { latitude: pendingRecord!.location!.latitude, longitude: pendingRecord!.location!.longitude, latitudeDelta: 0.012, longitudeDelta: 0.012 };
    const plotPoints = plots.flatMap((plot) => geometryRings(plot.geometry).flat());
    if (plotPoints.length) {
      const latitudes = plotPoints.map((point) => point.latitude);
      const longitudes = plotPoints.map((point) => point.longitude);
      const north = Math.max(...latitudes); const south = Math.min(...latitudes);
      const east = Math.max(...longitudes); const west = Math.min(...longitudes);
      return { latitude: (north + south) / 2, longitude: (east + west) / 2, latitudeDelta: Math.max(0.012, (north - south) * 1.45), longitudeDelta: Math.max(0.012, (east - west) * 1.35) };
    }
    const firstRecord = mapped[0]?.location;
    return validLocation(firstRecord) ? { latitude: firstRecord!.latitude, longitude: firstRecord!.longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 } : FALLBACK_REGION;
  }, [mapped, pendingRecord, plots]);

  useEffect(() => {
    if (!startDrawing) return;
    setMapType("standard");
    setDrawing(true);
    setPoints([]);
    setEditingPlotId(null);
    setPlotName(`Talhão ${plots.length + 1}`);
    if (validLocation(draftLocation)) {
      mapRef.current?.animateToRegion({ latitude: draftLocation!.latitude, longitude: draftLocation!.longitude, latitudeDelta: 0.012, longitudeDelta: 0.012 }, 500);
    }
  }, [draftLocation, plots.length, startDrawing]);

  useEffect(() => {
    const location = pendingRecord?.location || draftLocation;
    if (!mapReady || !validLocation(location)) return;
    mapRef.current?.animateToRegion({ latitude: location!.latitude, longitude: location!.longitude, latitudeDelta: 0.008, longitudeDelta: 0.008 }, 650);
  }, [draftLocation, mapReady, pendingRecord]);

  useEffect(() => {
    if (!pendingRecord) return;
    setAreaHectares("1");
    setPendingPlotName(`Talhão ${plots.length + 1}`);
  }, [pendingRecord?.id, plots.length]);

  async function createPendingPlotByArea() {
    const hectares = Number(areaHectares.replace(",", "."));
    if (!Number.isFinite(hectares) || hectares < 0.0025 || hectares > 10_000) {
      Alert.alert("Área inválida", "Informe uma área entre 0,0025 e 10.000 hectares.");
      return;
    }
    if (!onCreatePlotByArea) return;
    setSavingArea(true);
    try {
      await onCreatePlotByArea(hectares * 10_000, pendingPlotName.trim() || `Talhão ${plots.length + 1}`);
    } catch (error) {
      Alert.alert("Não foi possível marcar", error instanceof Error ? error.message : "Revise a área informada.");
    } finally {
      setSavingArea(false);
    }
  }

  function onMapPress(event: MapPressEvent) {
    if (!drawing) return;
    setPoints((current) => [...current, event.nativeEvent.coordinate]);
  }

  function openPlot(plot: Plot) {
    if (drawing) return;
    setSelectedPlot(plot);
    setSelectedPlotName(plot.name);
  }

  function focusPlot(plot: Plot) {
    setPlotFilter(plot.id);
    setLevelFilter("all");
    const coordinates = geometryRings(plot.geometry).flat();
    if (coordinates.length) {
      requestAnimationFrame(() => mapRef.current?.fitToCoordinates(coordinates, { edgePadding: { top: 125, right: 45, bottom: 325, left: 45 }, animated: true }));
    }
  }

  function fitAllPlots() {
    const coordinates = plots.flatMap((plot) => geometryRings(plot.geometry).flat());
    if (coordinates.length) requestAnimationFrame(() => mapRef.current?.fitToCoordinates(coordinates, { edgePadding: { top: 170, right: 55, bottom: 325, left: 45 }, animated: true }));
    else mapRef.current?.animateToRegion(FALLBACK_REGION, 500);
  }

  function clearFilters() {
    setPlotFilter("all");
    setLevelFilter("all");
    setPlotSearch("");
    fitAllPlots();
  }

  async function renameSelectedPlot() {
    if (!selectedPlot) return;
    const name = selectedPlotName.trim();
    if (!name) return Alert.alert("Nome necessário", "Informe um nome para o talhão.");
    setSavingPlot(true);
    try {
      await onPlotUpdate({ ...selectedPlot, name });
      setSelectedPlot(null);
    } finally {
      setSavingPlot(false);
    }
  }

  function redrawSelectedPlot() {
    if (!selectedPlot) return;
    setMapType("standard");
    setEditingPlotId(selectedPlot.id);
    setPlotName(selectedPlotName.trim() || selectedPlot.name);
    setPoints([]);
    setSelectedPlot(null);
    setDrawing(true);
  }

  function deleteSelectedPlot() {
    if (!selectedPlot) return;
    const target = selectedPlot;
    Alert.alert("Excluir talhão?", `O limite de ${target.name} será removido. As inspeções continuarão no histórico como não associadas.`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Excluir", style: "destructive", onPress: async () => { await onPlotDelete(target.id); setSelectedPlot(null); } },
    ]);
  }

  async function markSprayed(message: string) {
    if (!selectedPlot) return;
    const updated = { ...selectedPlot, sprayStatus: "completed" as const, sprayScheduledAt: undefined, lastSprayedAt: new Date().toISOString() };
    await onPlotUpdate(updated);
    setSelectedPlot(null);
    Alert.alert("Pulverização registrada", message);
  }

  function performSpraying() {
    if (!selectedPlot) return;
    Alert.alert("Realizar pulverização?", `Confirme a pulverização de ${selectedPlot.name}. A contagem operacional voltará a zero até uma nova detecção.`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Confirmar", onPress: () => { markSprayed("O talhão agora aparece em verde. Novas inspeções voltarão a atualizar sua cor.").catch(() => Alert.alert("Não foi possível salvar", "Tente novamente.")); } },
    ]);
  }

  async function saveDrawing() {
    try {
      const drawingCoordinates = [...points];
      const currentPlot = editingPlotId ? plots.find((plot) => plot.id === editingPlotId) : null;
      const plot: Plot = {
        id: currentPlot?.id || globalThis.crypto?.randomUUID?.() || `plot-${Date.now()}`,
        name: plotName.trim() || `Talhão ${plots.length + 1}`,
        geometry: drawnPolygon(points),
        createdAt: currentPlot?.createdAt || new Date().toISOString(),
        source: "drawn",
      };
      if (currentPlot) await onPlotUpdate(plot);
      else if (onPlotCreated) await onPlotCreated(plot);
      else await onPlotsChange([...plots, plot]);
      setPlotFilter("all");
      setLevelFilter("all");
      setPlotSearch("");
      setPoints([]);
      setDrawing(false);
      setEditingPlotId(null);
      setMapType("satellite");
      setPlotName(`Talhão ${plots.length + 2}`);
      requestAnimationFrame(() => mapRef.current?.fitToCoordinates(drawingCoordinates, {
        edgePadding: { top: 145, right: 48, bottom: 245, left: 48 },
        animated: true,
      }));
      Alert.alert(currentPlot ? "Limite atualizado" : "Talhão criado", currentPlot ? "O novo limite já está visível no mapa." : `${plot.name} foi salvo e já está visível no mapa.`);
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

  return <View style={styles.page}>
    <MapView ref={mapRef} style={StyleSheet.absoluteFill} initialRegion={initialRegion} mapType={mapType} loadingEnabled loadingBackgroundColor="#E8E7E1" loadingIndicatorColor={colors.green} showsUserLocation showsMyLocationButton showsCompass onMapReady={() => setMapReady(true)} onPress={onMapPress}>
      {visiblePlots.flatMap((plot) => geometryRings(plot.geometry).map((ring, index) => {
        const level = severity(counts[plot.id] || 0);
        return <Polygon key={`${plot.id}-${index}`} coordinates={ring} strokeColor="rgba(255,255,255,0.96)" fillColor={withAlpha(level.color, "96")} strokeWidth={2.5} tappable onPress={() => openPlot(plot)} />;
      }))}
      {visiblePlots.map((plot) => {
        const count = counts[plot.id] || 0;
        const level = severity(count);
        return <Marker key={`plot-count-${plot.id}`} coordinate={plotCenter(plot)} anchor={{ x: 0.5, y: 0.5 }} onPress={() => openPlot(plot)}>
          <View style={[styles.countBadge, { borderColor: level.color }]}><Text style={[styles.countBadgeNumber, { color: level.color }]}>{count} pragas</Text></View>
        </Marker>;
      })}
      {validLocation(pendingRecord?.location) ? <Marker coordinate={pendingRecord!.location!} pinColor={colors.orange} title="Foto recém-capturada" description="Confirme a área deste talhão" /> : null}
      {points.length > 0 ? <><Polyline coordinates={points} strokeColor={colors.orange} strokeWidth={4} />{points.map((point, index) => <Circle key={`${point.latitude}-${point.longitude}-${index}`} center={point} radius={4} fillColor={colors.orange} strokeColor={colors.white} strokeWidth={2} />)}</> : null}
    </MapView>

    {!mapReady ? <View style={styles.mapLoading} pointerEvents="none"><ActivityIndicator size="large" color={colors.green} /><Text style={styles.mapLoadingTitle}>Carregando o mapa…</Text><Text style={styles.mapLoadingCopy}>Os limites da demonstração aparecerão em instantes.</Text></View> : null}

    <View style={styles.topBar}><View><Text style={styles.brandSmall}>FAZENDA BOA ESPERANÇA</Text><Text style={styles.farmSub}>Visão operacional</Text></View><View style={styles.totalPill}><Text style={styles.totalLabel}>Total de pragas:</Text><Text style={styles.totalNumber}>{visibleTotal}</Text></View></View>

    {!drawing ? <><View style={styles.selectorRow}>
      <Pressable accessibilityLabel="Alternar camada do mapa" onPress={() => setMapType((value) => value === "standard" ? "satellite" : "standard")} style={styles.mapSelector}><MaterialCommunityIcons name="layers-outline" size={18} color={colors.green} /><View style={{ flex: 1 }}><Text style={styles.selectorLabel}>CAMADA</Text><Text numberOfLines={1} style={styles.selectorValue}>{mapType === "satellite" ? "Satélite" : "Mapa"}</Text></View><MaterialCommunityIcons name="chevron-down" size={18} color={colors.muted} /></Pressable>
    </View><View style={styles.toolRail}>
      <Pressable accessibilityLabel="Enquadrar todos os talhões" onPress={fitAllPlots} style={styles.toolButton}><MaterialCommunityIcons name="fit-to-page-outline" size={21} color={colors.green} /></Pressable>
      <Pressable accessibilityLabel="Filtrar mapa" onPress={() => setFiltersOpen(true)} style={[styles.toolButton, activeFilterCount > 0 && styles.toolButtonActive]}><MaterialCommunityIcons name="tune-variant" size={20} color={activeFilterCount > 0 ? colors.white : colors.green} /></Pressable>
      <Pressable accessibilityLabel="Informações do mapa" onPress={() => setHelp(true)} style={styles.toolButton}><MaterialCommunityIcons name="information-outline" size={21} color={colors.green} /></Pressable>
    </View></> : null}

    <View style={styles.panel}>
      <View style={styles.panelHead}><Text style={styles.title}>Talhões</Text><View style={styles.legend}><Legend color={colors.green} text="0" /><Legend color={colors.yellow} text="1–20" /><Legend color={colors.red} text=">20" /></View></View>
      {drawing ? <>
        <Text style={styles.hint}>{editingPlotId ? "Marque novamente os cantos do talhão selecionado." : "Toque no mapa seguindo os cantos do talhão."} Use ao menos 3 pontos e depois conclua.</Text>
        <TextInput value={plotName} onChangeText={setPlotName} style={styles.nameInput} placeholder="Nome do talhão" />
        <View style={styles.row}><Pressable onPress={() => setPoints((value) => value.slice(0, -1))} disabled={!points.length} style={styles.secondary}><Text style={styles.secondaryText}>Desfazer</Text></Pressable><Pressable onPress={saveDrawing} style={styles.primary}><Text style={styles.primaryText}>Concluir ({points.length})</Text></Pressable></View>
        <Pressable onPress={() => { setDrawing(false); setPoints([]); setEditingPlotId(null); setMapType("satellite"); }} style={styles.cancel}><Text style={styles.cancelText}>Cancelar desenho</Text></Pressable>
      </> : <><View style={styles.row}><Pressable onPress={() => { setMapType("standard"); setDrawing(true); }} style={styles.primary}><MaterialCommunityIcons name="vector-polygon" size={20} color={colors.white} /><Text style={styles.primaryText}>Desenhar</Text></Pressable><Pressable onPress={importGeoJson} disabled={importing} style={styles.secondary}><MaterialCommunityIcons name="file-import-outline" size={20} color={colors.green} /><Text style={styles.secondaryText}>{importing ? "Importando…" : "GeoJSON"}</Text></Pressable></View><Text style={styles.tapHint}>Toque em um talhão para ver detalhes e registrar o manejo.</Text></>}
    </View>

    <Modal visible={filtersOpen} animationType="fade" transparent onRequestClose={() => setFiltersOpen(false)}>
      <View style={styles.filterShade}><View style={styles.filterCard}><View style={styles.modalHead}><View><Text style={styles.overline}>FILTROS DO MAPA</Text><Text style={styles.filterTitle}>O que deseja ver?</Text></View><Pressable onPress={() => setFiltersOpen(false)}><MaterialCommunityIcons name="close" size={25} color={colors.ink} /></Pressable></View>
        <Text style={styles.filterLabel}>TALHÃO</Text><View style={styles.searchBox}><MaterialCommunityIcons name="magnify" size={19} color={colors.muted} /><TextInput value={plotSearch} onChangeText={setPlotSearch} placeholder="Buscar talhão pelo nome" placeholderTextColor={colors.muted} style={styles.searchInput} />{plotSearch ? <Pressable onPress={() => setPlotSearch("")}><MaterialCommunityIcons name="close-circle" size={18} color={colors.muted} /></Pressable> : null}</View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterOptions}><Choice label="Todos" selected={plotFilter === "all"} onPress={() => { setPlotFilter("all"); fitAllPlots(); }} />{searchedPlots.map((plot) => <Choice key={plot.id} label={plot.name} selected={plotFilter === plot.id} onPress={() => focusPlot(plot)} />)}</ScrollView>
        <Text style={styles.filterLabel}>SITUAÇÃO</Text><View style={styles.levelRow}><LevelChoice label="Todos" color={colors.muted} selected={levelFilter === "all"} onPress={() => setLevelFilter("all")} /><LevelChoice label="Verdes" color={colors.green} selected={levelFilter === "green"} onPress={() => { setPlotFilter("all"); setLevelFilter("green"); }} /><LevelChoice label="Amarelos" color={colors.yellow} selected={levelFilter === "yellow"} onPress={() => { setPlotFilter("all"); setLevelFilter("yellow"); }} /><LevelChoice label="Vermelhos" color={colors.red} selected={levelFilter === "red"} onPress={() => { setPlotFilter("all"); setLevelFilter("red"); }} /></View>
        {activeFilterCount ? <Pressable onPress={clearFilters} style={styles.clearFilter}><MaterialCommunityIcons name="filter-remove-outline" size={18} color={colors.red} /><Text style={styles.clearFilterText}>Limpar filtros</Text></Pressable> : null}
        <Pressable onPress={() => setFiltersOpen(false)} style={styles.applyFilter}><Text style={styles.primaryText}>Ver {visiblePlots.length} talhão(ões)</Text></Pressable>
      </View></View>
    </Modal>

    <Modal visible={help} animationType="fade" transparent onRequestClose={() => setHelp(false)}>
      <View style={styles.modalShade}><View style={styles.modalCard}><View style={styles.modalHead}><Text style={styles.modalTitle}>Como adicionar limites</Text><Pressable onPress={() => setHelp(false)}><MaterialCommunityIcons name="close" size={27} color={colors.ink} /></Pressable></View>
        <HelpStep number="1" title="Desenhar no mapa" copy="Toque em Desenhar e marque os cantos do talhão seguindo a borda visível." />
        <HelpStep number="2" title="Ou importar GeoJSON" copy="Use WGS84/EPSG:4326, Polygon ou MultiPolygon, com coordenadas [longitude, latitude]." />
        <HelpStep number="3" title="Editar depois" copy="Toque em um polígono para renomear, redesenhar ou excluir o limite." />
        <HelpStep number="4" title="Filtrar talhões" copy="Use o filtro para mostrar somente um nome ou uma situação. Ao escolher um talhão, o mapa enquadra seu limite e oculta os demais. Limpe o filtro para voltar à visão completa." />
        <View style={styles.helpNote}><Text style={styles.helpNoteText}>O mapa padrão é mais leve. Use o botão superior para ver o satélite quando houver internet.</Text></View>
        <Pressable onPress={() => setHelp(false)} style={styles.primaryFull}><Text style={styles.primaryText}>Entendi</Text></Pressable>
      </View></View>
    </Modal>

    <Modal visible={Boolean(selectedPlot)} animationType="slide" transparent onRequestClose={() => setSelectedPlot(null)}>
      <View style={styles.pendingShade}><View style={styles.plotCard}><ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"><View style={styles.pendingHandle} />
        <View style={styles.pendingHeader}><View style={{ flex: 1 }}><Text style={styles.overline}>TALHÃO SELECIONADO</Text><Text style={styles.pendingTitle}>{selectedPlot?.name}</Text></View><Pressable accessibilityLabel="Fechar opções do talhão" onPress={() => setSelectedPlot(null)}><MaterialCommunityIcons name="close" size={26} color={colors.ink} /></Pressable></View>
        {selectedSummary ? <><View style={styles.plotStats}><PlotStat value={`${selectedSummary.area.toFixed(1)} ha`} label="área" /><PlotStat value={selectedSummary.inspections} label="inspeções" /><PlotStat value={selectedSummary.pests} label="pragas ativas" /></View><View style={styles.plotStatus}><View style={[styles.levelDot, { backgroundColor: selectedSummary.state.color }]} /><Text style={styles.plotStatusText}>{selectedSummary.state.label} · {selectedSummary.historicalPests} praga(s) no histórico{selectedPlot?.lastSprayedAt ? ` · pulverizado em ${new Date(selectedPlot.lastSprayedAt).toLocaleDateString("pt-BR")}` : ""}</Text></View></> : null}
        <Text style={styles.pendingCopy}>Registre o manejo para atualizar a situação operacional deste talhão.</Text>
        {selectedSummary && selectedSummary.pests > 0 ? <View style={styles.sprayActions}>
          <Pressable onPress={performSpraying} style={styles.sprayPrimary}><MaterialCommunityIcons name="spray" size={21} color={colors.white} /><Text style={styles.sprayPrimaryText}>Realizar pulverização</Text></Pressable>
          <Pressable onPress={() => { markSprayed("A pulverização anterior foi registrada e o talhão agora aparece em verde.").catch(() => Alert.alert("Não foi possível salvar", "Tente novamente.")); }} style={styles.spraySecondary}><MaterialCommunityIcons name="check-circle-outline" size={21} color={colors.green} /><Text style={styles.spraySecondaryText}>Já foi pulverizado</Text></Pressable>
        </View> : <View style={styles.sprayedNotice}><MaterialCommunityIcons name="check-decagram" size={20} color={colors.green} /><Text style={styles.sprayedNoticeText}>Talhão sem ocorrência ativa</Text></View>}
        <Text style={styles.editLabel}>CADASTRO DO TALHÃO</Text>
        <TextInput accessibilityLabel="Editar nome do talhão" value={selectedPlotName} onChangeText={setSelectedPlotName} placeholder="Nome do talhão" style={styles.pendingInput} />
        <Pressable disabled={savingPlot} onPress={renameSelectedPlot} style={styles.areaAction}><MaterialCommunityIcons name="content-save-outline" size={21} color={colors.white} /><Text style={styles.areaActionText}>{savingPlot ? "Salvando…" : "Salvar nome"}</Text></Pressable>
        <Pressable onPress={redrawSelectedPlot} style={styles.drawExact}><MaterialCommunityIcons name="vector-polygon" size={20} color={colors.green} /><View style={{ flex: 1 }}><Text style={styles.drawExactTitle}>Redesenhar limite</Text><Text style={styles.optionCopy}>Marque novamente os vértices deste talhão.</Text></View></Pressable>
        <Pressable onPress={deleteSelectedPlot} style={styles.deleteAction}><MaterialCommunityIcons name="trash-can-outline" size={20} color={colors.red} /><Text style={styles.deleteActionText}>Excluir talhão</Text></Pressable>
      </ScrollView></View></View>
    </Modal>

    <Modal visible={Boolean(pendingRecord)} animationType="slide" transparent onRequestClose={onDismissPending}>
      <View style={styles.pendingShade}><View style={styles.pendingCard}><ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"><View style={styles.pendingHandle} />
        <View style={styles.pendingHeader}><View style={{ flex: 1 }}><Text style={styles.overline}>FOTO LOCALIZADA</Text><Text style={styles.pendingTitle}>Qual é a área deste talhão?</Text></View><Pressable accessibilityLabel="Marcar depois" onPress={onDismissPending}><MaterialCommunityIcons name="close" size={26} color={colors.ink} /></Pressable></View>
        <Text style={styles.pendingCopy}>O mapa foi centralizado no ponto da foto. Informe a área para criar automaticamente um limite estimado ao redor do GPS.</Text>
        {pendingExistingPlot && onUseExistingPlot ? <Pressable onPress={onUseExistingPlot} style={styles.existingPlot}><MaterialCommunityIcons name="map-check" size={22} color={colors.green} /><View style={{ flex: 1 }}><Text style={styles.optionTitle}>Usar {pendingExistingPlot.name}</Text><Text style={styles.optionCopy}>A foto já está dentro deste talhão.</Text></View><MaterialCommunityIcons name="chevron-right" size={22} color={colors.green} /></Pressable> : null}
        <TextInput accessibilityLabel="Nome do talhão" value={pendingPlotName} onChangeText={setPendingPlotName} placeholder="Nome do talhão" style={styles.pendingInput} />
        <View style={styles.areaRow}><TextInput accessibilityLabel="Área do talhão em hectares" value={areaHectares} onChangeText={setAreaHectares} keyboardType="decimal-pad" placeholder="Ex.: 2,5" style={[styles.pendingInput, styles.areaInput]} /><Text style={styles.areaUnit}>hectares</Text></View>
        <Pressable disabled={!validLocation(pendingRecord?.location) || savingArea} onPress={createPendingPlotByArea} style={[styles.areaAction, (!validLocation(pendingRecord?.location) || savingArea) && styles.disabled]}><MaterialCommunityIcons name="map-marker-radius" size={21} color={colors.white} /><Text style={styles.areaActionText}>{savingArea ? "Marcando…" : "Marcar talhão automaticamente"}</Text></Pressable>
        <Pressable onPress={onDrawPendingPlot} style={styles.drawExact}><MaterialCommunityIcons name="vector-polygon" size={20} color={colors.green} /><View style={{ flex: 1 }}><Text style={styles.drawExactTitle}>Desenhar o limite exato</Text><Text style={styles.optionCopy}>Marque os vértices quando o formato real não for circular.</Text></View></Pressable>
        <Text style={styles.estimateNote}>A marcação automática estima um círculo a partir da área. Para precisão cadastral, importe um GeoJSON ou desenhe o limite.</Text>
      </ScrollView></View></View>
    </Modal>
  </View>;
}

function Legend({ color, text }: { color: string; text: string }) { return <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: color }]} /><Text style={styles.legendText}>{text}</Text></View>; }
function PlotStat({ value, label }: { value: string | number; label: string }) { return <View style={styles.plotStat}><Text numberOfLines={1} style={styles.plotStatValue}>{value}</Text><Text style={styles.plotStatLabel}>{label}</Text></View>; }
function HelpStep({ number, title, copy }: { number: string; title: string; copy: string }) { return <View style={styles.helpStep}><View style={styles.helpNumber}><Text style={styles.helpNumberText}>{number}</Text></View><View style={{ flex: 1 }}><Text style={styles.helpTitle}>{title}</Text><Text style={styles.helpCopy}>{copy}</Text></View></View>; }
function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) { return <Pressable onPress={onPress} style={[styles.choice, selected && styles.choiceSelected]}><Text numberOfLines={1} style={[styles.choiceText, selected && styles.choiceTextSelected]}>{label}</Text></Pressable>; }
function LevelChoice({ label, color, selected, onPress }: { label: string; color: string; selected: boolean; onPress: () => void }) { return <Pressable onPress={onPress} style={[styles.levelChoice, selected && { borderColor: color, backgroundColor: `${color}14` }]}><View style={[styles.levelDot, { backgroundColor: color }]} /><Text style={styles.levelText}>{label}</Text></Pressable>; }

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#E8E7E1" },
  mapLoading: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center", backgroundColor: "#E8E7E1" },
  mapLoadingTitle: { marginTop: 12, color: colors.ink, fontFamily: fonts.bold, fontSize: 15 },
  mapLoadingCopy: { marginTop: 5, color: colors.muted, fontFamily: fonts.regular, fontSize: 10 },
  topBar: { position: "absolute", top: 49, left: 14, right: 14, height: 54, paddingHorizontal: 16, borderRadius: 17, backgroundColor: "rgba(15,46,28,0.95)", flexDirection: "row", alignItems: "center", justifyContent: "space-between", ...shadow },
  brandSmall: { color: colors.white, fontFamily: fonts.extraBold, fontSize: 10, letterSpacing: 0.8 }, farmSub: { color: "rgba(255,255,255,0.72)", fontFamily: fonts.semibold, fontSize: 9, marginTop: 2 },
  totalPill: { minWidth: 132, height: 38, paddingHorizontal: 12, borderRadius: 12, backgroundColor: colors.white, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
  totalNumber: { color: colors.greenDark, fontFamily: fonts.black, fontSize: 18 }, totalLabel: { color: colors.greenDark, fontFamily: fonts.extraBold, fontSize: 11 },
  selectorRow: { position: "absolute", top: 111, left: 14, width: 154 },
  mapSelector: { flex: 1, minWidth: 0, height: 54, borderRadius: 15, borderWidth: 1, borderColor: "rgba(13,107,64,0.18)", paddingHorizontal: 10, backgroundColor: "rgba(255,255,255,0.96)", flexDirection: "row", alignItems: "center", gap: 7, ...shadow },
  selectorLabel: { color: colors.greenDark, fontFamily: fonts.extraBold, fontSize: 10, letterSpacing: 0.7 }, selectorValue: { color: colors.ink, fontFamily: fonts.extraBold, fontSize: 12, marginTop: 2 },
  toolRail: { position: "absolute", top: 111, right: 10, borderRadius: 15, padding: 4, gap: 4, backgroundColor: "rgba(255,255,255,0.96)", ...shadow },
  toolButton: { width: 40, height: 40, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: colors.white }, toolButtonActive: { backgroundColor: colors.green },
  panel: { position: "absolute", left: 12, right: 12, bottom: 94, borderRadius: 22, padding: 14, backgroundColor: "rgba(252,251,247,0.97)", ...shadow },
  handle: { width: 43, height: 5, borderRadius: 3, backgroundColor: "#C4CEC7", alignSelf: "center", marginBottom: 11 }, panelHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  overline: { color: colors.greenDark, fontFamily: fonts.extraBold, fontSize: 11, letterSpacing: 1.3 }, title: { color: colors.ink, fontFamily: fonts.black, fontSize: 20 },
  legend: { flexDirection: "row", gap: 10 }, legendItem: { flexDirection: "row", alignItems: "center", gap: 4 }, legendDot: { width: 10, height: 10, borderRadius: 3 }, legendText: { color: colors.ink, fontFamily: fonts.bold, fontSize: 11 },
  row: { flexDirection: "row", gap: 9 }, primary: { flex: 1, height: 54, borderRadius: radii.small, backgroundColor: colors.green, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 }, primaryFull: { height: 56, borderRadius: radii.pill, backgroundColor: colors.green, alignItems: "center", justifyContent: "center", marginTop: 18 }, primaryText: { color: colors.white, fontFamily: fonts.extraBold, fontSize: 15 },
  secondary: { flex: 1, height: 54, borderRadius: radii.small, borderWidth: 1.5, borderColor: colors.lineStrong, backgroundColor: colors.white, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 }, secondaryText: { color: colors.greenDark, fontFamily: fonts.extraBold, fontSize: 15 },
  cancel: { alignItems: "center", paddingTop: 11 }, cancelText: { color: colors.red, fontFamily: fonts.bold, fontSize: 14 }, hint: { color: colors.ink, fontFamily: fonts.semibold, fontSize: 14, lineHeight: 20, marginBottom: 9 }, tapHint: { color: colors.muted, fontFamily: fonts.semibold, fontSize: 12, textAlign: "center", marginTop: 10 },
  nameInput: { height: 45, borderWidth: 1, borderColor: colors.line, borderRadius: 13, paddingHorizontal: 13, fontFamily: fonts.medium, marginBottom: 9, color: colors.ink, backgroundColor: colors.white },
  pendingShade: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(7,20,12,0.42)" }, pendingCard: { maxHeight: "88%", borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 20, paddingTop: 11, paddingBottom: 104, backgroundColor: colors.paper }, plotCard: { maxHeight: "90%", borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 20, paddingTop: 11, paddingBottom: 28, backgroundColor: colors.paper },
  pendingHandle: { width: 44, height: 5, borderRadius: 3, alignSelf: "center", marginBottom: 14, backgroundColor: "#C4CEC7" }, pendingHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12 }, pendingTitle: { color: colors.ink, fontFamily: fonts.black, fontSize: 24, letterSpacing: -0.5, marginTop: 3 }, pendingCopy: { color: colors.muted, fontFamily: fonts.regular, fontSize: 11, lineHeight: 17, marginTop: 8, marginBottom: 12 },
  plotStats: { flexDirection: "row", gap: 7, marginTop: 14 }, plotStat: { flex: 1, minWidth: 0, borderRadius: 15, paddingVertical: 11, paddingHorizontal: 8, alignItems: "center", backgroundColor: colors.greenSoft }, plotStatValue: { color: colors.greenDark, fontFamily: fonts.extraBold, fontSize: 15 }, plotStatLabel: { color: colors.muted, fontFamily: fonts.medium, fontSize: 8, marginTop: 3 }, plotStatus: { minHeight: 34, paddingHorizontal: 11, marginTop: 8, borderRadius: 12, flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line }, plotStatusText: { flex: 1, color: colors.ink, fontFamily: fonts.semibold, fontSize: 9 },
  existingPlot: { minHeight: 66, borderRadius: 17, padding: 12, marginBottom: 9, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.greenSoft }, optionTitle: { color: colors.ink, fontFamily: fonts.bold, fontSize: 12 }, optionCopy: { color: colors.muted, fontFamily: fonts.regular, fontSize: 9, lineHeight: 14, marginTop: 2 },
  pendingInput: { height: 47, borderRadius: 14, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 13, color: colors.ink, backgroundColor: colors.white, fontFamily: fonts.medium, fontSize: 12 }, areaRow: { marginTop: 8, position: "relative" }, areaInput: { paddingRight: 78 }, areaUnit: { position: "absolute", right: 13, top: 16, color: colors.muted, fontFamily: fonts.bold, fontSize: 10 },
  areaAction: { height: 52, marginTop: 10, borderRadius: radii.pill, backgroundColor: colors.orange, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }, areaActionText: { color: colors.white, fontFamily: fonts.bold, fontSize: 12 }, disabled: { opacity: 0.45 },
  drawExact: { minHeight: 59, marginTop: 8, paddingHorizontal: 13, borderRadius: 17, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, flexDirection: "row", alignItems: "center", gap: 10 }, drawExactTitle: { color: colors.green, fontFamily: fonts.bold, fontSize: 11 }, estimateNote: { color: colors.muted, fontFamily: fonts.regular, fontSize: 8, lineHeight: 12, textAlign: "center", marginTop: 8, paddingHorizontal: 8 },
  deleteAction: { height: 50, marginTop: 8, borderRadius: radii.pill, borderWidth: 1, borderColor: "#F0CBC6", backgroundColor: colors.white, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }, deleteActionText: { color: colors.red, fontFamily: fonts.bold, fontSize: 12 },
  drawPoint: { width: 27, height: 27, borderRadius: 14, backgroundColor: colors.orange, borderWidth: 2, borderColor: colors.white, alignItems: "center", justifyContent: "center" }, drawPointText: { color: colors.white, fontFamily: fonts.bold, fontSize: 10 },
  countBadge: { minWidth: 54, height: 30, borderRadius: 15, paddingHorizontal: 9, borderWidth: 2, backgroundColor: "rgba(255,255,255,0.96)", alignItems: "center", justifyContent: "center", ...shadow }, countBadgeNumber: { fontFamily: fonts.extraBold, fontSize: 11 },
  sprayActions: { gap: 8, marginBottom: 10 }, sprayPrimary: { height: 52, borderRadius: radii.pill, backgroundColor: colors.orange, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }, sprayPrimaryText: { color: colors.white, fontFamily: fonts.extraBold, fontSize: 13 }, spraySecondary: { height: 50, borderRadius: radii.pill, borderWidth: 1.5, borderColor: colors.green, backgroundColor: colors.white, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }, spraySecondaryText: { color: colors.green, fontFamily: fonts.extraBold, fontSize: 13 }, sprayedNotice: { minHeight: 48, paddingHorizontal: 14, marginBottom: 10, borderRadius: 15, backgroundColor: colors.greenSoft, flexDirection: "row", alignItems: "center", gap: 8 }, sprayedNoticeText: { color: colors.greenDark, fontFamily: fonts.bold, fontSize: 13 }, editLabel: { color: colors.greenDark, fontFamily: fonts.extraBold, fontSize: 10, letterSpacing: 1.1, marginTop: 4, marginBottom: 7 },
  modalShade: { flex: 1, justifyContent: "center", padding: 18, backgroundColor: "rgba(8,25,14,0.72)" }, modalCard: { borderRadius: 28, padding: 20, backgroundColor: colors.paper }, modalHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 15 }, modalTitle: { color: colors.ink, fontFamily: fonts.extraBold, fontSize: 23 },
  helpStep: { flexDirection: "row", gap: 12, marginTop: 14 }, helpNumber: { width: 34, height: 34, borderRadius: 11, backgroundColor: colors.green, alignItems: "center", justifyContent: "center" }, helpNumberText: { color: colors.white, fontFamily: fonts.extraBold, fontSize: 14 }, helpTitle: { color: colors.ink, fontFamily: fonts.extraBold, fontSize: 16 }, helpCopy: { color: colors.muted, fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, marginTop: 2 }, helpNote: { backgroundColor: colors.greenSoft, borderRadius: 15, padding: 14, marginTop: 17 }, helpNoteText: { color: colors.greenDark, fontFamily: fonts.semibold, fontSize: 13, lineHeight: 19 },
  filterShade: { flex: 1, justifyContent: "center", padding: 18, backgroundColor: "rgba(8,25,14,0.58)" }, filterCard: { borderRadius: 25, padding: 18, backgroundColor: colors.paper }, filterTitle: { color: colors.ink, fontFamily: fonts.extraBold, fontSize: 21, marginTop: 2 }, filterLabel: { color: colors.green, fontFamily: fonts.bold, fontSize: 8, letterSpacing: 1.2, marginTop: 17, marginBottom: 8 }, searchBox: { height: 43, borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, paddingHorizontal: 11, marginBottom: 8, flexDirection: "row", alignItems: "center", gap: 7 }, searchInput: { flex: 1, color: colors.ink, fontFamily: fonts.medium, fontSize: 10 }, filterOptions: { gap: 7, paddingRight: 10 }, choice: { maxWidth: 190, height: 39, borderRadius: 20, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, paddingHorizontal: 13, alignItems: "center", justifyContent: "center" }, choiceSelected: { backgroundColor: colors.green, borderColor: colors.green }, choiceText: { color: colors.ink, fontFamily: fonts.semibold, fontSize: 10 }, choiceTextSelected: { color: colors.white }, levelRow: { flexDirection: "row", flexWrap: "wrap", gap: 7 }, levelChoice: { width: "48.5%", height: 39, borderRadius: 13, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 7 }, levelDot: { width: 9, height: 9, borderRadius: 5 }, levelText: { color: colors.ink, fontFamily: fonts.semibold, fontSize: 9 }, clearFilter: { height: 42, marginTop: 15, borderRadius: radii.pill, borderWidth: 1, borderColor: "#F0CBC6", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 }, clearFilterText: { color: colors.red, fontFamily: fonts.bold, fontSize: 10 }, applyFilter: { height: 50, marginTop: 9, borderRadius: radii.pill, backgroundColor: colors.green, alignItems: "center", justifyContent: "center" },
});
