import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  Inter_900Black,
  useFonts,
} from "@expo-google-fonts/inter";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { BottomNav } from "./components/BottomNav";
import { getDemoPlots, getDemoRecords } from "./demoData";
import { findPlot, polygonAroundArea } from "./geo";
import { AccountScreen } from "./screens/AccountScreen";
import { CameraScreen } from "./screens/CameraScreen";
import { DashboardScreen } from "./screens/DashboardScreen";
import { HistoryScreen } from "./screens/HistoryScreen";
import { InspectionResultScreen } from "./screens/InspectionResultScreen";
import { LoginScreen } from "./screens/LoginScreen";
import { MapScreen } from "./screens/MapScreen";
import { loadSnapshot, savePlots, saveRecords, saveSession, seedDemoSnapshot } from "./storage";
import { colors } from "./theme";
import type { Coordinates, InspectionRecord, PhotoAnalyzer, Plot, Session, TabId } from "./types";

type Props = {
  analyzer: PhotoAnalyzer;
  prepareAnalyzer: () => Promise<unknown>;
  demoMode?: boolean;
};

export function AppShell({ analyzer, prepareAnalyzer, demoMode = false }: Props) {
  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold, Inter_900Black });
  const [loaded, setLoaded] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [records, setRecords] = useState<InspectionRecord[]>([]);
  const [plots, setPlots] = useState<Plot[]>([]);
  const [activeTab, setActiveTab] = useState<TabId>("camera");
  const [resultRecord, setResultRecord] = useState<InspectionRecord | null>(null);
  const [pendingMapRecord, setPendingMapRecord] = useState<InspectionRecord | null>(null);
  const [drawingRequest, setDrawingRequest] = useState<{ recordId: string; location: Coordinates | null } | null>(null);

  useEffect(() => {
    loadSnapshot().then((snapshot) => demoMode ? seedDemoSnapshot(snapshot, getDemoPlots(), getDemoRecords()) : snapshot).then(async (snapshot) => {
      const previousName = snapshot.session?.name.trim().toLowerCase();
      const normalizedSession = previousName === "operador de campo" || previousName === "lucas cabral" || previousName === "elon musk" ? { ...snapshot.session!, name: "Rafael Almeida", email: "rafael@cyf.app" } : snapshot.session;
      if (normalizedSession !== snapshot.session) await saveSession(normalizedSession);
      setSession(normalizedSession); setRecords(snapshot.records); setPlots(snapshot.plots); setLoaded(true);
    }).catch(() => setLoaded(true));
  }, [demoMode]);

  const resultPlot = useMemo(() => resultRecord ? findPlot(plots, resultRecord.location) : null, [plots, resultRecord]);

  async function login(nextSession: Session) { setSession(nextSession); await saveSession(nextSession); }
  async function logout() { setSession(null); setActiveTab("camera"); await saveSession(null); }
  async function updatePlots(nextPlots: Plot[]) { setPlots(nextPlots); await savePlots(nextPlots); }

  async function updatePlot(updated: Plot) {
    await updatePlots(plots.map((plot) => plot.id === updated.id ? updated : plot));
  }

  async function deletePlot(plotId: string) {
    const nextPlots = plots.filter((plot) => plot.id !== plotId);
    const nextRecords = records.map((record) => record.plotId === plotId ? { ...record, plotId: null } : record);
    setPlots(nextPlots); setRecords(nextRecords);
    await Promise.all([savePlots(nextPlots), saveRecords(nextRecords)]);
  }

  async function updateRecord(updated: InspectionRecord) {
    const next = records.map((record) => record.id === updated.id ? updated : record);
    setRecords(next); await saveRecords(next);
  }

  async function deleteRecord(recordId: string) {
    const next = records.filter((record) => record.id !== recordId);
    setRecords(next); await saveRecords(next);
    if (resultRecord?.id === recordId) setResultRecord(null);
  }

  async function capture(record: InspectionRecord) {
    const next = [record, ...records];
    setRecords(next); await saveRecords(next);
    setPendingMapRecord(record); setActiveTab("map");
  }

  async function updateMappedRecord(plotId: string | null) {
    const target = pendingMapRecord || resultRecord;
    if (!target) return;
    const updated = { ...target, mapVisible: true, plotId };
    const next = records.map((record) => record.id === updated.id ? updated : record);
    setRecords(next); await saveRecords(next);
    setPendingMapRecord(null); setResultRecord(null); setActiveTab("map");
  }

  async function useExistingPlot() {
    const target = pendingMapRecord || resultRecord;
    await updateMappedRecord(findPlot(plots, target?.location || null)?.id || null);
  }

  async function createPlotByArea(areaSquareMeters: number, name: string) {
    const target = pendingMapRecord || resultRecord;
    if (!target?.location) throw new Error("A foto não possui coordenada para centralizar o limite.");
    const plot: Plot = {
      id: globalThis.crypto?.randomUUID?.() || `plot-${Date.now()}`,
      name,
      geometry: polygonAroundArea(target.location, areaSquareMeters),
      createdAt: new Date().toISOString(),
      source: "estimated",
    };
    const nextPlots = [...plots, plot]; setPlots(nextPlots); await savePlots(nextPlots);
    await updateMappedRecord(plot.id);
  }

  async function drawPlotForResult() {
    const target = pendingMapRecord || resultRecord;
    if (!target) return;
    setDrawingRequest({ recordId: target.id, location: target.location });
    setPendingMapRecord(null); setResultRecord(null); setActiveTab("map");
  }

  async function completeManualPlot(plot: Plot) {
    const nextPlots = [...plots, plot]; setPlots(nextPlots); await savePlots(nextPlots);
    if (drawingRequest) {
      const nextRecords = records.map((record) => record.id === drawingRequest.recordId ? { ...record, mapVisible: true, plotId: plot.id } : record);
      setRecords(nextRecords); await saveRecords(nextRecords); setDrawingRequest(null);
    }
  }

  async function discardResult() {
    if (!resultRecord) return;
    const next = records.filter((record) => record.id !== resultRecord.id);
    setRecords(next); setResultRecord(null); await saveRecords(next);
  }

  if (!fontsLoaded || !loaded) return <View style={styles.loading}><ActivityIndicator size="large" color={colors.green} /></View>;
  if (!session) return <><StatusBar style="dark" /><LoginScreen onLogin={login} /></>;
  if (resultRecord) return <><StatusBar style="dark" /><InspectionResultScreen record={resultRecord} plot={resultPlot} onUseExistingPlot={useExistingPlot} onCreatePlotByArea={createPlotByArea} onDrawPlot={drawPlotForResult} onNext={() => setResultRecord(null)} onRetake={discardResult} /></>;

  return (
    <View style={styles.app}>
      <StatusBar style={activeTab === "camera" || activeTab === "map" ? "light" : "dark"} />
      {activeTab === "camera" && <CameraScreen plots={plots} active onBack={() => setActiveTab("history")} onCaptured={capture} analyzer={analyzer} prepareAnalyzer={prepareAnalyzer} demoMode={demoMode} />}
      {activeTab === "map" && <MapScreen records={records} plots={plots} onPlotsChange={updatePlots} onPlotUpdate={updatePlot} onPlotDelete={deletePlot} startDrawing={Boolean(drawingRequest)} draftLocation={drawingRequest?.location || null} onPlotCreated={completeManualPlot} pendingRecord={pendingMapRecord} onUseExistingPlot={useExistingPlot} onCreatePlotByArea={createPlotByArea} onDrawPendingPlot={drawPlotForResult} onDismissPending={() => setPendingMapRecord(null)} />}
      {activeTab === "history" && <HistoryScreen records={records} plots={plots} onDashboard={() => setActiveTab("dashboard")} onSelect={setResultRecord} onUpdate={updateRecord} onDelete={deleteRecord} />}
      {activeTab === "dashboard" && <DashboardScreen records={records} plots={plots} />}
      {activeTab === "account" && <AccountScreen session={session} records={records} plots={plots} onLogout={logout} demoMode={demoMode} />}
      {activeTab !== "camera" ? <BottomNav active={activeTab} onChange={setActiveTab} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({ app: { flex: 1, backgroundColor: colors.paper }, loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.paper } });
