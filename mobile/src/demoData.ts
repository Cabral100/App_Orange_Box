import { Image } from "react-native";
import type { Detection, InspectionRecord, Plot } from "./types";

const imageUris = [
  Image.resolveAssetSource(require("../assets/demo-inspection-1.png")).uri,
  Image.resolveAssetSource(require("../assets/demo-inspection-2.png")).uri,
  Image.resolveAssetSource(require("../assets/demo-inspection-3.png")).uri,
];

const demoPlots: Plot[] = [
  {
    id: "demo-plot-norte",
    name: "Talhão Pera Norte",
    source: "geojson",
    createdAt: "2026-09-01T12:00:00.000Z",
    geometry: { type: "Polygon", coordinates: [[
      [-47.4082, -22.5584], [-47.4031, -22.5589], [-47.4027, -22.5621],
      [-47.4077, -22.5626], [-47.4082, -22.5584],
    ]] },
  },
  {
    id: "demo-plot-central",
    name: "Talhão Valência Central",
    source: "geojson",
    createdAt: "2026-09-01T12:00:00.000Z",
    geometry: { type: "Polygon", coordinates: [[
      [-47.4020, -22.5602], [-47.3970, -22.5600], [-47.3967, -22.5643],
      [-47.4016, -22.5646], [-47.4020, -22.5602],
    ]] },
  },
  {
    id: "demo-plot-sul",
    name: "Talhão Experimental Sul",
    source: "geojson",
    createdAt: "2026-09-01T12:00:00.000Z",
    geometry: { type: "Polygon", coordinates: [[
      [-47.4070, -22.5652], [-47.3998, -22.5651], [-47.3994, -22.5697],
      [-47.4063, -22.5700], [-47.4070, -22.5652],
    ]] },
  },
];

function detection(confidence: number, offset = 0): Detection {
  return {
    class_id: 0,
    class_name: "Acaro",
    confidence,
    bbox: { x1: 185 + offset, y1: 168 + offset, x2: 390 + offset, y2: 382 + offset },
  };
}

function daysAgo(days: number, hour: number) {
  const value = new Date();
  value.setDate(value.getDate() - days);
  value.setHours(hour, 15, 0, 0);
  return value.toISOString();
}

export function getDemoPlots(): Plot[] {
  return demoPlots.map((plot) => ({ ...plot, geometry: JSON.parse(JSON.stringify(plot.geometry)) as Plot["geometry"] }));
}

export function getDemoRecords(): InspectionRecord[] {
  return [
    {
      id: "demo-inspection-1", capturedAt: daysAgo(0, 8), imageUri: imageUris[0] || "", width: 640, height: 640,
      detections: [detection(0.98)], topConfidence: 0.98,
      location: { latitude: -22.5604, longitude: -47.4057, accuracy: 6, altitude: 582, source: "gps" },
      plotId: "demo-plot-norte", mapVisible: true, source: "camera", syncState: "local", demo: true,
    },
    {
      id: "demo-inspection-2", capturedAt: daysAgo(1, 15), imageUri: imageUris[1] || "", width: 640, height: 640,
      detections: [detection(0.97), detection(0.96, 34)], topConfidence: 0.97,
      location: { latitude: -22.5622, longitude: -47.3992, accuracy: 8, altitude: 576, source: "exif" },
      plotId: "demo-plot-central", mapVisible: true, source: "gallery", syncState: "local", demo: true,
    },
    {
      id: "demo-inspection-3", capturedAt: daysAgo(2, 10), imageUri: imageUris[2] || "", width: 640, height: 640,
      detections: [], topConfidence: 0.18,
      location: { latitude: -22.5674, longitude: -47.4034, accuracy: 5, altitude: 579, source: "gps" },
      plotId: "demo-plot-sul", mapVisible: true, source: "camera", syncState: "local", demo: true,
    },
    {
      id: "demo-inspection-4", capturedAt: daysAgo(5, 9), imageUri: imageUris[0] || "", width: 640, height: 640,
      detections: [detection(0.96)], topConfidence: 0.96,
      location: { latitude: -22.5613, longitude: -47.4042, accuracy: 7, altitude: 581, source: "gps" },
      plotId: "demo-plot-norte", mapVisible: true, source: "camera", syncState: "local", demo: true,
    },
    {
      id: "demo-inspection-5", capturedAt: daysAgo(8, 14), imageUri: imageUris[1] || "", width: 640, height: 640,
      detections: [detection(0.99)], topConfidence: 0.99,
      location: { latitude: -22.5631, longitude: -47.3982, accuracy: 9, altitude: 575, source: "exif" },
      plotId: "demo-plot-central", mapVisible: true, source: "gallery", syncState: "local", demo: true,
    },
  ];
}
