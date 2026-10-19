import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildReport,
  defaultPeriod,
  downloadBlob,
  formatChange,
  inPeriod,
  pestCount,
  recordPlot,
  reportToCsv,
  reportToDashboardHtml,
} from "../lib/analytics";
import { removeDetection, saveDetection } from "../lib/db";

function useObjectUrl(blob) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!blob) return undefined;
    const next = URL.createObjectURL(blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [blob]);
  return url;
}

function dateParts(value) {
  const date = new Date(value);
  return {
    date: date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }),
    time: date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
  };
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function RecordPhoto({ record, className = "" }) {
  const url = useObjectUrl(record.image);
  return url
    ? <img className={className} src={url} alt={`Inspeção registrada em ${dateParts(record.capturedAt).date}`} />
    : <div className={`photo-fallback ${className}`}>Foto indisponível</div>;
}

function recordsGeoJson(records, plots) {
  return {
    type: "FeatureCollection",
    features: records.filter((record) => record.location).map((record) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [record.location.longitude, record.location.latitude] },
      properties: {
        id: record.id,
        capturedAt: record.capturedAt,
        detectionCount: pestCount(record),
        highestModelConfidence: record.topConfidence,
        className: pestCount(record) > 0 ? record.detections?.[0]?.class_name || "Acaro" : null,
        detectionStatus: pestCount(record) > 0 ? "confirmed" : "none_confirmed",
        plot: recordPlot(record, plots)?.name || null,
        accuracyM: record.location.accuracy ?? null,
        locationSource: record.location.source,
      },
    })),
  };
}

function DashboardPreview({ report }) {
  const maxCount = Math.max(1, ...report.rows.flatMap((row) => [row.count, row.previousCount]));

  return (
    <section className="dashboard-preview" aria-labelledby="dashboard-preview-title">
      <div className="dashboard-preview-heading">
        <div><p className="overline">DASHBOARD</p><h2 id="dashboard-preview-title">Visão do período</h2></div>
        <span>Atual × anterior</span>
      </div>
      <div className="dashboard-preview-kpis" aria-label="Resumo do dashboard">
        <article><strong>{report.total}</strong><span>atual</span></article>
        <article><strong>{report.previousTotal}</strong><span>anterior</span></article>
        <article><strong>{report.delta > 0 ? "+" : ""}{report.delta}</strong><span>variação</span></article>
      </div>
      {report.rows.length === 0 ? (
        <p className="dashboard-empty">Delimite talhões no mapa para visualizar a distribuição.</p>
      ) : (
        <div className="dashboard-bars" aria-label="Comparação de ocorrências por talhão">
          {report.rows.map((row) => {
            const currentWidth = row.count === 0 ? 0 : Math.max(3, (row.count / maxCount) * 100);
            const previousWidth = row.previousCount === 0 ? 0 : Math.max(3, (row.previousCount / maxCount) * 100);
            return (
              <article className="dashboard-bar-row" key={row.plot.id} aria-label={`${row.plot.name}: ${row.count} no período atual e ${row.previousCount} no anterior`}>
                <div><strong>{row.plot.name}</strong><span>{row.count} atual · {row.previousCount} anterior</span></div>
                <div className="dashboard-bar-track" aria-hidden="true">
                  <i style={{ width: `${currentWidth}%`, background: row.severity.color }} />
                  <i className="previous" style={{ width: `${previousWidth}%` }} />
                </div>
              </article>
            );
          })}
        </div>
      )}
      <div className="dashboard-legend" aria-label="Legenda dos níveis">
        <span><i className="clear" />0</span>
        <span><i className="attention" />1–20</span>
        <span><i className="critical" />Mais de 20</span>
        <span><i className="previous" />Período anterior</span>
      </div>
    </section>
  );
}

