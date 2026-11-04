import { Image } from "react-native";
import type { Detection, InspectionRecord, Plot } from "./types";

const imageUris = [
  Image.resolveAssetSource(require("../assets/demo-inspection-1.png"))!.uri,
  Image.resolveAssetSource(require("../assets/demo-inspection-2.png"))!.uri,
  Image.resolveAssetSource(require("../assets/demo-inspection-3.png"))!.uri,
];

function daysAgo(days: number, hour = 9) {
  const value = new Date();
  value.setDate(value.getDate() - days);
  value.setHours(hour, 15, 0, 0);
  return value.toISOString();
}

const demoPlots: Plot[] = [
  {
    id: "demo-plot-norte", name: "Talhão 01 · Pera Norte", source: "geojson", createdAt: "2026-09-01T12:00:00.000Z",
    sprayStatus: "completed", lastSprayedAt: daysAgo(0, 7),
    sprayApplication: { product: "Abamectina 18 EC", category: "Acaricida", target: "Ácaro da leprose", appliedAt: daysAgo(0, 7), reentryHours: 48, harvestIntervalDays: 14, nextInspectionDays: 3 },
    trapMonitoring: { pest: "Furão", metric: "Índice", captured: 2, traps: 10, checkedAt: daysAgo(1, 8) },
    geometry: { type: "Polygon", coordinates: [[[-47.4148, -22.5528], [-47.4088, -22.5526], [-47.4085, -22.5571], [-47.4145, -22.5573], [-47.4148, -22.5528]]] },
  },
  {
    id: "demo-plot-central", name: "Talhão 02 · Valência", source: "geojson", createdAt: "2026-09-01T12:00:00.000Z",
    sprayStatus: "completed", lastSprayedAt: daysAgo(2, 16),
    sprayApplication: { product: "Enxofre 800 WG", category: "Acaricida", target: "Ácaros", appliedAt: daysAgo(2, 16), reentryHours: 24, harvestIntervalDays: 7, nextInspectionDays: 2 },
    trapMonitoring: { pest: "Furão", metric: "Volume", captured: 8, traps: 12, checkedAt: daysAgo(0, 9) },
    geometry: { type: "Polygon", coordinates: [[[-47.4081, -22.5526], [-47.4018, -22.5527], [-47.4016, -22.5573], [-47.4083, -22.5571], [-47.4081, -22.5526]]] },
  },
  {
    id: "demo-plot-leste", name: "Talhão 03 · Hamlin Leste", source: "geojson", createdAt: "2026-09-01T12:00:00.000Z",
    trapMonitoring: { pest: "Furão", metric: "Volume", captured: 5, traps: 8, checkedAt: daysAgo(2, 10) },
    geometry: { type: "Polygon", coordinates: [[[-47.4009, -22.5529], [-47.3947, -22.5533], [-47.3949, -22.5578], [-47.4011, -22.5573], [-47.4009, -22.5529]]] },
  },
  {
    id: "demo-plot-oeste", name: "Talhão 04 · Natal Oeste", source: "geojson", createdAt: "2026-09-01T12:00:00.000Z",
    sprayStatus: "completed", lastSprayedAt: daysAgo(1, 6),
    sprayApplication: { product: "Óleo mineral agrícola", category: "Inseticida", target: "Cochonilha", appliedAt: daysAgo(1, 6), reentryHours: 24, harvestIntervalDays: 10, nextInspectionDays: 5 },
    trapMonitoring: { pest: "Furão", metric: "Índice", captured: 4, traps: 10, checkedAt: daysAgo(1, 11) },
    geometry: { type: "Polygon", coordinates: [[[-47.4151, -22.5581], [-47.4087, -22.5579], [-47.4088, -22.5627], [-47.4148, -22.5629], [-47.4151, -22.5581]]] },
  },
  {
    id: "demo-plot-sul", name: "Talhão 05 · Experimental Sul", source: "geojson", createdAt: "2026-09-01T12:00:00.000Z",
    trapMonitoring: { pest: "Furão", metric: "Índice", captured: 0, traps: 6, checkedAt: daysAgo(0, 6) },
    geometry: { type: "Polygon", coordinates: [[[-47.4080, -22.5580], [-47.4017, -22.5581], [-47.4016, -22.5628], [-47.4081, -22.5627], [-47.4080, -22.5580]]] },
  },
  {
    id: "demo-plot-ribeirao", name: "Talhão 06 · Ribeirão", source: "geojson", createdAt: "2026-09-01T12:00:00.000Z", sprayStatus: "completed", lastSprayedAt: daysAgo(1, 17),
    sprayApplication: { product: "Cobre 500 WP", category: "Fungicida", target: "Doenças fúngicas", appliedAt: daysAgo(1, 17), reentryHours: 24, harvestIntervalDays: 7, nextInspectionDays: 4 },
    trapMonitoring: { pest: "Furão", metric: "Volume", captured: 1, traps: 8, checkedAt: daysAgo(1, 8) },
    geometry: { type: "Polygon", coordinates: [[[-47.4009, -22.5583], [-47.3947, -22.5585], [-47.3952, -22.5630], [-47.4012, -22.5628], [-47.4009, -22.5583]]] },
  },
  {
    id: "demo-plot-serra", name: "Talhão 07 · Serra", source: "geojson", createdAt: "2026-09-01T12:00:00.000Z",
    sprayStatus: "completed", lastSprayedAt: daysAgo(5, 14),
    sprayApplication: { product: "Deltametrina 25 EC", category: "Inseticida", target: "Furão dos citros", appliedAt: daysAgo(5, 14), reentryHours: 24, harvestIntervalDays: 3, nextInspectionDays: 7 },
    trapMonitoring: { pest: "Furão", metric: "Volume", captured: 11, traps: 10, checkedAt: daysAgo(0, 8) },
    geometry: { type: "Polygon", coordinates: [[[-47.4146, -22.5636], [-47.4079, -22.5634], [-47.4075, -22.5682], [-47.4137, -22.5686], [-47.4146, -22.5636]]] },
  },
  {
    id: "demo-plot-baixada", name: "Talhão 08 · Baixada", source: "geojson", createdAt: "2026-09-01T12:00:00.000Z",
    sprayStatus: "completed", lastSprayedAt: daysAgo(0, 5),
    sprayApplication: { product: "Spirodiclofeno 240 SC", category: "Acaricida", target: "Ácaro da leprose", appliedAt: daysAgo(0, 5), reentryHours: 24, harvestIntervalDays: 14, nextInspectionDays: 3 },
    trapMonitoring: { pest: "Furão", metric: "Índice", captured: 6, traps: 12, checkedAt: daysAgo(0, 7) },
    geometry: { type: "Polygon", coordinates: [[[-47.4071, -22.5635], [-47.4002, -22.5636], [-47.3996, -22.5685], [-47.4066, -22.5682], [-47.4071, -22.5635]]] },
  },
];

