import type { Coordinates, MultiPolygonGeometry, Plot, PolygonGeometry } from "./types";

type GeoJsonGeometry = PolygonGeometry | MultiPolygonGeometry;
type GeoJsonFeature = { type: "Feature"; properties?: Record<string, unknown>; geometry?: GeoJsonGeometry };

function inRing(point: [number, number], ring: number[][]) {
  const [x, y] = point;
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const currentPoint = ring[index];
    const previousPoint = ring[previous];
    if (!currentPoint || !previousPoint) continue;
    const [xi = 0, yi = 0] = currentPoint;
    const [xj = 0, yj = 0] = previousPoint;
    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function geometryContains(geometry: GeoJsonGeometry, location: Coordinates) {
  const point: [number, number] = [location.longitude, location.latitude];
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  return polygons.some((polygon) => {
    const outer = polygon[0];
    if (!outer || !inRing(point, outer)) return false;
    return !polygon.slice(1).some((hole) => inRing(point, hole));
  });
}

export function findPlot(plots: Plot[], location: Coordinates | null) {
  if (!location) return null;
  return plots.find((plot) => geometryContains(plot.geometry, location)) || null;
}

function normalizePosition(position: unknown, context: string): number[] {
  if (!Array.isArray(position) || position.length < 2) {
    throw new Error(`${context}: use pontos no formato [longitude, latitude].`);
  }
  const longitude = Number(position[0]);
  const latitude = Number(position[1]);
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
    throw new Error(`${context}: longitude e latitude precisam ser números.`);
  }
  if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
    throw new Error(`${context}: coordenada fora de WGS84/EPSG:4326.`);
  }
  return [longitude, latitude];
}

function normalizeRing(value: unknown, context: string): number[][] {
  if (!Array.isArray(value) || value.length < 3) throw new Error(`${context}: use pelo menos três pontos.`);
  const ring = value.map((point, index) => normalizePosition(point, `${context}, ponto ${index + 1}`));
  const first = ring[0];
  const last = ring.at(-1);
  if (!first || !last) throw new Error(`${context}: contorno vazio.`);
  if (first[0] !== last[0] || first[1] !== last[1]) ring.push([...first]);
  if (new Set(ring.slice(0, -1).map(([lng, lat]) => `${lng},${lat}`)).size < 3) {
    throw new Error(`${context}: use três pontos diferentes.`);
  }
  return ring;
}

function normalizePolygon(value: unknown, context: string): number[][][] {
  if (!Array.isArray(value) || value.length === 0) throw new Error(`${context}: polígono sem contorno.`);
  return value.map((ring, index) => normalizeRing(ring, `${context}, anel ${index + 1}`));
}

function normalizeGeometry(value: unknown, context: string): GeoJsonGeometry {
  const geometry = value as { type?: string; coordinates?: unknown } | null;
  if (geometry?.type === "Polygon") {
    return { type: "Polygon", coordinates: normalizePolygon(geometry.coordinates, context) };
  }
  if (geometry?.type === "MultiPolygon") {
    if (!Array.isArray(geometry.coordinates) || geometry.coordinates.length === 0) {
      throw new Error(`${context}: MultiPolygon vazio.`);
    }
    return {
      type: "MultiPolygon",
      coordinates: geometry.coordinates.map((polygon, index) => normalizePolygon(polygon, `${context}, polígono ${index + 1}`)),
    };
  }
  throw new Error(`${context}: use Polygon ou MultiPolygon.`);
}

export function parsePlotGeoJson(payload: unknown): { plots: Plot[]; ignored: number } {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("GeoJSON inválido.");
  const root = payload as Record<string, unknown>;
  const declaredCrs = (root.crs as { properties?: { name?: string }; name?: string } | undefined);
  const crsName = declaredCrs?.properties?.name || declaredCrs?.name;
  if (crsName && !/4326|CRS84/i.test(crsName)) throw new Error("Exporte o arquivo em WGS84 (EPSG:4326).");

  let features: GeoJsonFeature[];
  if (root.type === "FeatureCollection") {
    if (!Array.isArray(root.features)) throw new Error("FeatureCollection sem lista de feições.");
    features = root.features as GeoJsonFeature[];
  } else if (root.type === "Feature") {
    features = [root as unknown as GeoJsonFeature];
  } else if (root.type === "Polygon" || root.type === "MultiPolygon") {
    features = [{ type: "Feature", geometry: root as unknown as GeoJsonGeometry }];
  } else {
    throw new Error("Use Polygon, MultiPolygon ou FeatureCollection.");
  }

  const accepted = features.filter((feature) => feature.geometry?.type === "Polygon" || feature.geometry?.type === "MultiPolygon");
  if (!accepted.length) throw new Error("Nenhum limite de talhão foi encontrado.");
  return {
    ignored: features.length - accepted.length,
    plots: accepted.map((feature, index) => ({
      id: globalThis.crypto?.randomUUID?.() || `plot-${Date.now()}-${index}`,
      name: String(feature.properties?.name || feature.properties?.nome || feature.properties?.talhao || `Talhão ${index + 1}`),
      geometry: normalizeGeometry(feature.geometry, `Talhão ${index + 1}`),
      createdAt: new Date().toISOString(),
      source: "geojson" as const,
    })),
  };
}

export function drawnPolygon(points: { latitude: number; longitude: number }[]): PolygonGeometry {
  if (points.length < 3) throw new Error("Marque pelo menos três pontos no mapa.");
  const ring = points.map((point) => [point.longitude, point.latitude]);
  const first = ring[0];
  if (first) ring.push([...first]);
  return { type: "Polygon", coordinates: [ring] };
}

export function polygonAroundArea(location: Coordinates, areaSquareMeters: number, segments = 32): PolygonGeometry {
  if (!Number.isFinite(areaSquareMeters) || areaSquareMeters < 25 || areaSquareMeters > 100_000_000) {
    throw new Error("Informe uma área entre 25 e 100.000.000 m².");
  }
  const earthRadius = 6_378_137;
  const radius = Math.sqrt(areaSquareMeters / Math.PI);
  const latitudeRadians = location.latitude * Math.PI / 180;
  const ring = Array.from({ length: segments }, (_, index) => {
    const angle = index / segments * Math.PI * 2;
    const north = Math.cos(angle) * radius;
    const east = Math.sin(angle) * radius;
    const latitude = location.latitude + north / earthRadius * 180 / Math.PI;
    const longitude = location.longitude + east / (earthRadius * Math.max(0.01, Math.cos(latitudeRadians))) * 180 / Math.PI;
    return [longitude, latitude];
  });
  const first = ring[0];
  if (first) ring.push([...first]);
  return { type: "Polygon", coordinates: [ring] };
}

export function geometryRings(geometry: GeoJsonGeometry) {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  return polygons.map((polygon) => (polygon[0] || []).map(([longitude = 0, latitude = 0]) => ({ latitude, longitude })));
}
