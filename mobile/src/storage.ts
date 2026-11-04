import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import type { AppSnapshot, InspectionRecord, Plot, Session } from "./types";

const KEYS = {
  session: "cyf.native.session.v2",
  records: "cyf.native.records.v1",
  plots: "cyf.native.plots.v1",
  demoSeeded: "cyf.native.demo-seeded.v1",
};

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function loadSnapshot(): Promise<AppSnapshot> {
  const [session, records, plots] = await Promise.all([
    AsyncStorage.getItem(KEYS.session),
    AsyncStorage.getItem(KEYS.records),
    AsyncStorage.getItem(KEYS.plots),
  ]);
  const savedSession = parseJson<Session | null>(session, null);
  return {
    session: savedSession ? { ...savedSession, role: savedSession.role || "inspection" } : null,
    records: parseJson<InspectionRecord[]>(records, []),
    plots: parseJson<Plot[]>(plots, []),
  };
}

export function saveSession(session: Session | null) {
  return session
    ? AsyncStorage.setItem(KEYS.session, JSON.stringify(session))
    : AsyncStorage.removeItem(KEYS.session);
}

export function saveRecords(records: InspectionRecord[]) {
  return AsyncStorage.setItem(KEYS.records, JSON.stringify(records));
}

export function savePlots(plots: Plot[]) {
  return AsyncStorage.setItem(KEYS.plots, JSON.stringify(plots));
}

export async function seedDemoSnapshot(snapshot: AppSnapshot, demoPlots: Plot[], demoRecords: InspectionRecord[]): Promise<AppSnapshot> {
  const savedPlots = new Map(snapshot.plots.map((plot) => [plot.id, plot]));
  const savedRecords = new Map(snapshot.records.map((record) => [record.id, record]));
  const demoPlotIds = new Set(demoPlots.map((plot) => plot.id));
  const demoRecordIds = new Set(demoRecords.map((record) => record.id));
  const plots = [
    ...demoPlots.map((plot) => {
      const saved = savedPlots.get(plot.id);
      return { ...plot, sprayStatus: saved?.sprayStatus || plot.sprayStatus, sprayScheduledAt: saved?.sprayScheduledAt || plot.sprayScheduledAt, lastSprayedAt: saved?.lastSprayedAt || plot.lastSprayedAt };
    }),
    ...snapshot.plots.filter((plot) => !demoPlotIds.has(plot.id)),
  ];
  const records = [
    ...demoRecords.map((record) => {
      const saved = savedRecords.get(record.id);
      return { ...record, plotId: saved?.plotId ?? record.plotId, mapVisible: saved?.mapVisible ?? record.mapVisible, imageUri: record.imageUri };
    }),
    ...snapshot.records.filter((record) => !demoRecordIds.has(record.id)),
  ];
  await AsyncStorage.multiSet([
    [KEYS.plots, JSON.stringify(plots)],
    [KEYS.records, JSON.stringify(records)],
    [KEYS.demoSeeded, "1"],
  ]);
  return { ...snapshot, plots, records };
}

export async function persistInspectionImage(sourceUri: string, id: string): Promise<string> {
  if (!FileSystem.documentDirectory) return sourceUri;
  const directory = `${FileSystem.documentDirectory}cyf-inspections/`;
  const destination = `${directory}${id}.jpg`;
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  await FileSystem.copyAsync({ from: sourceUri, to: destination });
  return destination;
}