export default function RecordsScreen({ records, plots, onChanged, onOpenCamera, notify }) {
  const initialPeriod = useMemo(defaultPeriod, []);
  const [from, setFrom] = useState(initialPeriod.from);
  const [to, setTo] = useState(initialPeriod.to);
  const [plotFilter, setPlotFilter] = useState("all");
  const [selected, setSelected] = useState(null);
  const detailCloseRef = useRef(null);
  const report = useMemo(() => buildReport(records, plots, from, to), [from, plots, records, to]);
  const filtered = useMemo(() => records.filter((record) => {
    if (!inPeriod(record, report.currentBounds.start, report.currentBounds.end)) return false;
    const plot = recordPlot(record, plots);
    if (plotFilter === "unassigned") return !plot;
    return plotFilter === "all" || plot?.id === plotFilter;
  }), [plotFilter, plots, records, report]);

  useEffect(() => {
    if (!selected) return undefined;
    const previouslyFocused = document.activeElement;
    const focusTimer = window.setTimeout(() => detailCloseRef.current?.focus(), 0);
    function handleDialogKey(event) {
      if (event.key === "Escape") {
        setSelected(null);
        return;
      }
      if (event.key !== "Tab") return;
      const overlay = detailCloseRef.current?.closest(".detail-overlay");
      const focusable = [...(overlay?.querySelectorAll("button:not([disabled]), select:not([disabled])") || [])];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", handleDialogKey);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", handleDialogKey);
      previouslyFocused?.focus?.();
    };
  }, [selected]);

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

  function exportCsv() {
    downloadBlob(`relatorio-cyf-${from}-a-${to}.csv`, reportToCsv(report), "text/csv;charset=utf-8");
    notify({ tone: "success", message: "Relatório CSV extraído com o período selecionado." });
  }

  function exportGeoJson() {
    downloadBlob(
      `ocorrencias-cyf-${from}-a-${to}.geojson`,
      JSON.stringify(recordsGeoJson(filtered, plots), null, 2),
      "application/geo+json",
    );
    notify({ tone: "success", message: "Ocorrências localizadas exportadas em GeoJSON." });
  }

  async function exportDashboard() {
    const popup = window.open("", "_blank");
    let embeddedFont = "";
    try {
      const response = await fetch("/fonts/Inter-latin.woff2");
      if (response.ok) embeddedFont = await blobToDataUrl(await response.blob());
    } catch {
      // O dashboard continua disponível com a fonte de fallback do sistema.
    }
    const html = reportToDashboardHtml(report, embeddedFont);
    if (!popup) {
      downloadBlob(`dashboard-cyf-${from}-a-${to}.html`, html, "text/html;charset=utf-8");
      notify({ tone: "success", message: "Dashboard baixado em HTML. Abra o arquivo para imprimir ou salvar em PDF." });
      return;
    }
    popup.opener = null;
    popup.document.open();
    popup.document.write(html);
    popup.document.close();
    popup.focus();
    Promise.race([
      popup.document.fonts?.ready || Promise.resolve(),
      new Promise((resolve) => window.setTimeout(resolve, 1600)),
    ]).then(() => window.setTimeout(() => popup.print(), 120));
    notify({ tone: "success", message: "Dashboard aberto. No diálogo, escolha Salvar como PDF." });
  }

  async function deleteRecord(record) {
    if (!window.confirm("Remover esta foto e seus dados deste aparelho?")) return;
    await removeDetection(record.id);
    setSelected(null);
    await onChanged();
    notify({ tone: "success", message: "Registro removido deste aparelho." });
  }

  async function changeRecordPlot(value) {
    if (!selected) return;
    const chosen = plots.find((plot) => plot.id === value);
    const updated = {
      ...selected,
      manualPlotId: value === "auto" ? null : value,
      plotId: chosen?.id || selected.plotId || null,
      plotName: chosen?.name || selected.plotName || null,
      plotCorrectedAt: value === "auto" ? null : new Date().toISOString(),
    };
    await saveDetection(updated);
    setSelected(updated);
    await onChanged();
    notify({ tone: "success", message: value === "auto" ? "Associação automática restaurada." : "Talhão do registro atualizado." });
  }

  const selectedPlot = selected ? recordPlot(selected, plots) : null;

  return (
    <section className="content-screen reports-screen">
      <header className="reports-header">
        <div><p className="overline">DADOS REAIS DE CAMPO</p><h1>Relatórios</h1></div>
        <span className="report-period-label">Comparação automática</span>
      </header>

      <section className="period-card" aria-label="Período do relatório">
        <label>Data inicial<input type="date" value={from} max={to} onChange={(event) => changeFrom(event.target.value)} /></label>
        <label>Data final<input type="date" value={to} min={from} onChange={(event) => changeTo(event.target.value)} /></label>
        <label className="plot-filter">Filtrar as fotos por talhão<select value={plotFilter} onChange={(event) => setPlotFilter(event.target.value)}>
          <option value="all">Todos os talhões</option>
          {plots.map((plot) => <option key={plot.id} value={plot.id}>{plot.name}</option>)}
          <option value="unassigned">Sem talhão confirmado</option>
        </select></label>
        <small className="plot-filter-note">Este filtro afeta as evidências e o GeoJSON. O dashboard, CSV e PDF continuam mostrando toda a propriedade.</small>
      </section>

      <section className="report-overview">
        <article className="metric-primary">
          <span>Pragas no período</span>
          <strong>{report.total}</strong>
          <small className={report.delta > 0 ? "trend-up" : report.delta < 0 ? "trend-down" : ""}>
            {formatChange(report.delta, report.percent)} em relação ao período anterior
          </small>
        </article>
        <div className="metric-pair">
          <article><strong>{report.photos}</strong><span>fotos salvas</span></article>
          <article><strong>{report.unassigned}</strong><span>pragas sem talhão</span></article>
        </div>
      </section>

      <section className="change-highlights">
        <article>
          <span>Maior aumento absoluto</span>
          <strong>{report.increased?.plot.name || "Nenhum aumento"}</strong>
          <small>{report.increased ? `+${report.increased.delta} pragas` : "Sem alta no período"}</small>
        </article>
        <article>
          <span>Maior redução absoluta</span>
          <strong>{report.decreased?.plot.name || "Nenhuma redução"}</strong>
          <small>{report.decreased ? `${report.decreased.delta} pragas` : "Sem queda no período"}</small>
        </article>
      </section>

      <DashboardPreview report={report} />

      <section className="report-section">
        <div className="section-heading"><div><p className="overline">POR TALHÃO</p><h2>Contagem e tendência</h2></div></div>
        {plots.length === 0 ? (
          <p className="inline-empty">Adicione limites de talhões no mapa para gerar a comparação por área.</p>
        ) : (
          <div className="plot-report-table" role="table" aria-label="Contagem e tendência por talhão">
            <div className="plot-report-head" role="row"><span role="columnheader">Talhão</span><span role="columnheader">Atual</span><span role="columnheader">Variação</span></div>
            {report.rows.map((row) => (
              <div className="plot-report-row" role="row" key={row.plot.id}>
                <span role="cell"><i style={{ background: row.severity.color }} /> <b>{row.plot.name}</b><small>{row.severity.label}</small></span>
                <strong role="cell">{row.count}</strong>
                <em role="cell" className={row.delta > 0 ? "trend-up" : row.delta < 0 ? "trend-down" : ""}>{formatChange(row.delta, row.percent)}</em>
              </div>
            ))}
          </div>
        )}
        <p className="metric-definition">Métrica: quantidade de caixas com confiança do modelo ≥95% nas fotos salvas, não área infestada. “0” significa sem registro no período, não ausência comprovada de praga.</p>
      </section>

      <section className="export-card">
        <div><p className="overline">EXTRAÇÃO</p><h2>Leve os dados para análise</h2><p>Exporte o dashboard visual em PDF, a planilha completa em CSV ou os pontos localizados em GeoJSON.</p></div>
        <div className="export-actions">
          <button className="dashboard-export-action" type="button" onClick={exportDashboard}>Imprimir / salvar dashboard em PDF</button>
          <button className="primary-action" type="button" onClick={exportCsv}>Baixar CSV</button>
          <button className="secondary-action" type="button" onClick={exportGeoJson} disabled={!filtered.some((record) => record.location)}>Baixar GeoJSON</button>
        </div>
      </section>

      <section className="report-section records-section">
        <div className="section-heading">
          <div><p className="overline">EVIDÊNCIAS</p><h2>Fotos do período</h2></div>
          <span>{filtered.length} registro(s)</span>
        </div>
        {filtered.length === 0 ? (
          <div className="records-empty">
            <h3>Nenhum registro neste filtro.</h3>
            <p>Altere o período ou faça uma nova inspeção. O CYF não preenche métricas com dados simulados.</p>
            <button className="primary-action" type="button" onClick={onOpenCamera}>Abrir câmera</button>
          </div>
        ) : (
          <div className="record-list">
            {filtered.map((record) => {
              const date = dateParts(record.capturedAt);
              const plot = recordPlot(record, plots);
              return (
                <button className="record-card" type="button" key={record.id} onClick={() => setSelected(record)}>
                  <div className="record-photo-wrap"><RecordPhoto record={record} className="record-photo" /><span className="score-pill">{Math.round(record.topConfidence * 100)}%</span></div>
                  <div className="record-copy">
                    <strong>{pestCount(record)} praga(s) detectada(s)</strong>
                    <span>{plot?.name || "Talhão não confirmado"}</span>
                    <span>{date.date} · {date.time}</span>
                    <small>{record.location?.source === "exif" ? "Localização EXIF" : record.location ? "GPS do celular" : "Sem localização"}</small>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {selected && (
        <div className="detail-overlay" role="dialog" aria-modal="true" aria-label="Detalhes da ocorrência">
          <button ref={detailCloseRef} className="detail-close" type="button" onClick={() => setSelected(null)}>Fechar</button>
          <div className="detail-photo-wrap">
            <RecordPhoto record={selected} className="detail-photo" />
            <div className="detail-score"><small>MAIOR CONFIANÇA DO MODELO</small><strong>{Math.round(selected.topConfidence * 100)}%</strong></div>
          </div>
          <div className="detail-sheet">
            <p className="overline">REGISTRO DE CAMPO</p>
            <h2>{pestCount(selected)} praga(s) detectada(s)</h2>
            <p className="caution-copy">Resultado de triagem experimental. Requer confirmação humana; não é diagnóstico agronômico.</p>
            <dl className="record-facts">
              <div><dt>Capturado</dt><dd>{dateParts(selected.capturedAt).date}, {dateParts(selected.capturedAt).time}</dd></div>
              <div><dt>Coordenada</dt><dd>{selected.location ? `${selected.location.latitude.toFixed(6)}, ${selected.location.longitude.toFixed(6)}` : "Não disponível"}</dd></div>
              <div><dt>Origem</dt><dd>{selected.location?.source === "exif" ? "EXIF da foto" : selected.location ? "GPS no momento da captura" : "Sem localização"}</dd></div>
              <div><dt>Precisão</dt><dd>{selected.location?.accuracy != null ? `aprox. ${Math.round(selected.location.accuracy)} m` : "não informada"}</dd></div>
            </dl>
            <label className="plot-correction">Talhão do registro
              <select value={selected.manualPlotId || "auto"} onChange={(event) => changeRecordPlot(event.target.value)}>
                <option value="auto">Automático — {selectedPlot?.name || "não encontrado"}</option>
                {plots.map((plot) => <option key={plot.id} value={plot.id}>{plot.name}</option>)}
                <option value="unassigned">Deixar sem talhão</option>
              </select>
              <small>Corrija manualmente se o GPS estiver impreciso ou próximo à divisa.</small>
            </label>
            <button className="danger-action full" type="button" onClick={() => deleteRecord(selected)}>Remover registro</button>
          </div>
        </div>
      )}
    </section>
  );
}
