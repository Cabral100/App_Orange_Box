export type Coordinates = {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  altitude?: number | null;
  source: "gps" | "exif";
};

export type Detection = {
  class_id: number;
  class_name: string;
  confidence: number;
  bbox: { x1: number; y1: number; x2: number; y2: number };
};

export type InferenceResult = {
  status: "detected" | "no_detection" | "inconclusive";
  detections: Detection[];
  detection_count: number;
  confidence_threshold: number;
  inference_ms: number;
  latency_ms: number;
  quality: {
    status: "adequate" | "inadequate";
    warnings: string[];
    metrics: { width: number; height: number; brightness: number; contrast: number };
  };
  location: {
    latitude: number;
    longitude: number;
    altitude_m?: number | null;
    accuracy_m?: number | null;
    source: "exif" | "device";
  } | null;
};

export type InspectionRecord = {
  id: string;
  capturedAt: string;
  imageUri: string;
  width: number;
  height: number;
  detections: Detection[];
  topConfidence: number;
  location: Coordinates | null;
  plotId: string | null;
  mapVisible: boolean;
  source: "camera" | "gallery";
  syncState: "local";
  demo?: boolean;
};

export type PhotoAnalysis = {
  imageUri: string;
  result: InferenceResult;
};

export type PhotoAnalyzer = (uri: string, width: number, height: number) => Promise<PhotoAnalysis>;

export type PolygonGeometry = {
  type: "Polygon";
  coordinates: number[][][];
};

export type MultiPolygonGeometry = {
  type: "MultiPolygon";
  coordinates: number[][][][];
};

export type Plot = {
  id: string;
  name: string;
  geometry: PolygonGeometry | MultiPolygonGeometry;
  createdAt: string;
  source: "drawn" | "geojson" | "estimated";
};

export type Session = {
  name: string;
  email: string;
};

export type AppSnapshot = {
  session: Session | null;
  records: InspectionRecord[];
  plots: Plot[];
};

export type TabId = "camera" | "map" | "history" | "dashboard" | "account";
