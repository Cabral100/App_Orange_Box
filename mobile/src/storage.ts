import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import type { AppSnapshot, InspectionRecord, Plot, Session } from "./types";

const KEYS = {
  session: "cyf.native.session.v1",
  records: "cyf.native.records.v1",
  plots: "cyf.native.plots.v1",
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
  return {
    session: parseJson<Session | null>(session, null),
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

export async function persistInspectionImage(sourceUri: string, id: string): Promise<string> {
  if (!FileSystem.documentDirectory) return sourceUri;
  const directory = `${FileSystem.documentDirectory}cyf-inspections/`;
  const destination = `${directory}${id}.jpg`;
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  await FileSystem.copyAsync({ from: sourceUri, to: destination });
  return destination;
}