function detection(index: number, confidence = 0.97): Detection {
  const column = index % 5;
  const row = Math.floor(index / 5) % 5;
  const x1 = 55 + column * 102;
  const y1 = 62 + row * 98;
  return { class_id: 0, class_name: "Ácaro", confidence: Math.max(0.95, confidence - (index % 3) * 0.005), bbox: { x1, y1, x2: x1 + 62, y2: y1 + 58 } };
}

function demoRecord(id: number, plotId: string, latitude: number, longitude: number, count: number, days: number, image: number, source: "camera" | "gallery" = "camera"): InspectionRecord {
  const detections = Array.from({ length: count }, (_, index) => detection(index));
  return {
    id: `demo-inspection-${id}`,
    capturedAt: daysAgo(days, 7 + (id % 10)),
    imageUri: imageUris[image % imageUris.length] || "",
    width: 640,
    height: 640,
    detections,
    topConfidence: detections[0]?.confidence || 0.18,
    location: { latitude, longitude, accuracy: 4 + (id % 6), altitude: 575 + (id % 9), source: source === "gallery" ? "exif" : "gps" },
    plotId,
    mapVisible: true,
    source,
    syncState: "local",
    demo: true,
  };
}

export function getDemoPlots(): Plot[] {
  return demoPlots.map((plot) => ({ ...plot, geometry: JSON.parse(JSON.stringify(plot.geometry)) as Plot["geometry"] }));
}

export function getDemoRecords(): InspectionRecord[] {
  return [
    demoRecord(1, "demo-plot-norte", -22.5542, -47.4125, 3, 0, 0),
    demoRecord(2, "demo-plot-norte", -22.5560, -47.4104, 5, 3, 1),
    demoRecord(3, "demo-plot-central", -22.5540, -47.4055, 13, 0, 2),
    demoRecord(4, "demo-plot-central", -22.5560, -47.4038, 14, 2, 0, "gallery"),
    demoRecord(5, "demo-plot-leste", -22.5545, -47.3983, 8, 1, 1),
    demoRecord(6, "demo-plot-leste", -22.5562, -47.3967, 10, 6, 2),
    demoRecord(7, "demo-plot-oeste", -22.5595, -47.4129, 18, 0, 0),
    demoRecord(8, "demo-plot-oeste", -22.5615, -47.4103, 16, 4, 1),
    demoRecord(9, "demo-plot-sul", -22.5603, -47.4050, 0, 1, 2),
    demoRecord(10, "demo-plot-ribeirao", -22.5602, -47.3983, 7, 4, 0),
    demoRecord(11, "demo-plot-serra", -22.5650, -47.4112, 4, 2, 1),
    demoRecord(12, "demo-plot-baixada", -22.5652, -47.4045, 11, 0, 2),
    demoRecord(13, "demo-plot-baixada", -22.5670, -47.4023, 12, 5, 0, "gallery"),
    demoRecord(14, "demo-plot-sul", -22.5612, -47.4067, 0, 7, 1),
  ];
}
