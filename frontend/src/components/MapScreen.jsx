import { useEffect, useMemo, useRef, useState } from "react";
import {
  Circle,
  CircleMarker,
  MapContainer,
  Polygon,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { buildReport, defaultPeriod, inPeriod, pestCount, recordPlot, severityFor } from "../lib/analytics";
import { removePlot, savePlot } from "../lib/db";
import {
  geometryToLatLngs,
  getCurrentPosition,
  latLngsToPolygon,
  parsePlotGeoJson,
  plotsToFeatureCollection,
} from "../lib/geo";

const OSM_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const SATELLITE_URL = import.meta.env.VITE_SATELLITE_TILE_URL
  || "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const SATELLITE_ATTRIBUTION = import.meta.env.VITE_SATELLITE_ATTRIBUTION
  || "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics";

function MapReady() {
  const map = useMap();
  useEffect(() => {
    const timeout = window.setTimeout(() => map.invalidateSize(), 80);
    return () => window.clearTimeout(timeout);
  }, [map]);
  return null;
}

function MapTapHandler({ active, onPoint }) {
  useMapEvents({ click: (event) => active && onPoint(event.latlng) });
  return null;
}

function MapController({ target }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo([target.latitude, target.longitude], Math.max(map.getZoom(), 18), { duration: 0.7 });
  }, [map, target]);
  return null;
}

function firstRealCenter(records, plots) {
  const located = records.find((record) => record.location);
  if (located) return [located.location.latitude, located.location.longitude];
  const coordinates = plots[0]?.geometry?.coordinates;
  const first = plots[0]?.geometry?.type === "Polygon"
    ? coordinates?.[0]?.[0]
    : coordinates?.[0]?.[0]?.[0];
  return first ? [first[1], first[0]] : [-14.235, -51.9253];
}

function downloadGeoJson(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/geo+json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.hidden = true;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1200);
}

