export function getCurrentPosition(options = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Este aparelho não oferece geolocalização."));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 15000,
      ...options,
    });
  });
}

function inRing(point, ring) {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function geometryContains(geometry, latitude, longitude) {
  if (!geometry || latitude == null || longitude == null) return false;
  const point = [longitude, latitude];
  const polygons = geometry.type === "Polygon"
    ? [geometry.coordinates]
    : geometry.type === "MultiPolygon"
      ? geometry.coordinates
      : [];
  return polygons.some((polygon) => {
    if (!polygon.length || !inRing(point, polygon[0])) return false;
    return !polygon.slice(1).some((hole) => inRing(point, hole));
  });
}

export function findPlot(plots, location) {
  if (!location) return null;
  return plots.find((plot) => geometryContains(plot.geometry, location.latitude, location.longitude)) || null;
}

const PLOT_GEOMETRY_TYPES = ["Polygon", "MultiPolygon"];

function validateDeclaredCrs(payload) {
  const crsName = payload?.crs?.properties?.name || payload?.crs?.name;
  if (!crsName) return;
  const normalized = String(crsName).toUpperCase();
  if (!normalized.includes("4326") && !normalized.includes("CRS84")) {
    throw new Error(`O arquivo declara "${crsName}". Exporte novamente em WGS84 (EPSG:4326).`);
  }
}

function normalizePosition(position, context) {
  if (!Array.isArray(position) || position.length < 2) {
    throw new Error(`${context}: cada ponto precisa ter [longitude, latitude].`);
  }
  const [longitude, latitude, ...extra] = position;
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
    throw new Error(`${context}: longitude e latitude precisam ser números.`);
  }
  if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
    throw new Error(`${context}: coordenada fora do WGS84. Use [longitude, latitude] em EPSG:4326.`);
  }
  return [longitude, latitude, ...extra.filter(Number.isFinite)];
}

function samePosition(first, last) {
  return first[0] === last[0] && first[1] === last[1];
}

function normalizeRing(ring, context) {
  if (!Array.isArray(ring) || ring.length < 3) {
    throw new Error(`${context}: o contorno precisa de pelo menos três pontos.`);
  }
  const normalized = ring.map((position, index) => normalizePosition(position, `${context}, ponto ${index + 1}`));
  if (!samePosition(normalized[0], normalized.at(-1))) normalized.push([...normalized[0]]);
  const distinct = new Set(normalized.slice(0, -1).map(([longitude, latitude]) => `${longitude},${latitude}`));
  if (distinct.size < 3) throw new Error(`${context}: use pelo menos três pontos diferentes.`);
  return normalized;
}

function normalizePolygonCoordinates(coordinates, context) {
  if (!Array.isArray(coordinates) || !coordinates.length) {
    throw new Error(`${context}: o polígono não possui contorno.`);
  }
  return coordinates.map((ring, index) => normalizeRing(
    ring,
    `${context}, ${index === 0 ? "limite externo" : `área interna ${index}`}`,
  ));
}

function normalizeGeometry(geometry, context) {
  if (geometry?.type === "Polygon") {
    return { ...geometry, coordinates: normalizePolygonCoordinates(geometry.coordinates, context) };
  }
  if (geometry?.type === "MultiPolygon") {
    if (!Array.isArray(geometry.coordinates) || !geometry.coordinates.length) {
      throw new Error(`${context}: o MultiPolygon não possui polígonos.`);
    }
    return {
      ...geometry,
      coordinates: geometry.coordinates.map((polygon, index) => (
        normalizePolygonCoordinates(polygon, `${context}, polígono ${index + 1}`)
      )),
    };
  }
  throw new Error(`${context}: tipo "${geometry?.type || "ausente"}" não aceito.`);
}

function extractFeatures(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("O arquivo não contém um objeto GeoJSON válido.");
  }
  validateDeclaredCrs(payload);
  if (payload.type === "FeatureCollection") {
    if (!Array.isArray(payload.features)) {
      throw new Error("A FeatureCollection precisa conter uma lista chamada features.");
    }
    return payload.features;
  }
  if (payload.type === "Feature") return [payload];
  if (PLOT_GEOMETRY_TYPES.includes(payload.type)) {
    return [{ type: "Feature", geometry: payload, properties: {} }];
  }
  throw new Error(`Tipo GeoJSON "${payload.type || "ausente"}" não aceito. Use Polygon, MultiPolygon ou FeatureCollection.`);
}

export function parsePlotGeoJson(payload) {
  const features = extractFeatures(payload);
  if (!features.length) throw new Error("A FeatureCollection está vazia.");

  const polygonFeatures = features.filter((feature) => PLOT_GEOMETRY_TYPES.includes(feature?.geometry?.type));
  const ignored = features.length - polygonFeatures.length;
  if (!polygonFeatures.length) {
    throw new Error("Nenhum limite de talhão foi encontrado. Inclua ao menos um Polygon ou MultiPolygon.");
  }

  const plots = polygonFeatures.map((feature, index) => ({
    id: crypto.randomUUID(),
    name: String(
      feature.properties?.name
        || feature.properties?.nome
        || feature.properties?.talhao
        || feature.properties?.id
        || `Talhão ${index + 1}`,
    ),
    geometry: normalizeGeometry(feature.geometry, `Talhão ${index + 1}`),
    createdAt: new Date().toISOString(),
    source: "geojson",
  }));

  return { plots, ignored };
}

export function normalizeGeoJson(payload) {
  return parsePlotGeoJson(payload).plots;
}

export function latLngsToPolygon(points) {
  if (points.length < 3) throw new Error("Marque pelo menos três pontos.");
  const ring = points.map(({ lat, lng }) => [lng, lat]);
  ring.push([...ring[0]]);
  return { type: "Polygon", coordinates: [ring] };
}

export function geometryToLatLngs(geometry) {
  if (geometry.type === "Polygon") {
    return geometry.coordinates.map((ring) => ring.map(([lng, lat]) => [lat, lng]));
  }
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.map((polygon) =>
      polygon.map((ring) => ring.map(([lng, lat]) => [lat, lng])),
    );
  }
  return [];
}

export function plotsToFeatureCollection(plots) {
  return {
    type: "FeatureCollection",
    features: plots.map((plot) => ({
      type: "Feature",
      id: plot.id,
      properties: { name: plot.name },
      geometry: plot.geometry,
    })),
  };
}
