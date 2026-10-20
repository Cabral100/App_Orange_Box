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
import { findPlot, polygonAroundArea } from "./geo";
import { AccountScreen } from "./screens/AccountScreen";
import { CameraScreen } from "./screens/CameraScreen";
import { DashboardScreen } from "./screens/DashboardScreen";
import { HistoryScreen } from "./screens/HistoryScreen";
import { InspectionResultScreen } from "./screens/InspectionResultScreen";
import { LoginScreen } from "./screens/LoginScreen";
import { MapScreen } from "./screens/MapScreen";
import { loadSnapshot, savePlots, saveRecords, saveSession } from "./storage";
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
  const [drawingRequest, setDrawingRequest] = useState<{ recordId: string; location: Coordinates | null } | null>(null);

  useEffect(() => {
    loadSnapshot().then((snapshot) => {
      setSession(snapshot.session); setRecords(snapshot.records); setPlots(snapshot.plots); setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  const resultPlot = useMemo(() => resultRecord ? findPlot(plots, resultRecord.location) : null, [plots, resultRecord]);

  async function login(nextSession: Session) { setSession(nextSession); await saveSession(nextSession); }
  async function logout() { setSession(null); setActiveTab("camera"); await saveSession(null); }
  async function updatePlots(nextPlots: Plot[]) { setPlots(nextPlots); await savePlots(nextPlots); }
  async function capture(record: InspectionRecord) {
    const next = [record, ...records]; setRecords(next); await saveRecords(next); setResultRecord(record);
  }
  async function updateMappedRecord(plotId: string | null) {
    if (!resultRecord) return;
    const updated = { ...resultRecord, mapVisible: true, plotId };
    const next = records.map((record) => record.id === updated.id ? updated : record);
    setRecords(next); await saveRecords(next);
    setResultRecord(null); setActiveTab("map");
  }
  async function useExistingPlot() { await updateMappedRecord(resultPlot?.id || null); }
  async function createPlotByArea(areaSquareMeters: number, name: string) {
    if (!resultRecord?.location) throw new Error("A foto não possui coordenada para centralizar o limite.");
    const plot: Plot = {
      id: globalThis.crypto?.randomUUID?.() || `plot-${Date.now()}`,
      name,
      geometry: polygonAroundArea(resultRecord.location, areaSquareMeters),
      createdAt: new Date().toISOString(),
      source: "estimated",
    };
    const nextPlots = [...plots, plot]; setPlots(nextPlots); await savePlots(nextPlots);
    await updateMappedRecord(plot.id);
  }
  async function drawPlotForResult() {
    if (!resultRecord) return;
    setDrawingRequest({ recordId: resultRecord.id, location: resultRecord.location });
    setResultRecord(null); setActiveTab("map");
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
      {activeTab === "map" && <MapScreen records={records} plots={plots} onPlotsChange={updatePlots} startDrawing={Boolean(drawingRequest)} draftLocation={drawingRequest?.location || null} onPlotCreated={completeManualPlot} />}
      {activeTab === "history" && <HistoryScreen records={records} plots={plots} onDashboard={() => setActiveTab("dashboard")} onSelect={setResultRecord} />}
      {activeTab === "dashboard" && <DashboardScreen records={records} plots={plots} />}
      {activeTab === "account" && <AccountScreen session={session} records={records} plots={plots} onLogout={logout} demoMode={demoMode} />}
      {activeTab !== "camera" ? <BottomNav active={activeTab} onChange={setActiveTab} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({ app: { flex: 1, backgroundColor: colors.paper }, loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.paper } });