export default function MapScreen({ records, plots, onPlotsChanged, notify }) {
  const importRef = useRef(null);
  const initialPeriod = useMemo(defaultPeriod, []);
  const [from, setFrom] = useState(initialPeriod.from);
  const [to, setTo] = useState(initialPeriod.to);
  const [baseLayer, setBaseLayer] = useState("satellite");
  const [currentLocation, setCurrentLocation] = useState(null);
  const [locationError, setLocationError] = useState("");
  const [drawMode, setDrawMode] = useState(false);
  const [draftPoints, setDraftPoints] = useState([]);
  const [pendingGeometry, setPendingGeometry] = useState(null);
  const [plotName, setPlotName] = useState("");
  const [selectedPlot, setSelectedPlot] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(true);
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpTopic, setHelpTopic] = useState("draw");
  const mappedRecords = useMemo(() => records.filter((record) => record.mapVisible !== false), [records]);
  const initialCenter = useMemo(() => firstRealCenter(mappedRecords, plots), [mappedRecords, plots]);
  const report = useMemo(() => buildReport(mappedRecords, plots, from, to), [from, mappedRecords, plots, to]);
  const reportByPlot = useMemo(() => Object.fromEntries(report.rows.map((row) => [row.plot.id, row])), [report]);
  const filteredRecords = useMemo(() => mappedRecords.filter((record) => (
    record.location && inPeriod(record, report.currentBounds.start, report.currentBounds.end)
  )), [mappedRecords, report]);

  useEffect(() => {
    locate(false);
    // A posição é solicitada ao abrir e pode ser atualizada pelo botão GPS.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!helpOpen) return undefined;
    function closeOnEscape(event) {
      if (event.key === "Escape") setHelpOpen(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [helpOpen]);

  async function locate(reportError = true) {
    setLocationError("");
    try {
      const position = await getCurrentPosition();
      setCurrentLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      });
    } catch (error) {
      setLocationError("GPS indisponível");
      if (reportError) notify({ tone: "danger", message: error.message || "Não foi possível obter o GPS." });
    }
  }

  function beginDraw() {
    setSelectedPlot(null);
    setDraftPoints([]);
    setDrawMode(true);
    setSheetOpen(false);
  }

  function finishDraw() {
    try {
      setPendingGeometry(latLngsToPolygon(draftPoints));
      setPlotName(`Talhão ${plots.length + 1}`);
      setDrawMode(false);
    } catch (error) {
      notify({ tone: "danger", message: error.message });
    }
  }

  async function confirmPlot(event) {
    event.preventDefault();
    const plot = {
      id: crypto.randomUUID(),
      name: plotName.trim() || `Talhão ${plots.length + 1}`,
      geometry: pendingGeometry,
      createdAt: new Date().toISOString(),
      source: "drawn",
    };
    await savePlot(plot);
    setPendingGeometry(null);
    setDraftPoints([]);
    setSheetOpen(true);
    await onPlotsChanged();
    notify({ tone: "success", message: `${plot.name} salvo com limites reais.` });
  }

  async function importGeoJson(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const { plots: imported, ignored } = parsePlotGeoJson(JSON.parse(await file.text()));
      await Promise.all(imported.map(savePlot));
      await onPlotsChanged();
      const importedMessage = imported.length === 1 ? "1 talhão importado." : `${imported.length} talhões importados.`;
      const ignoredMessage = ignored
        ? ` ${ignored} ${ignored === 1 ? "item que não era polígono foi ignorado" : "itens que não eram polígonos foram ignorados"}.`
        : "";
      notify({ tone: "success", message: `${importedMessage}${ignoredMessage}` });
    } catch (error) {
      const message = error instanceof SyntaxError
        ? "Não foi possível ler o arquivo. Verifique se ele é um GeoJSON ou JSON válido."
        : error.message || "GeoJSON inválido.";
      notify({ tone: "danger", message });
    }
  }

  function chooseGeoJson() {
    setHelpOpen(false);
    window.setTimeout(() => importRef.current?.click(), 0);
  }

  function drawFromHelp() {
    setHelpOpen(false);
    beginDraw();
  }

  async function deleteSelectedPlot() {
    if (!selectedPlot || !window.confirm(`Remover o limite de ${selectedPlot.name}?`)) return;
    await removePlot(selectedPlot.id);
    setSelectedPlot(null);
    await onPlotsChanged();
    notify({ tone: "success", message: "Talhão removido deste aparelho." });
  }

  function changeFrom(value) {
    if (!value) return;
    setFrom(value);
    if (value > to) setTo(value);
  }

  function changeTo(value) {
    if (!value) return;
    setTo(value);
    if (value < from) setFrom(value);
  }

  const selectedRow = selectedPlot ? reportByPlot[selectedPlot.id] : null;
  const selectedPhotos = selectedPlot
    ? mappedRecords.filter((record) => inPeriod(record, report.currentBounds.start, report.currentBounds.end)
      && recordPlot(record, plots)?.id === selectedPlot.id).length
    : 0;

  return (
    <section className="map-screen">
      <MapContainer center={initialCenter} zoom={plots.length || filteredRecords.length ? 17 : 4} zoomControl={false} className="field-map">
        <MapReady />
        <MapController target={currentLocation} />
        <MapTapHandler active={drawMode} onPoint={(point) => setDraftPoints((current) => [...current, point])} />
        {baseLayer === "satellite" ? (
          <TileLayer url={SATELLITE_URL} attribution={SATELLITE_ATTRIBUTION} maxZoom={20} />
        ) : (
          <TileLayer url={OSM_URL} attribution="© OpenStreetMap contributors" maxZoom={19} />
        )}

        {plots.map((plot) => {
          const row = reportByPlot[plot.id];
          const selected = selectedPlot?.id === plot.id;
          return (
            <Polygon
              key={plot.id}
              positions={geometryToLatLngs(plot.geometry)}
              pathOptions={{
                color: selected ? "#ffffff" : row.severity.color,
                weight: selected ? 4 : 2.5,
                fillColor: row.severity.color,
                fillOpacity: selected ? 0.68 : 0.54,
              }}
              eventHandlers={{ click: () => { setSelectedPlot(plot); setSheetOpen(true); } }}
            >
              <Tooltip direction="center" permanent className="plot-label">{plot.name} · {row.count}</Tooltip>
            </Polygon>
          );
        })}

        {draftPoints.length > 0 && (
          <>
            <Polyline positions={draftPoints} pathOptions={{ color: "#ffffff", weight: 4, dashArray: "7 7" }} />
            {draftPoints.map((point, index) => (
              <CircleMarker key={`${point.lat}-${point.lng}-${index}`} center={point} radius={6} pathOptions={{ color: "#176a40", fillColor: "#ffffff", fillOpacity: 1 }} />
            ))}
          </>
        )}

        {currentLocation && (
          <>
            <CircleMarker center={[currentLocation.latitude, currentLocation.longitude]} radius={8} pathOptions={{ color: "#fff", weight: 3, fillColor: "#1677ff", fillOpacity: 1 }}>
              <Popup>Você está aqui<br />Precisão aproximada: {Math.round(currentLocation.accuracy)} m</Popup>
            </CircleMarker>
            <Circle center={[currentLocation.latitude, currentLocation.longitude]} radius={currentLocation.accuracy} pathOptions={{ color: "#4da9ff", weight: 1, fillColor: "#4da9ff", fillOpacity: 0.13 }} interactive={false} />
          </>
        )}

        {filteredRecords.map((record) => (
          <CircleMarker key={record.id} center={[record.location.latitude, record.location.longitude]} radius={7} pathOptions={{ color: "#fff", weight: 2, fillColor: severityFor(pestCount(record)).color, fillOpacity: 1 }}>
            <Popup>
              <strong>{pestCount(record)} praga(s) · {Math.round(record.topConfidence * 100)}%</strong><br />
              {recordPlot(record, plots)?.name || "Talhão não confirmado"}<br />
              {record.location.source === "exif" ? "Coordenada EXIF" : "GPS do celular"}<br />
              {new Date(record.capturedAt).toLocaleString("pt-BR")}
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>

      <header className="map-header">
        <div className="map-brand"><strong>CYF</strong><span>Visão do campo</span></div>
        <button type="button" onClick={() => setBaseLayer((layer) => layer === "satellite" ? "streets" : "satellite")}>
          {baseLayer === "satellite" ? "Mapa" : "Satélite"}
        </button>
      </header>

      <div className="map-period" aria-label="Período exibido no mapa">
        <label>De<input type="date" value={from} max={to} onChange={(event) => changeFrom(event.target.value)} /></label>
        <label>Até<input type="date" value={to} min={from} onChange={(event) => changeTo(event.target.value)} /></label>
      </div>

      <aside className="severity-legend" aria-label="Legenda de pragas por talhão">
        <strong>Pragas</strong>
        <span><i className="legend-clear" />0</span>
        <span><i className="legend-attention" />1–20</span>
        <span><i className="legend-critical" />&gt;20</span>
      </aside>

      <div className="map-actions">
        <button type="button" onClick={() => locate(true)}>GPS</button>
        <button type="button" onClick={() => { setSelectedPlot(null); setSheetOpen(true); }}>Talhões</button>
      </div>

      {drawMode && (
        <div className="draw-toolbar">
          <div><strong>Toque nos cantos</strong><span>{draftPoints.length} ponto(s)</span></div>
          <button type="button" onClick={() => setDraftPoints((points) => points.slice(0, -1))} disabled={!draftPoints.length}>Desfazer</button>
          <button type="button" onClick={() => { setDrawMode(false); setDraftPoints([]); setSheetOpen(true); }}>Cancelar</button>
          <button className="draw-confirm" type="button" onClick={finishDraw} disabled={draftPoints.length < 3}>Concluir</button>
        </div>
      )}

      {sheetOpen && !drawMode && (
        <aside className="map-sheet">
          <button className="sheet-pull" type="button" onClick={() => setSheetOpen(false)} aria-label="Recolher painel"><span /></button>
          {selectedPlot ? (
            <div className="map-sheet-content">
              <div className="sheet-title-row">
                <div><p className="overline">TALHÃO SELECIONADO</p><h2>{selectedPlot.name}</h2></div>
                <span className={`severity-badge ${selectedRow?.severity.id}`}>{selectedRow?.count || 0} pragas</span>
              </div>
              <div className="field-summary-grid">
                <div><strong>{selectedPhotos}</strong><span>fotos no período</span></div>
                <div><strong>{selectedRow?.previousCount || 0}</strong><span>período anterior</span></div>
                <div><strong>{selectedRow?.delta > 0 ? "+" : ""}{selectedRow?.delta || 0}</strong><span>variação</span></div>
              </div>
              <div className="sheet-actions two">
                <button className="secondary-action" type="button" onClick={() => downloadGeoJson(`${selectedPlot.name}.geojson`, plotsToFeatureCollection([selectedPlot]))}>Exportar limite</button>
                <button className="danger-action" type="button" onClick={deleteSelectedPlot}>Remover limite</button>
              </div>
              <button className="text-action" type="button" onClick={() => setSelectedPlot(null)}>Ver todos os talhões</button>
            </div>
          ) : (
            <div className="map-sheet-content">
              <div className="sheet-title-row">
                <div><p className="overline">MAPA OPERACIONAL</p><h2>{plots.length ? "Talhões da propriedade" : "Configure os talhões"}</h2></div>
                <span className="count-badge">{report.total} pragas</span>
              </div>
              <p className="sheet-muted">{plots.length
                ? "As cores usam as ocorrências reais do período selecionado. Fotos são associadas pelo GPS/EXIF dentro do polígono."
                : "Importe um GeoJSON WGS84 ou desenhe os limites diretamente sobre a imagem de satélite."}</p>
              {locationError && <p className="inline-warning">{locationError}. O mapa continua disponível.</p>}
              <div className="sheet-actions two">
                <button className="primary-action" type="button" onClick={beginDraw}>Desenhar</button>
                <button className="secondary-action" type="button" onClick={() => importRef.current?.click()}>Importar GeoJSON</button>
                <input ref={importRef} hidden type="file" accept=".geojson,.json,application/geo+json,application/json" onChange={importGeoJson} />
              </div>
              <button className="map-help-link" type="button" onClick={() => setHelpOpen(true)}>Como adicionar e usar os limites?</button>
              {plots.length > 0 && <button className="text-action" type="button" onClick={() => downloadGeoJson("talhoes-cyf.geojson", plotsToFeatureCollection(plots))}>Exportar todos os limites</button>}
            </div>
          )}
        </aside>
      )}

      {helpOpen && (
        <div className="modal-backdrop map-help-backdrop">
          <section className="map-help-dialog" role="dialog" aria-modal="true" aria-labelledby="map-help-title" aria-describedby="map-help-intro">
            <header className="map-help-header">
              <div>
                <p className="overline">LIMITES DOS TALHÕES</p>
                <h2 id="map-help-title">Como adicionar no mapa</h2>
              </div>
              <button type="button" onClick={() => setHelpOpen(false)} aria-label="Fechar ajuda" autoFocus>Fechar</button>
            </header>

            <p className="map-help-intro" id="map-help-intro">O limite permite saber em qual talhão cada foto foi feita e colore a área conforme as pragas registradas no período.</p>

            <div className="map-help-tabs" role="group" aria-label="Forma de adicionar um talhão">
              <button type="button" aria-pressed={helpTopic === "draw"} onClick={() => setHelpTopic("draw")}>Desenhar no mapa</button>
              <button type="button" aria-pressed={helpTopic === "import"} onClick={() => setHelpTopic("import")}>Importar arquivo</button>
            </div>

            {helpTopic === "draw" ? (
              <div className="map-help-panel">
                <p className="map-help-best-for"><strong>Mais simples</strong> para cadastrar um talhão durante a visita ao campo.</p>
                <ol className="map-help-steps">
                  <li><span>1</span><div><strong>Localize a área</strong><p>Use GPS e aproxime a imagem de satélite até enxergar as divisas.</p></div></li>
                  <li><span>2</span><div><strong>Marque os cantos</strong><p>Toque em cada canto do talhão, seguindo a borda em sequência. São necessários pelo menos 3 pontos.</p></div></li>
                  <li><span>3</span><div><strong>Confira e salve</strong><p>Use Desfazer se errar, toque em Concluir e dê um nome à área.</p></div></li>
                </ol>
                <button className="primary-action map-help-cta" type="button" onClick={drawFromHelp}>Começar a desenhar</button>
              </div>
            ) : (
              <div className="map-help-panel">
                <p className="map-help-best-for"><strong>Mais rápido</strong> quando os limites já foram exportados de outro sistema.</p>
                <ol className="map-help-steps">
                  <li><span>1</span><div><strong>Exporte em WGS84</strong><p>No sistema de origem, escolha GeoJSON e o sistema EPSG:4326.</p></div></li>
                  <li><span>2</span><div><strong>Confirme o conteúdo</strong><p>Use Polygon, MultiPolygon ou FeatureCollection. As coordenadas devem estar na ordem longitude, latitude.</p></div></li>
                  <li><span>3</span><div><strong>Selecione o arquivo</strong><p>Envie um arquivo .geojson ou .json. O nome pode vir em name, nome, talhao ou id.</p></div></li>
                </ol>
                <div className="map-help-note"><strong>Exemplo de coordenada WGS84</strong><code>[-47.1234, -22.5678]</code><span>longitude primeiro, latitude depois</span></div>
                <button className="primary-action map-help-cta" type="button" onClick={chooseGeoJson}>Escolher GeoJSON</button>
              </div>
            )}

            <p className="map-help-result"><strong>Depois de salvar:</strong> fotos com GPS ou EXIF dentro do limite entram nesse talhão. A cor fica verde com 0, amarela com 1–20 e vermelha acima de 20 registros de praga.</p>
          </section>
        </div>
      )}

      {pendingGeometry && (
        <div className="modal-backdrop">
          <form className="mobile-dialog" onSubmit={confirmPlot}>
            <p className="overline">NOVO TALHÃO</p>
            <h2>Nomeie esta área</h2>
            <p>O contorno será salvo localmente e usado na próxima captura.</p>
            <label>Nome do talhão<input value={plotName} onChange={(event) => setPlotName(event.target.value)} autoFocus maxLength={80} /></label>
            <div className="dialog-actions">
              <button className="secondary-action" type="button" onClick={() => { setPendingGeometry(null); setDraftPoints([]); setSheetOpen(true); }}>Cancelar</button>
              <button className="primary-action" type="submit">Salvar talhão</button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
